import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { round2 } from '../services/gst.service.js';
import { PAYMENT_MODES } from '../services/gst.constants.js';

export const paymentsRouter = Router({ mergeParams: true });

const paymentSchema = z.object({
  invoiceId: z.string().min(1),
  paymentDate: z.string().min(1),
  amount: z.number().positive(),
  paymentMode: z.enum(PAYMENT_MODES as unknown as [string, ...string[]]).optional(),
  referenceNo: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

function recomputeInvoiceStatus(invoiceId: string, companyId: string) {
  const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(invoiceId, companyId) as any;
  if (!invoice) return;
  const paid = db.prepare(`SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE invoice_id = ?`).get(invoiceId) as any;
  const amountPaid = round2(paid.total);
  let status = invoice.status;
  if (status !== 'cancelled' && status !== 'draft') {
    if (amountPaid <= 0) status = 'sent';
    else if (amountPaid >= invoice.grand_total) status = 'paid';
    else status = 'partially_paid';
  }
  db.prepare(`UPDATE invoices SET amount_paid = ?, status = ?, updated_at = datetime('now') WHERE id = ?`).run(
    amountPaid,
    status,
    invoiceId
  );
}

function rowToPayment(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    invoiceId: row.invoice_id,
    paymentDate: row.payment_date,
    amount: row.amount,
    paymentMode: row.payment_mode,
    referenceNo: row.reference_no,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

paymentsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { invoiceId, from, to } = req.query as Record<string, string>;
    const clauses = ['p.company_id = ?'];
    const params: any[] = [req.companyId];
    if (invoiceId) {
      clauses.push('p.invoice_id = ?');
      params.push(invoiceId);
    }
    if (from) {
      clauses.push('p.payment_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('p.payment_date <= ?');
      params.push(to);
    }
    const rows = db
      .prepare(
        `SELECT p.*, i.invoice_number, c.name as customer_name FROM payments p
         JOIN invoices i ON i.id = p.invoice_id JOIN customers c ON c.id = i.customer_id
         WHERE ${clauses.join(' AND ')} ORDER BY p.payment_date DESC, p.created_at DESC`
      )
      .all(...params) as any[];
    res.json(rows.map((r) => ({ ...rowToPayment(r), invoiceNumber: r.invoice_number, customerName: r.customer_name })));
  })
);

paymentsRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = paymentSchema.parse(req.body);
    const invoice = db.prepare(`SELECT * FROM invoices WHERE id = ? AND company_id = ?`).get(body.invoiceId, req.companyId) as any;
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'cancelled') throw new ApiError(400, 'Cannot record a payment against a cancelled invoice');
    if (invoice.status === 'draft') throw new ApiError(400, 'Mark the invoice as sent before recording payments');

    const balanceDue = round2(invoice.grand_total - invoice.amount_paid);
    if (body.amount - balanceDue > 0.01) {
      throw new ApiError(400, `Payment amount exceeds balance due (₹${balanceDue.toFixed(2)})`);
    }

    const id = newId();
    const tx = db.transaction(() => {
      db.prepare(
        `INSERT INTO payments (id, company_id, invoice_id, payment_date, amount, payment_mode, reference_no, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?)`
      ).run(
        id,
        req.companyId,
        body.invoiceId,
        body.paymentDate,
        body.amount,
        body.paymentMode || 'bank_transfer',
        body.referenceNo || null,
        body.notes || null,
        req.user!.id
      );
      recomputeInvoiceStatus(body.invoiceId, req.companyId!);
    });
    tx();

    const row = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id);
    res.status(201).json(rowToPayment(row));
  })
);

paymentsRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const payment = db.prepare(`SELECT * FROM payments WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId) as any;
    if (!payment) throw new ApiError(404, 'Payment not found');
    const tx = db.transaction(() => {
      db.prepare(`DELETE FROM payments WHERE id = ?`).run(req.params.id);
      recomputeInvoiceStatus(payment.invoice_id, req.companyId!);
    });
    tx();
    res.status(204).send();
  })
);
