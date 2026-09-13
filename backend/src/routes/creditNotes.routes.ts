import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { aggregateTotals, computeLineTax } from '../services/gst.service.js';
import { nextDocumentNumber, financialYearLabel } from '../services/numbering.service.js';

export const creditNotesRouter = Router({ mergeParams: true });

const lineItemSchema = z.object({
  itemId: z.string().optional().nullable(),
  description: z.string().min(1),
  hsnSacCode: z.string().optional().nullable(),
  qty: z.number().positive(),
  unit: z.string().optional(),
  rate: z.number().min(0),
  gstRate: z.number().min(0).max(100),
});

const noteSchema = z.object({
  noteType: z.enum(['credit', 'debit']).default('credit'),
  customerId: z.string().min(1),
  invoiceId: z.string().optional().nullable(),
  noteDate: z.string().min(1),
  reason: z.string().optional().nullable(),
  placeOfSupplyStateCode: z.string().length(2).optional(),
  notes: z.string().optional().nullable(),
  lineItems: z.array(lineItemSchema).min(1),
});

function rowToNote(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    noteType: row.note_type,
    noteNumber: row.note_number,
    financialYear: row.financial_year,
    noteDate: row.note_date,
    customerId: row.customer_id,
    invoiceId: row.invoice_id,
    reason: row.reason,
    placeOfSupplyStateCode: row.place_of_supply_state_code,
    isInterstate: !!row.is_interstate,
    taxableValue: row.taxable_value,
    totalCgst: row.total_cgst,
    totalSgst: row.total_sgst,
    totalIgst: row.total_igst,
    roundOff: row.round_off,
    grandTotal: row.grand_total,
    status: row.status,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

creditNotesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { noteType, customerId } = req.query as Record<string, string>;
    const clauses = ['cn.company_id = ?'];
    const params: any[] = [req.companyId];
    if (noteType) {
      clauses.push('cn.note_type = ?');
      params.push(noteType);
    }
    if (customerId) {
      clauses.push('cn.customer_id = ?');
      params.push(customerId);
    }
    const rows = db
      .prepare(
        `SELECT cn.*, c.name as customer_name FROM credit_notes cn JOIN customers c ON c.id = cn.customer_id
         WHERE ${clauses.join(' AND ')} ORDER BY cn.note_date DESC, cn.created_at DESC`
      )
      .all(...params) as any[];
    res.json(rows.map((r) => ({ ...rowToNote(r), customerName: r.customer_name })));
  })
);

creditNotesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM credit_notes WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId) as any;
    if (!row) throw new ApiError(404, 'Credit/debit note not found');
    const items = db.prepare(`SELECT * FROM credit_note_items WHERE credit_note_id = ?`).all(req.params.id) as any[];
    const customer = db.prepare(`SELECT * FROM customers WHERE id = ?`).get(row.customer_id);
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(row.company_id);
    res.json({
      ...rowToNote(row),
      customer,
      company,
      lineItems: items.map((i) => ({
        id: i.id,
        itemId: i.item_id,
        description: i.description,
        hsnSacCode: i.hsn_sac_code,
        qty: i.qty,
        unit: i.unit,
        rate: i.rate,
        taxableValue: i.taxable_value,
        gstRate: i.gst_rate,
        cgstAmount: i.cgst_amount,
        sgstAmount: i.sgst_amount,
        igstAmount: i.igst_amount,
        lineTotal: i.line_total,
      })),
    });
  })
);

creditNotesRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = noteSchema.parse(req.body);
    const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId) as any;
    const customer = db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(body.customerId, req.companyId) as any;
    if (!customer) throw new ApiError(404, 'Customer not found');
    if (body.invoiceId) {
      const invoice = db.prepare(`SELECT id FROM invoices WHERE id = ? AND company_id = ?`).get(body.invoiceId, req.companyId);
      if (!invoice) throw new ApiError(404, 'Referenced invoice not found');
    }

    const placeOfSupply = body.placeOfSupplyStateCode || customer.billing_state_code || company.state_code;
    const isInterstate = placeOfSupply !== company.state_code;
    const taxedLines = body.lineItems.map((l) => computeLineTax({ qty: l.qty, rate: l.rate, gstRate: l.gstRate }, isInterstate));
    const totals = aggregateTotals(body.lineItems, taxedLines);

    const noteDate = new Date(body.noteDate);
    const fy = financialYearLabel(noteDate, company.financial_year_start_month || 4);
    const series = body.noteType === 'debit' ? 'debit_note' : 'credit_note';

    const id = newId();
    const tx = db.transaction(() => {
      const noteNumber = nextDocumentNumber(req.companyId!, series, noteDate);
      db.prepare(
        `INSERT INTO credit_notes (
          id, company_id, note_type, note_number, financial_year, note_date, customer_id, invoice_id, reason,
          place_of_supply_state_code, is_interstate, taxable_value, total_cgst, total_sgst, total_igst,
          round_off, grand_total, status, notes, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'issued',?,?)`
      ).run(
        id,
        req.companyId,
        body.noteType,
        noteNumber,
        fy,
        body.noteDate,
        body.customerId,
        body.invoiceId || null,
        body.reason || null,
        placeOfSupply,
        isInterstate ? 1 : 0,
        totals.taxableValue,
        totals.totalCgst,
        totals.totalSgst,
        totals.totalIgst,
        totals.roundOff,
        totals.grandTotal,
        body.notes || null,
        req.user!.id
      );

      const insertItem = db.prepare(
        `INSERT INTO credit_note_items (
          id, credit_note_id, item_id, description, hsn_sac_code, qty, unit, rate,
          taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      body.lineItems.forEach((l, idx) => {
        const t = taxedLines[idx];
        insertItem.run(
          newId(),
          id,
          l.itemId || null,
          l.description,
          l.hsnSacCode || null,
          l.qty,
          l.unit || 'NOS',
          l.rate,
          t.taxableValue,
          l.gstRate,
          t.cgstAmount,
          t.sgstAmount,
          t.igstAmount,
          t.lineTotal
        );
      });
    });
    tx();

    const row = db.prepare(`SELECT * FROM credit_notes WHERE id = ?`).get(id);
    res.status(201).json(rowToNote(row));
  })
);

creditNotesRouter.post(
  '/:id/cancel',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = db.prepare(`SELECT * FROM credit_notes WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId);
    if (!current) throw new ApiError(404, 'Note not found');
    db.prepare(`UPDATE credit_notes SET status = 'cancelled' WHERE id = ? AND company_id = ?`).run(req.params.id, req.companyId);
    res.json({ status: 'cancelled' });
  })
);
