import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { aggregateTotals, computeLineTax } from '../services/gst.service.js';
import { nextDocumentNumber, financialYearLabel } from '../services/numbering.service.js';

export const quotationsRouter = Router({ mergeParams: true });

const quotationLineItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  qty: z.number().positive(),
  unit: z.string().optional(),
  rate: z.number().min(0),
  discountPercent: z.number().min(0).max(100).optional(),
  gstRate: z.number().min(0).max(100),
});

const quotationSchema = z.object({
  customerId: z.string().min(1),
  quotationDate: z.string().min(1),
  validUntil: z.string().optional().nullable(),
  placeOfSupplyStateCode: z.string().length(2).optional(),
  notes: z.string().optional().nullable(),
  terms: z.string().optional().nullable(),
  lineItems: z.array(quotationLineItemSchema).min(1),
});

function rowToQuotation(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    quotationNumber: row.quotation_number,
    financialYear: row.financial_year,
    quotationDate: row.quotation_date,
    validUntil: row.valid_until,
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
    status: row.status,
    notes: row.notes,
    terms: row.terms,
    convertedInvoiceId: row.converted_invoice_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToQuotationLineItem(row: any) {
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

async function getQuotationOrThrow(id: string) {
  const row = (await db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id)) as any;
  if (!row) throw new ApiError(404, 'Quotation not found');
  return row;
}

// Derived helpers
function computeQuotationTotals(body: { lineItems: any[] }, placeOfSupply: string, companyStateCode: string) {
  const isInterstate = placeOfSupply !== companyStateCode;
  const taxedLines = body.lineItems.map((l) =>
    computeLineTax({ qty: l.qty, rate: l.rate, discountPercent: l.discountPercent ?? 0, gstRate: l.gstRate }, isInterstate)
  );
  const totals = aggregateTotals(body.lineItems, taxedLines);
  return { taxedLines, totals, isInterstate };
}

quotationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customerId, search, from, to } = req.query as Record<string, string>;
    const clauses = ['q.company_id = ?'];
    const params: any[] = [req.companyId];

    if (status) {
      clauses.push('q.status = ?');
      params.push(status);
    }
    if (customerId) {
      clauses.push('q.customer_id = ?');
      params.push(customerId);
    }
    if (search) {
      clauses.push('(q.quotation_number LIKE ? OR c.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like);
    }
    if (from) {
      clauses.push('q.quotation_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('q.quotation_date <= ?');
      params.push(to);
    }

    const rows = (await db
      .prepare(
        `SELECT q.*, c.name AS customer_name FROM quotations q
         JOIN customers c ON c.id = q.customer_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY q.quotation_date DESC, q.created_at DESC`
      )
      .all(...params)) as any[];

    res.json(rows.map((r) => ({ ...rowToQuotation(r), customerName: r.customer_name })));
  })
);

quotationsRouter.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const { date } = req.query as Record<string, string>;
    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    const docDate = date ? new Date(date) : new Date();
    const fy = financialYearLabel(docDate, company.financial_year_start_month || 4);
    const prefix = company.quotation_prefix || 'EST';

    const last = (await db
      .prepare(`SELECT last_number FROM invoice_counters WHERE company_id = ? AND financial_year = ? AND series = 'quotation'`)
      .get(req.companyId, fy)) as any;
    const next = (last?.last_number ?? 0) + 1;

    res.json({ quotationNumber: `${prefix}/${fy}/${String(next).padStart(4, '0')}`, financialYear: fy, quotationDate: docDate.toISOString().slice(0, 10) });
  })
);

quotationsRouter.get(
  '/summary',
  asyncHandler(async (req, res) => {
    const rows = (await db
      .prepare(
        `SELECT status, COUNT(*) as cnt, SUM(grand_total) as total
         FROM quotations WHERE company_id = ? GROUP BY status`
      )
      .all(req.companyId)) as any[];

    const counts: Record<string, number> = {
      total: 0,
      draft: 0,
      sent: 0,
      accepted: 0,
      rejected: 0,
      expired: 0,
      converted: 0,
    };
    let totalQuoted = 0;
    let totalConverted = 0;

    for (const r of rows) {
      counts[r.status] = Number(r.cnt);
      counts.total += Number(r.cnt);
      totalQuoted += Number(r.total || 0);
      if (r.status === 'converted') totalConverted += Number(r.total || 0);
    }

    res.json({ counts, totalQuoted, totalConverted });
  })
);

quotationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = (await db
      .prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`)
      .get(req.params.id, req.companyId)) as any;
    if (!row) throw new ApiError(404, 'Quotation not found');

    const items = (await db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order`).all(req.params.id)) as any[];
    const customer = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(row.customer_id);
    const company = await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(row.company_id);

    res.json({
      ...rowToQuotation(row),
      customer,
      company,
      lineItems: items.map(rowToQuotationLineItem),
    });
  })
);

quotationsRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = quotationSchema.parse(req.body);
    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    const customer = (await db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(body.customerId, req.companyId)) as any;
    if (!customer) throw new ApiError(404, 'Customer not found');

    const placeOfSupply = body.placeOfSupplyStateCode || customer.billing_state_code || company.state_code;
    const { taxedLines, totals, isInterstate } = computeQuotationTotals(body, placeOfSupply, company.state_code);

    const quoteDate = new Date(body.quotationDate);
    const fy = financialYearLabel(quoteDate, company.financial_year_start_month || 4);
    const id = newId();

    await db.transaction(async (tx) => {
      const quoteNumber = await nextDocumentNumber(req.companyId!, 'quotation', quoteDate, tx);
      await tx
        .prepare(
          `INSERT INTO quotations (
            id, company_id, quotation_number, financial_year, quotation_date, valid_until,
            customer_id, place_of_supply_state_code, is_interstate,
            subtotal, total_discount, taxable_value, total_cgst, total_sgst, total_igst,
            round_off, grand_total, status, notes, terms, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'draft',?,?,?)`
        )
        .run(
          id,
          req.companyId,
          quoteNumber,
          fy,
          body.quotationDate,
          body.validUntil || null,
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
          body.notes || null,
          body.terms || null,
          req.user!.id
        );

      for (const [idx, l] of body.lineItems.entries()) {
        const t = taxedLines[idx];
        await tx
          .prepare(
            `INSERT INTO quotation_items (
              id, quotation_id, item_id, description, hsn_sac_code, qty, unit, rate,
              discount_percent, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount,
              line_total, sort_order
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

    const row = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(id);
    res.status(201).json(rowToQuotation(row));
  })
);

quotationsRouter.patch(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = quotationSchema.partial().parse(req.body);
    const current = await getQuotationOrThrow(req.params.id);
    if (current.company_id !== req.companyId) throw new ApiError(404, 'Quotation not found');
    if (!['draft', 'sent'].includes(current.status)) throw new ApiError(400, 'Only draft or sent quotations can be edited');

    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    let customer = current.customer_id;
    if (body.customerId) {
      const found = await db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(body.customerId, req.companyId);
      if (!found) throw new ApiError(404, 'Customer not found');
      customer = body.customerId;
    }

    const placeOfSupply = body.placeOfSupplyStateCode || (customer === current.customer_id ? current.place_of_supply_state_code : company.state_code);
    const lines = body.lineItems ?? [];

    let taxedLines: any[] = [];
    let totals: any = {
      subtotal: current.subtotal,
      totalDiscount: current.total_discount,
      taxableValue: current.taxable_value,
      totalCgst: current.total_cgst,
      totalSgst: current.total_sgst,
      totalIgst: current.total_igst,
      roundOff: current.round_off,
      grandTotal: current.grand_total,
    };
    let isInterstate = current.is_interstate;

    if (lines.length > 0) {
      const result = computeQuotationTotals({ lineItems: lines }, placeOfSupply, company.state_code);
      taxedLines = result.taxedLines;
      totals = result.totals;
      isInterstate = result.isInterstate;
    }

    await db.transaction(async (tx) => {
      await tx
        .prepare(
          `UPDATE quotations SET
            customer_id = ?, quotation_date = COALESCE(?, quotation_date),
            valid_until = ?, place_of_supply_state_code = ?, is_interstate = ?,
            subtotal = ?, total_discount = ?, taxable_value = ?,
            total_cgst = ?, total_sgst = ?, total_igst = ?, round_off = ?, grand_total = ?,
            notes = COALESCE(?, notes), terms = COALESCE(?, terms),
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .run(
          customer,
          body.quotationDate ?? null,
          body.validUntil === undefined ? current.valid_until : body.validUntil,
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
          body.notes ?? null,
          body.terms ?? null,
          req.params.id
        );

      if (lines.length > 0) {
        await tx.prepare(`DELETE FROM quotation_items WHERE quotation_id = ?`).run(req.params.id);
        for (const [idx, l] of lines.entries()) {
          const t = taxedLines[idx];
          await tx
            .prepare(
              `INSERT INTO quotation_items (
                id, quotation_id, item_id, description, hsn_sac_code, qty, unit, rate,
                discount_percent, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount,
                line_total, sort_order
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
      }
    });

    const row = await db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id);
    res.json(rowToQuotation(row));
  })
);

quotationsRouter.post(
  '/:id/send',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft quotations can be marked as sent');
    await db.prepare(`UPDATE quotations SET status = 'sent', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ status: 'sent' });
  })
);

quotationsRouter.post(
  '/:id/accept',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (!['draft', 'sent'].includes(current.status)) throw new ApiError(400, 'Only draft or sent quotations can be accepted');
    await db.prepare(`UPDATE quotations SET status = 'accepted', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ status: 'accepted' });
  })
);

quotationsRouter.post(
  '/:id/reject',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (!['draft', 'sent'].includes(current.status)) throw new ApiError(400, 'Only draft or sent quotations can be rejected');
    await db.prepare(`UPDATE quotations SET status = 'rejected', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ status: 'rejected' });
  })
);

