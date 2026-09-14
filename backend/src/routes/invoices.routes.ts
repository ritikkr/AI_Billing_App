import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { aggregateTotals, computeLineTax, round2 } from '../services/gst.service.js';
import { nextDocumentNumber, financialYearLabel } from '../services/numbering.service.js';

/**
 * @swagger
 * tags:
 *   - name: Invoices
 *     description: Invoice management endpoints
 */

export const invoicesRouter = Router({ mergeParams: true });

const lineItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  qty: z.number().positive(),
  unit: z.string().optional(),
  rate: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(100),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1),
  invoiceDate: z.string().min(1),
  dueDate: z.string().optional().nullable(),
  placeOfSupplyStateCode: z.string().length(2).optional(),
  reverseCharge: z.boolean().optional(),
  status: z.enum(['draft', 'sent']).optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
});

function rowToInvoice(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    invoiceNumber: row.invoice_number,
    financialYear: row.financial_year,
    invoiceDate: row.invoice_date,
    dueDate: row.due_date,
    customerId: row.customer_id,
    placeOfSupplyStateCode: row.place_of_supply_state_code,
    isInterstate: !!row.is_interstate,
    subtotal: row.subtotal,
    totalDiscount: row.total_discount,
    taxableValue: row.taxable_value,
    totalCgst: row.total_cgst,
    totalSgst: row.total_sgst,
    totalIgst: row.total_igst,
    roundOff: row.round_off,
    grandTotal: row.grand_total,
    amountPaid: row.amount_paid,
    balanceDue: round2(row.grand_total - row.amount_paid),
    status: row.status,
    notes: row.notes,
    terms: row.terms,
    reverseCharge: !!row.reverse_charge,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLineItem(row: any) {
  return {
    id: row.id,
    itemId: row.item_id,
    description: row.description,
    hsnSacCode: row.hsn_sac_code,
    qty: row.qty,
    unit: row.unit,
    rate: row.rate,
    discountPercent: row.discount_percent,
    taxableValue: row.taxable_value,
    gstRate: row.gst_rate,
    cgstAmount: row.cgst_amount,
    sgstAmount: row.sgst_amount,
    igstAmount: row.igst_amount,
    lineTotal: row.line_total,
  };
}

async function getCustomerOrThrow(companyId: string, customerId: string) {
  const customer = (await db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(customerId, companyId)) as any;
  if (!customer) throw new ApiError(404, 'Customer not found');
  return customer;
}

async function getCompanyOrThrow(companyId: string) {
  const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(companyId)) as any;
  if (!company) throw new ApiError(404, 'Company not found');
  return company;
}

function computeInvoiceTotals(company: any, placeOfSupplyStateCode: string, lineItems: z.infer<typeof lineItemSchema>[]) {
  const isInterstate = placeOfSupplyStateCode !== company.state_code;
  const taxedLines = lineItems.map((l) =>
    computeLineTax({ qty: l.qty, rate: l.rate, discountPercent: l.discountPercent, gstRate: l.gstRate }, isInterstate)
  );
  const totals = aggregateTotals(
    lineItems.map((l) => ({ qty: l.qty, rate: l.rate, discountPercent: l.discountPercent, gstRate: l.gstRate })),
    taxedLines
  );
  return { isInterstate, taxedLines, totals };
}

