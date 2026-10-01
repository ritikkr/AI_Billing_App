import { Router } from 'express';
import { z } from 'zod';
import { db, type DbLike } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { aggregateTotals, computeLineTax, round2, type TaxableLine } from '../services/gst.service.js';
import { nextDocumentNumber, financialYearLabel } from '../services/numbering.service.js';

/**
 * @swagger
 * tags:
 *   - name: Monthly Bills
 *     description: Per-customer standing monthly bills and bulk invoice generation
 */

export const monthlyBillsRouter = Router({ mergeParams: true });

const billItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  qty: z.number().positive(),
  unit: z.string().optional(),
  rate: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(100),
});

const billSchema = z.object({
  notes: z.string().optional().nullable(),
  items: z.array(billItemSchema).min(1, 'Add at least one item to the monthly bill'),
});

const generateSchema = z.object({
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  status: z.enum(['draft', 'sent']).optional().default('draft'),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  invoices: z
    .array(
      z.object({
        customerId: z.string().min(1),
        lineItems: z.array(billItemSchema).min(1),
      })
    )
    .min(1, 'Select at least one customer'),
});

type BillItemInput = z.infer<typeof billItemSchema>;

/* -------------------------------------------------------------------------- */
/*  Row mappers                                                               */
/* -------------------------------------------------------------------------- */