quotationsRouter.post(
  '/:id/convert',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (current.converted_invoice_id) {
      const existing = await db.prepare(`SELECT id FROM invoices WHERE id = ?`).get(current.converted_invoice_id);
      if (existing) throw new ApiError(400, 'This quotation has already been converted to an invoice');
    }
    if (!['draft', 'sent', 'accepted'].includes(current.status)) throw new ApiError(400, 'Only draft, sent, or accepted quotations can be converted');

    const items = (await db.prepare(`SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order`).all(req.params.id)) as any[];
    if (items.length === 0) throw new ApiError(400, 'Quotation has no line items to convert');

    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    const invoiceId = newId();
    let invoiceNumber = '';
    let invoiceFy = '';

    await db.transaction(async (tx) => {
      invoiceNumber = await nextDocumentNumber(req.companyId!, 'invoice', new Date(current.quotation_date), tx);
      invoiceFy = current.financial_year;

      await tx
        .prepare(
          `INSERT INTO invoices (
            id, company_id, invoice_number, financial_year, invoice_date, due_date,
            customer_id, place_of_supply_state_code, is_interstate,
            subtotal, total_discount, taxable_value, total_cgst, total_sgst, total_igst,
            round_off, grand_total, amount_paid, status, notes, terms, reverse_charge, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,'draft',?,?,0,?)`
        )
        .run(
          invoiceId,
          req.companyId,
          invoiceNumber,
          invoiceFy,
          current.quotation_date,
          null,
          current.customer_id,
          current.place_of_supply_state_code,
          current.is_interstate ? 1 : 0,
          current.subtotal,
          current.total_discount,
          current.taxable_value,
          current.total_cgst,
          current.total_sgst,
          current.total_igst,
          current.round_off,
          current.grand_total,
          current.notes || null,
          current.terms || null,
          req.user!.id
        );

      for (const item of items) {
        await tx
          .prepare(
            `INSERT INTO invoice_items (
              id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate,
              discount_percent, taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount,
              line_total, sort_order
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            newId(),
            invoiceId,
            item.item_id,
            item.description,
            item.hsn_sac_code,
            item.qty,
            item.unit,
            item.rate,
            item.discount_percent,
            item.taxable_value,
            item.gst_rate,
            item.cgst_amount,
            item.sgst_amount,
            item.igst_amount,
            item.line_total,
            0
          );
      }

      await tx
        .prepare(`UPDATE quotations SET status = 'converted', converted_invoice_id = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(invoiceId, req.params.id);
    });

    const invoice = await db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(invoiceId);
    res.status(201).json({
      quotation: rowToQuotation(await db.prepare(`SELECT * FROM quotations WHERE id = ?`).get(req.params.id)),
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status: invoice.status,
      },
    });
  })
);

quotationsRouter.post(
  '/:id/cancel',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (['converted', 'cancelled'].includes(current.status)) throw new ApiError(400, 'Quotation cannot be cancelled in this state');
    await db.prepare(`UPDATE quotations SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ status: 'cancelled' });
  })
);

quotationsRouter.delete(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM quotations WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Quotation not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft quotations can be deleted');
    await db.transaction(async (tx) => {
      await tx.prepare(`DELETE FROM quotation_items WHERE quotation_id = ?`).run(req.params.id);
      await tx.prepare(`DELETE FROM quotations WHERE id = ?`).run(req.params.id);
    });
    res.json({ deleted: true });
  })
);