invoicesRouter.get(
  '/',
  /**
   * @swagger
   * /api/companies/{companyId}/invoices:
   *   get:
   *     tags:
   *       - Invoices
   *     summary: List all invoices
   *     parameters:
   *       - name: companyId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [draft, sent, partially_paid, paid, overdue, cancelled]
   *       - name: customerId
   *         in: query
   *         schema:
   *           type: string
   *       - name: search
   *         in: query
   *         schema:
   *           type: string
   *         description: Search by invoice number
   *       - name: from
   *         in: query
   *         schema:
   *           type: string
   *           format: date
   *       - name: to
   *         in: query
   *         schema:
   *           type: string
   *           format: date
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of invoices
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 $ref: '#/components/schemas/Invoice'
   */
  asyncHandler(async (req, res) => {
    const { status, customerId, search, from, to } = req.query as Record<string, string>;
    const clauses = ['i.company_id = ?'];
    const params: any[] = [req.companyId];
    if (status) {
      clauses.push('i.status = ?');
      params.push(status);
    }
    if (customerId) {
      clauses.push('i.customer_id = ?');
      params.push(customerId);
    }
    if (search) {
      clauses.push('i.invoice_number LIKE ?');
      params.push(`%${search}%`);
    }
    if (from) {
      clauses.push('i.invoice_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('i.invoice_date <= ?');
      params.push(to);
    }
    const rows = (await db
      .prepare(
        `SELECT i.*, c.name as customer_name FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE ${clauses.join(' AND ')} ORDER BY i.invoice_date DESC, i.created_at DESC`
      )
      .all(...params)) as any[];
    res.json(rows.map((r) => ({ ...rowToInvoice(r), customerName: r.customer_name })));
  })
);

invoicesRouter.post(
  '/preview',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = invoiceSchema.omit({ status: true }).partial({ invoiceDate: true }).parse(req.body);
    const company = await getCompanyOrThrow(req.companyId!);
    const customer = await getCustomerOrThrow(req.companyId!, body.customerId);
    const placeOfSupply = body.placeOfSupplyStateCode || customer.billing_state_code || company.state_code;
    const { isInterstate, taxedLines, totals } = computeInvoiceTotals(company, placeOfSupply, body.lineItems);
    res.json({
      isInterstate,
      placeOfSupplyStateCode: placeOfSupply,
      lineItems: body.lineItems.map((l, idx) => ({ ...l, ...taxedLines[idx] })),
      totals,
    });
  })
);

invoicesRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const counts = (await db
      .prepare(
        `SELECT
           COUNT(*) as total,
           SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
           SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
           SUM(CASE WHEN status = 'partially_paid' THEN 1 ELSE 0 END) as partiallyPaid,
           SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
           SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
           SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
           SUM(CASE WHEN status != 'cancelled' THEN grand_total ELSE 0 END) as totalInvoiced,
           SUM(CASE WHEN status != 'cancelled' THEN amount_paid ELSE 0 END) as totalCollected,
           SUM(CASE WHEN status != 'cancelled' THEN grand_total - amount_paid ELSE 0 END) as totalOutstanding
         FROM invoices WHERE company_id = ?`
      )
      .get(req.companyId)) as any;

    const overdue = (await db
      .prepare(
        `SELECT COUNT(*) as count, COALESCE(SUM(grand_total - amount_paid), 0) as amount
         FROM invoices
         WHERE company_id = ? AND status IN ('sent', 'partially_paid', 'overdue')
           AND due_date IS NOT NULL AND due_date < date('now') AND grand_total > amount_paid`
      )
      .get(req.companyId)) as any;

    res.json({
      counts: {
        total: counts.total || 0,
        draft: counts.draft || 0,
        sent: counts.sent || 0,
        partiallyPaid: counts.partiallyPaid || 0,
        paid: counts.paid || 0,
        overdue: counts.overdue || 0,
        cancelled: counts.cancelled || 0,
      },
      totalInvoiced: Math.round((counts.totalInvoiced || 0) * 100) / 100,
      totalCollected: Math.round((counts.totalCollected || 0) * 100) / 100,
      totalOutstanding: Math.round((counts.totalOutstanding || 0) * 100) / 100,
      overdueInvoices: overdue.count || 0,
      overdueAmount: Math.round((overdue.amount || 0) * 100) / 100,
    });
  })
);

invoicesRouter.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const date = req.query.date ? new Date(String(req.query.date)) : new Date();
    if (Number.isNaN(date.getTime())) throw new ApiError(400, 'Invalid date');
    const company = (await db
      .prepare(`SELECT financial_year_start_month, invoice_prefix FROM companies WHERE id = ?`)
      .get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    const fy = financialYearLabel(date, company.financial_year_start_month || 4);
    const counter = (await db
      .prepare(`SELECT last_number FROM invoice_counters WHERE company_id = ? AND financial_year = ? AND series = 'invoice'`)
      .get(req.companyId, fy)) as any;
    const nextNumber = (counter?.last_number === undefined ? 0 : counter.last_number) + 1;
    const prefix = company.invoice_prefix || 'INV';

    res.json({
      invoiceNumber: `${prefix}/${fy}/${String(nextNumber).padStart(4, '0')}`,
      financialYear: fy,
      invoiceDate: date.toISOString().slice(0, 10),
    });
  })
);