function rowToBill(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    customerId: row.customer_id,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToBillItem(row: any) {
  return {
    id: row.id,
    itemId: row.item_id,
    description: row.description,
    hsnSacCode: row.hsn_sac_code,
    qty: row.qty,
    unit: row.unit,
    rate: row.rate,
    discountPercent: row.discount_percent,
    gstRate: row.gst_rate,
  };
}

function toTaxableLine(l: BillItemInput): TaxableLine {
  return { qty: l.qty, rate: l.rate, discountPercent: l.discountPercent, gstRate: l.gstRate };
}

function summariseLines(lines: TaxableLine[], isInterstate: boolean) {
  const taxed = lines.map((l) => computeLineTax(l, isInterstate));
  return { totals: aggregateTotals(lines, taxed), taxed };
}

/* -------------------------------------------------------------------------- */
/*  Shared lookups                                                            */
/* -------------------------------------------------------------------------- */

async function getCustomerOrThrow(companyId: string, customerId: string) {
  const customer = (await db
    .prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`)
    .get(customerId, companyId)) as any;
  if (!customer) throw new ApiError(404, 'Customer not found');
  return customer;
}

/**
 * Place of supply drives CGST+SGST vs IGST. Prefer the customer's saved state
 * code, then the state prefix of their GSTIN, then the company's own state.
 *
 * `customers.billing_state_code` is absent from schema.sql (it survives only in
 * databases created before that column was dropped) but older production
 * databases still carry it, so every query that feeds this function must select
 * it conditionally via hasBillingStateCode().
 */
function resolvePlaceOfSupply(customer: any, company: any): string {
  if (customer?.billing_state_code) return customer.billing_state_code as string;
  if (customer?.gstin && String(customer.gstin).length >= 2) return String(customer.gstin).slice(0, 2);
  return company.state_code;
}

/** Cached probe: naming a column that does not exist fails the whole query. */
let billingStateCodeColumn: Promise<string | null> | null = null;
function billingStateCodeExpr(): Promise<string | null> {
  if (!billingStateCodeColumn) {
    billingStateCodeColumn = (async () => {
      const cols = (await db.prepare(`PRAGMA table_info(customers)`).all()) as Array<{ name: string }>;
      return cols.some((c) => c.name === 'billing_state_code') ? 'c.billing_state_code' : null;
    })();
  }
  return billingStateCodeColumn;
}

async function loadItems(billId: string) {
  return (await db
    .prepare(`SELECT * FROM customer_monthly_bill_items WHERE monthly_bill_id = ? ORDER BY sort_order`)
    .all(billId)) as any[];
}

async function replaceItems(tx: DbLike, billId: string, items: BillItemInput[]) {
  await tx.prepare(`DELETE FROM customer_monthly_bill_items WHERE monthly_bill_id = ?`).run(billId);
  for (const [idx, l] of items.entries()) {
    await tx
      .prepare(
        `INSERT INTO customer_monthly_bill_items (
           id, monthly_bill_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent, gst_rate, sort_order
         ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`
      )
      .run(
        newId(),
        billId,
        l.itemId || null,
        l.description,
        l.hsnSacCode || null,
        l.qty,
        l.unit || 'NOS',
        l.rate,
        l.discountPercent || 0,
        l.gstRate,
        idx
      );
  }
}

/* -------------------------------------------------------------------------- */
/*  List configured monthly bills                                             */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/companies/{companyId}/monthly-bills:
 *   get:
 *     tags:
 *       - Monthly Bills
 *     summary: List configured customer monthly bills with monthly estimates
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: group
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by customer group
 *       - name: includeItems
 *         in: query
 *         schema:
 *           type: boolean
 *         description: Include each bill's line items (used by the bulk generator)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of monthly bills
 */
monthlyBillsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const group = (req.query.group as string) || '';
    const includeItems = req.query.includeItems === 'true';
    const company = (await db.prepare(`SELECT state_code FROM companies WHERE id = ?`).get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    const clauses = ['b.company_id = ?'];
    const params: any[] = [req.companyId];
    if (group) {
      clauses.push('c.customer_group = ?');
      params.push(group);
    }
    if (req.query.includeArchived !== 'true') {
      clauses.push('c.is_active = 1');
    }

    const stateColumn = await billingStateCodeExpr();
    const rows = (await db
      .prepare(
        `SELECT b.*, c.name as customer_name, c.customer_group, c.gstin, c.is_active${stateColumn ? `, ${stateColumn}` : ''}
         FROM customer_monthly_bills b
         JOIN customers c ON c.id = b.customer_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY c.name`
      )
      .all(...params)) as any[];

    const bills = [];
    for (const row of rows) {
      const placeOfSupply = resolvePlaceOfSupply(row, company);
      const items = await loadItems(row.id);
      const lines = items.map((i) => ({
        qty: i.qty,
        rate: i.rate,
        discountPercent: i.discount_percent,
        gstRate: i.gst_rate,
      }));
      const { totals } = lines.length
        ? summariseLines(lines, placeOfSupply !== company.state_code)
        : { totals: { subtotal: 0, totalDiscount: 0, taxableValue: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, roundOff: 0, grandTotal: 0 } };

      bills.push({
        ...rowToBill(row),
        customerName: row.customer_name,
        customerGroup: row.customer_group,
        isActive: !!row.is_active,
        itemCount: items.length,
        isInterstate: placeOfSupply !== company.state_code,
        monthlySubtotal: totals.subtotal,
        monthlyTaxableValue: totals.taxableValue,
        monthlyTax: round2(totals.totalCgst + totals.totalSgst + totals.totalIgst),
        monthlyGrandTotal: totals.grandTotal,
        ...(includeItems ? { items: items.map(rowToBillItem) } : {}),
      });
    }

    res.json(bills);
  })
);

/* -------------------------------------------------------------------------- */
/*  Read / write a single customer's monthly bill                             */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/companies/{companyId}/monthly-bills/customer/{customerId}:
 *   get:
 *     tags:
 *       - Monthly Bills
 *     summary: Get one customer's monthly bill (bill is null when not configured)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Monthly bill with its line items
 */
monthlyBillsRouter.get(
  '/customer/:customerId',
  asyncHandler(async (req, res) => {
    const customer = await getCustomerOrThrow(req.companyId!, req.params.customerId);
    const company = (await db.prepare(`SELECT state_code FROM companies WHERE id = ?`).get(req.companyId)) as any;
    const row = (await db
      .prepare(`SELECT * FROM customer_monthly_bills WHERE company_id = ? AND customer_id = ?`)
      .get(req.companyId, req.params.customerId)) as any;

    if (!row) {
      res.json({ bill: null, items: [], customerName: customer.name, customerGroup: customer.customer_group });
      return;
    }

    const items = await loadItems(row.id);
    const isInterstate = resolvePlaceOfSupply(customer, company) !== company.state_code;
    const { totals, taxed } = items.length
      ? summariseLines(
          items.map((i) => ({ qty: i.qty, rate: i.rate, discountPercent: i.discount_percent, gstRate: i.gst_rate })),
          isInterstate
        )
      : { totals: null, taxed: [] };

    res.json({
      bill: rowToBill(row),
      items: items.map((i, idx) => ({ ...rowToBillItem(i), ...(taxed[idx] || {}) })),
      customerName: customer.name,
      customerGroup: customer.customer_group,
      isInterstate,
      totals,
    });
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/monthly-bills/customer/{customerId}:
 *   put:
 *     tags:
 *       - Monthly Bills
 *     summary: Create or replace a customer's monthly bill items and prices
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Saved monthly bill
 */
monthlyBillsRouter.put(
  '/customer/:customerId',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = billSchema.parse(req.body);
    await getCustomerOrThrow(req.companyId!, req.params.customerId);

    const existing = (await db
      .prepare(`SELECT id FROM customer_monthly_bills WHERE company_id = ? AND customer_id = ?`)
      .get(req.companyId, req.params.customerId)) as any;

    const billId = existing?.id || newId();

    await db.transaction(async (tx) => {
      if (existing) {
        await tx
          .prepare(`UPDATE customer_monthly_bills SET notes = ?, updated_at = datetime('now') WHERE id = ?`)
          .run(body.notes || null, billId);
      } else {
        await tx
          .prepare(`INSERT INTO customer_monthly_bills (id, company_id, customer_id, notes) VALUES (?,?,?,?)`)
          .run(billId, req.companyId, req.params.customerId, body.notes || null);
      }
      await replaceItems(tx, billId, body.items);
    });

    const row = await db.prepare(`SELECT * FROM customer_monthly_bills WHERE id = ?`).get(billId);
    const items = await loadItems(billId);
    res.json({ bill: rowToBill(row), items: items.map(rowToBillItem) });
  })
);

monthlyBillsRouter.delete(
  '/customer/:customerId',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const existing = (await db
      .prepare(`SELECT id FROM customer_monthly_bills WHERE company_id = ? AND customer_id = ?`)
      .get(req.companyId, req.params.customerId)) as any;
    if (!existing) throw new ApiError(404, 'This customer has no monthly bill configured');
    await db.prepare(`DELETE FROM customer_monthly_bills WHERE id = ?`).run(existing.id);
    res.status(204).send();
  })
);

/* -------------------------------------------------------------------------- */
/*  Copy from another customer in the same group                              */
/* -------------------------------------------------------------------------- */

/**
 * Lists customers sharing this customer's group that already have a monthly
 * bill, so their items and prices can be copied as a starting point.
 */
monthlyBillsRouter.get(
  '/copy-sources/:customerId',
  asyncHandler(async (req, res) => {
    const customer = await getCustomerOrThrow(req.companyId!, req.params.customerId);
    if (!customer.customer_group) {
      res.json({ customerGroup: null, sources: [] });
      return;
    }

    const rows = (await db
      .prepare(
        `SELECT c.id, c.name,
           (SELECT COUNT(*) FROM customer_monthly_bill_items mi WHERE mi.monthly_bill_id = b.id) as item_count
         FROM customer_monthly_bills b
         JOIN customers c ON c.id = b.customer_id
         WHERE b.company_id = ? AND c.customer_group = ? AND c.id != ?
         ORDER BY c.name`
      )
      .all(req.companyId, customer.customer_group, req.params.customerId)) as any[];

    res.json({
      customerGroup: customer.customer_group,
      sources: rows.map((r) => ({ id: r.id, name: r.name, itemCount: r.item_count })),
    });
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/monthly-bills/customer/{customerId}/copy:
 *   post:
 *     tags:
 *       - Monthly Bills
 *     summary: Copy another customer's monthly bill items and prices
 *     description: The source customer must belong to the same customer group.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Copied monthly bill
 */
monthlyBillsRouter.post(
  '/customer/:customerId/copy',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const { fromCustomerId } = z.object({ fromCustomerId: z.string().min(1) }).parse(req.body);
    const target = await getCustomerOrThrow(req.companyId!, req.params.customerId);
    const source = await getCustomerOrThrow(req.companyId!, fromCustomerId);

    if (!target.customer_group) {
      throw new ApiError(400, 'Set a group on this customer before copying a monthly bill');
    }
    if (target.customer_group !== source.customer_group) {
      throw new ApiError(400, `Monthly bills can only be copied within the same group (${source.customer_group} vs ${target.customer_group})`);
    }

    const sourceBill = (await db
      .prepare(`SELECT * FROM customer_monthly_bills WHERE company_id = ? AND customer_id = ?`)
      .get(req.companyId, fromCustomerId)) as any;
    if (!sourceBill) throw new ApiError(404, 'The source customer has no monthly bill configured');

    const sourceItems = await loadItems(sourceBill.id);
    if (sourceItems.length === 0) throw new ApiError(400, 'The source customer has no items in their monthly bill');

    const targetBill = (await db
      .prepare(`SELECT id FROM customer_monthly_bills WHERE company_id = ? AND customer_id = ?`)
      .get(req.companyId, req.params.customerId)) as any;
    const billId = targetBill?.id || newId();

    await db.transaction(async (tx) => {
      if (targetBill) {
        await tx.prepare(`UPDATE customer_monthly_bills SET updated_at = datetime('now') WHERE id = ?`).run(billId);
      } else {
        await tx
          .prepare(`INSERT INTO customer_monthly_bills (id, company_id, customer_id, notes) VALUES (?,?,?,NULL)`)
          .run(billId, req.companyId, req.params.customerId);
      }
      await replaceItems(
        tx,
        billId,
        sourceItems.map((i) => ({
          itemId: i.item_id,
          description: i.description,
          hsnSacCode: i.hsn_sac_code,
          qty: i.qty,
          unit: i.unit,
          rate: i.rate,
          discountPercent: i.discount_percent,
          gstRate: i.gst_rate,
        }))
      );
    });

    const row = await db.prepare(`SELECT * FROM customer_monthly_bills WHERE id = ?`).get(billId);
    const items = await loadItems(billId);
    res.json({
      bill: rowToBill(row),
      items: items.map(rowToBillItem),
      copiedFrom: { id: source.id, name: source.name, itemCount: sourceItems.length },
    });
  })
);

/* -------------------------------------------------------------------------- */
/*  Generate invoices from monthly bills                                     */
/* -------------------------------------------------------------------------- */

/**
 * @swagger
 * /api/companies/{companyId}/monthly-bills/generate:
 *   post:
 *     tags:
 *       - Monthly Bills
 *     summary: Generate one invoice per customer from their monthly bill
 *     description: >
 *       Creates a separate invoice for every entry in `invoices`. Line items are
 *       supplied by the caller so per-customer rates and quantities edited in
 *       the preview are honoured; taxes and totals are always recomputed here.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Generated and skipped invoices
 */
monthlyBillsRouter.post(
  '/generate',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = generateSchema.parse(req.body);
    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    const invoiceDate = new Date(body.invoiceDate);
    if (Number.isNaN(invoiceDate.getTime())) throw new ApiError(400, 'Invalid invoice date');
    const fy = financialYearLabel(invoiceDate, company.financial_year_start_month || 4);

    // Validate every customer up front so a bad row cannot leave a half-created batch.
    const customers = new Map<string, any>();
    for (const entry of body.invoices) {
      if (customers.has(entry.customerId)) continue;
      customers.set(entry.customerId, await getCustomerOrThrow(req.companyId!, entry.customerId));
    }

    const created: Array<{ id: string; invoiceNumber: string; customerId: string; customerName: string; grandTotal: number }> = [];
    const skipped: Array<{ customerId: string; customerName: string; reason: string }> = [];

    await db.transaction(async (tx) => {
      for (const entry of body.invoices) {
        const customer = customers.get(entry.customerId)!;
        if (!customer.is_active) {
          skipped.push({ customerId: customer.id, customerName: customer.name, reason: 'Customer is archived' });
          continue;
        }

        const placeOfSupply = resolvePlaceOfSupply(customer, company);
        const isInterstate = placeOfSupply !== company.state_code;
        const lines = entry.lineItems.map(toTaxableLine);
        const taxed = entry.lineItems.map((l) => computeLineTax(toTaxableLine(l), isInterstate));
        const totals = aggregateTotals(lines, taxed);

        const id = newId();
        const invoiceNumber = await nextDocumentNumber(req.companyId!, 'invoice', invoiceDate, tx);

        await tx
          .prepare(
            `INSERT INTO invoices (
               id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
               place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
               total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
               notes, terms, reverse_charge, created_by
             ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,0,?)`
          )
          .run(
            id,
            req.companyId,
            invoiceNumber,
            fy,
            body.invoiceDate,
            body.dueDate || null,
            customer.id,
            placeOfSupply,
            isInterstate ? 1 : 0,
            totals.subtotal,
            totals.totalDiscount,
            totals.taxableValue,
            totals.totalCgst,
            totals.totalSgst,
            totals.totalIgst,
            totals.roundOff,
            totals.grandTotal,
            body.status,
            body.notes || null,
            body.terms || null,
            req.user!.id
          );

        for (const [idx, l] of entry.lineItems.entries()) {
          const t = taxed[idx];
          await tx
            .prepare(
              `INSERT INTO invoice_items (
                 id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
                 taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
               ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            )
            .run(
              newId(),
              id,
              l.itemId || null,
              l.description,
              l.hsnSacCode || null,
              l.qty,
              l.unit || 'NOS',
              l.rate,
              l.discountPercent || 0,
              t.taxableValue,
              l.gstRate,
              t.cgstAmount,
              t.sgstAmount,
              t.igstAmount,
              t.lineTotal,
              idx
            );
        }

        created.push({ id, invoiceNumber, customerId: customer.id, customerName: customer.name, grandTotal: totals.grandTotal });
      }
    });

    res.status(201).json({ created, createdCount: created.length, skipped, skippedCount: skipped.length });
  })
);