invoicesRouter.get(
  '/overdue',
  asyncHandler(async (req, res) => {
    const rows = (await db
      .prepare(
        `SELECT i.*, c.name as customer_name,
           CAST(julianday('now') - julianday(i.due_date) AS INTEGER) as days_overdue
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE i.company_id = ? AND i.status IN ('sent', 'partially_paid', 'overdue')
           AND i.due_date IS NOT NULL AND i.due_date < date('now') AND i.grand_total > i.amount_paid
         ORDER BY i.due_date ASC`
      )
      .all(req.companyId)) as any[];

    const bucket = (days: number) =>
      days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';

    const byBucket: Record<string, number> = { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 };
    const invoices = rows.map((r) => {
      const balance = Math.round((r.grand_total - r.amount_paid) * 100) / 100;
      byBucket[bucket(r.days_overdue)] += balance;
      return {
        ...rowToInvoice(r),
        customerName: r.customer_name,
        daysOverdue: Number(r.days_overdue) || 0,
        overdueBucket: bucket(Number(r.days_overdue) || 0),
      };
    });

    res.json({ totalOutstanding: Math.round(invoices.reduce((s, i) => s + i.balanceDue, 0) * 100) / 100, byBucket, invoices });
  })
);

invoicesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!row) throw new ApiError(404, 'Invoice not found');
    const items = (await db.prepare(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order`).all(req.params.id)) as any[];
    const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(row.customer_id);
    const company = await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(row.company_id);
    const payments = (await db
      .prepare(`SELECT * FROM payments WHERE invoice_id = ? ORDER BY payment_date DESC, created_at DESC`)
      .all(req.params.id)) as any[];

    res.json({
      ...rowToInvoice(row),
      lineItems: items.map(rowToLineItem),
      customer,
      company,
      payments: payments.map((p) => ({
        id: p.id,
        paymentDate: p.payment_date,
        amount: p.amount,
        paymentMode: p.payment_mode,
        referenceNo: p.reference_no,
        notes: p.notes,
        createdAt: p.created_at,
      })),
    });
  })
);

invoicesRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = invoiceSchema.parse(req.body);
    const company = await getCompanyOrThrow(req.companyId!);
    const customer = await getCustomerOrThrow(req.companyId!, body.customerId);
    const placeOfSupply = body.placeOfSupplyStateCode || customer.billing_state_code || company.state_code;
    const { isInterstate, taxedLines, totals } = computeInvoiceTotals(company, placeOfSupply, body.lineItems);

    const invoiceDate = new Date(body.invoiceDate);
    const fy = financialYearLabel(invoiceDate, company.financial_year_start_month || 4);

    const id = newId();
    await db.transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(req.companyId!, 'invoice', invoiceDate, tx);
      await tx
        .prepare(
          `INSERT INTO invoices (
            id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
            place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
            total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
            notes, terms, reverse_charge, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`
        )
        .run(
          id,
          req.companyId,
          invoiceNumber,
          fy,
          body.invoiceDate,
          body.dueDate || null,
          body.customerId,
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
          body.status || 'draft',
          body.notes || null,
          body.terms || null,
          body.reverseCharge ? 1 : 0,
          req.user!.id
        );

      for (const [idx, l] of body.lineItems.entries()) {
        const t = taxedLines[idx];
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
    });

    const row = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id);
    res.status(201).json(rowToInvoice(row));
  })
);

invoicesRouter.patch(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Invoice not found');
    if (!['draft', 'sent'].includes(current.status)) {
      throw new ApiError(400, `Cannot edit an invoice with status "${current.status}"`);
    }

    const body = invoiceSchema.parse(req.body);
    const company = await getCompanyOrThrow(req.companyId!);
    const customer = await getCustomerOrThrow(req.companyId!, body.customerId);
    const placeOfSupply = body.placeOfSupplyStateCode || customer.billing_state_code || company.state_code;
    const { isInterstate, taxedLines, totals } = computeInvoiceTotals(company, placeOfSupply, body.lineItems);

    await db.transaction(async (tx) => {
      await tx
        .prepare(
          `UPDATE invoices SET invoice_date=?, due_date=?, customer_id=?, place_of_supply_state_code=?, is_interstate=?,
           subtotal=?, total_discount=?, taxable_value=?, total_cgst=?, total_sgst=?, total_igst=?, round_off=?,
           grand_total=?, status=?, notes=?, terms=?, reverse_charge=?, updated_at=datetime('now')
           WHERE id=? AND company_id=?`
        )
        .run(
          body.invoiceDate,
          body.dueDate || null,
          body.customerId,
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
          body.status || current.status,
          body.notes || null,
          body.terms || null,
          body.reverseCharge ? 1 : 0,
          req.params.id,
          req.companyId
        );

      await tx.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(req.params.id);
      for (const [idx, l] of body.lineItems.entries()) {
        const t = taxedLines[idx];
        await tx
          .prepare(
            `INSERT INTO invoice_items (
              id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
              taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            newId(),
            req.params.id,
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
    });

    const row = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id);
    res.json(rowToInvoice(row));
  })
);

invoicesRouter.post(
  '/:id/cancel',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Invoice not found');
    if (current.amount_paid > 0) throw new ApiError(400, 'Cannot cancel an invoice that has payments recorded against it');
    await db.prepare(`UPDATE invoices SET status = 'cancelled', updated_at=datetime('now') WHERE id = ? AND company_id = ?`).run(
      req.params.id,
      req.companyId
    );
    res.json({ status: 'cancelled' });
  })
);

invoicesRouter.post(
  '/:id/mark-sent',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Invoice not found');
    if (current.status === 'cancelled') throw new ApiError(400, 'Cannot send a cancelled invoice');
    if (current.status !== 'draft') throw new ApiError(400, `Invoice is already "${current.status}"`);
    await db.prepare(`UPDATE invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ? AND company_id = ?`).run(
      req.params.id,
      req.companyId
    );
    const row = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(req.params.id);
    res.json(rowToInvoice(row));
  })
);

invoicesRouter.post(
  '/:id/duplicate',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Invoice not found');

    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;

    const id = newId();
    await db.transaction(async (tx) => {
      const invoiceNumber = await nextDocumentNumber(req.companyId!, 'invoice', new Date(), tx);
      await tx
        .prepare(
          `INSERT INTO invoices (
            id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
            place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
            total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
            notes, terms, reverse_charge, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`
        )
        .run(
          id,
          req.companyId,
          invoiceNumber,
          financialYearLabel(new Date(), company.financial_year_start_month || 4),
          current.invoice_date,
          current.due_date,
          current.customer_id,
          current.place_of_supply_state_code,
          current.is_interstate,
          current.subtotal,
          current.total_discount,
          current.taxable_value,
          current.total_cgst,
          current.total_sgst,
          current.total_igst,
          current.round_off,
          current.grand_total,
          'draft',
          current.notes,
          current.terms,
          current.reverse_charge,
          req.user!.id
        );

      const lineItems = (await tx
        .prepare(`SELECT * FROM invoice_items WHERE invoice_id = ? ORDER BY sort_order`)
        .all(req.params.id)) as any[];
      for (const l of lineItems) {
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
            l.item_id,
            l.description,
            l.hsn_sac_code,
            l.qty,
            l.unit,
            l.rate,
            l.discount_percent,
            l.taxable_value,
            l.gst_rate,
            l.cgst_amount,
            l.sgst_amount,
            l.igst_amount,
            l.line_total,
            l.sort_order
          );
      }
    });

    const row = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(id);
    res.status(201).json(rowToInvoice(row));
  })
);

const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1).max(1000),
});

/**
 * @swagger
 * /api/companies/{companyId}/invoices/bulk:
 *   delete:
 *     tags:
 *       - Invoices
 *     summary: Bulk delete draft invoices
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [ids]
 *             properties:
 *               ids:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Result with deleted/skipped invoice ids
 */
invoicesRouter.delete(
  '/bulk',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = bulkDeleteSchema.parse(req.body);
    const deleted: string[] = [];
    const skipped: Array<{ id: string; reason: string }> = [];
    const notFound: string[] = [];

    await db.transaction(async (tx) => {
      for (const id of body.ids) {
        const row = (await tx.prepare(`SELECT status FROM invoices WHERE id = ? AND company_id = ?`).get(id, req.companyId)) as any;
        if (!row) {
          notFound.push(id);
          continue;
        }
        if (row.status !== 'draft') {
          skipped.push({ id, reason: `status is "${row.status}"` });
          continue;
        }
        await tx.prepare(`DELETE FROM invoices WHERE id = ?`).run(id);
        deleted.push(id);
      }
    });

    res.json({ deleted, deletedCount: deleted.length, skipped, skippedCount: skipped.length, notFound });
  })
);

invoicesRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Invoice not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft invoices can be deleted; cancel it instead');
    await db.prepare(`DELETE FROM invoices WHERE id = ? AND company_id = ?`).run(req.params.id, req.companyId);
    res.status(204).send();
  })
);
