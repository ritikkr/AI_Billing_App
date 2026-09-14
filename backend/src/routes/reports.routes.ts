import { Router } from 'express';
import { db } from '../db/connection.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { round2 } from '../services/gst.service.js';

export const reportsRouter = Router({ mergeParams: true });

reportsRouter.get(
  '/dashboard',
  asyncHandler(async (req, res) => {
    const companyId = req.companyId;

    const totals = (await db
      .prepare(
        `SELECT
          COALESCE(SUM(CASE WHEN status != 'cancelled' AND status != 'draft' THEN grand_total ELSE 0 END), 0) as totalRevenue,
          COALESCE(SUM(CASE WHEN status NOT IN ('cancelled','draft','paid') THEN grand_total - amount_paid ELSE 0 END), 0) as outstanding,
          COALESCE(SUM(CASE WHEN status != 'cancelled' THEN total_cgst + total_sgst + total_igst ELSE 0 END), 0) as taxCollected,
          COUNT(CASE WHEN status != 'cancelled' THEN 1 END) as invoiceCount
         FROM invoices WHERE company_id = ?`
      )
      .get(companyId)) as any;

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const thisMonth = (await db
      .prepare(
        `SELECT COALESCE(SUM(grand_total), 0) as total FROM invoices
         WHERE company_id = ? AND status != 'cancelled' AND status != 'draft' AND invoice_date >= ?`
      )
      .get(companyId, monthStart)) as any;

    const topCustomers = (await db
      .prepare(
        `SELECT c.id, c.name, COALESCE(SUM(i.grand_total), 0) as total, COUNT(i.id) as invoiceCount
         FROM customers c JOIN invoices i ON i.customer_id = c.id AND i.status != 'cancelled'
         WHERE c.company_id = ? GROUP BY c.id ORDER BY total DESC LIMIT 5`
      )
      .all(companyId)) as any[];

    const recentInvoices = (await db
      .prepare(
        `SELECT i.id, i.invoice_number as invoiceNumber, i.invoice_date as invoiceDate, i.grand_total as grandTotal,
                i.status, c.name as customerName
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE i.company_id = ? ORDER BY i.created_at DESC LIMIT 8`
      )
      .all(companyId)) as any[];

    const revenueTrend = (await db
      .prepare(
        `SELECT substr(invoice_date, 1, 7) as month, COALESCE(SUM(grand_total), 0) as total
         FROM invoices WHERE company_id = ? AND status != 'cancelled' AND status != 'draft'
         GROUP BY month ORDER BY month DESC LIMIT 12`
      )
      .all(companyId)) as any[];

    const customerCount = (await db.prepare(`SELECT COUNT(*) as n FROM customers WHERE company_id = ? AND is_active = 1`).get(companyId)) as any;
    const itemCount = (await db.prepare(`SELECT COUNT(*) as n FROM items WHERE company_id = ? AND is_active = 1`).get(companyId)) as any;

    res.json({
      totalRevenue: round2(totals.totalRevenue),
      outstanding: round2(totals.outstanding),
      taxCollected: round2(totals.taxCollected),
      invoiceCount: totals.invoiceCount,
      thisMonthRevenue: round2(thisMonth.total),
      customerCount: customerCount.n,
      itemCount: itemCount.n,
      topCustomers,
      recentInvoices,
      revenueTrend: revenueTrend.reverse(),
    });
  })
);

reportsRouter.get(
  '/sales-register',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const clauses = ['i.company_id = ?', "i.status != 'cancelled'"];
    const params: any[] = [req.companyId];
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
        `SELECT i.invoice_number as invoiceNumber, i.invoice_date as invoiceDate, c.name as customerName, c.gstin,
                i.place_of_supply_state_code as placeOfSupply, i.is_interstate as isInterstate,
                i.taxable_value as taxableValue, i.total_cgst as cgst, i.total_sgst as sgst, i.total_igst as igst,
                i.grand_total as grandTotal, i.status
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE ${clauses.join(' AND ')} ORDER BY i.invoice_date`
      )
      .all(...params)) as any[];
    res.json(rows);
  })
);

reportsRouter.get(
  '/gst-summary',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const clauses = ["i.company_id = ?", "i.status != 'cancelled'"];
    const params: any[] = [req.companyId];
    if (from) {
      clauses.push('i.invoice_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('i.invoice_date <= ?');
      params.push(to);
    }
    const byRate = (await db
      .prepare(
        `SELECT ii.gst_rate as gstRate,
                COALESCE(SUM(ii.taxable_value), 0) as taxableValue,
                COALESCE(SUM(ii.cgst_amount), 0) as cgst,
                COALESCE(SUM(ii.sgst_amount), 0) as sgst,
                COALESCE(SUM(ii.igst_amount), 0) as igst
         FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
         WHERE ${clauses.join(' AND ')} GROUP BY ii.gst_rate ORDER BY ii.gst_rate`
      )
      .all(...params)) as any[];

    const b2bVsB2c = (await db
      .prepare(
        `SELECT CASE WHEN c.gstin IS NOT NULL AND c.gstin != '' THEN 'B2B' ELSE 'B2C' END as segment,
                COUNT(DISTINCT i.id) as invoiceCount,
                COALESCE(SUM(i.grand_total), 0) as total
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE ${clauses.join(' AND ')} GROUP BY segment`
      )
      .all(...params)) as any[];

    res.json({ byRate, b2bVsB2c });
  })
);

reportsRouter.get(
  '/hsn-summary',
  asyncHandler(async (req, res) => {
    const { from, to } = req.query as Record<string, string>;
    const clauses = ["i.company_id = ?", "i.status != 'cancelled'"];
    const params: any[] = [req.companyId];
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
        `SELECT COALESCE(NULLIF(ii.hsn_sac_code, ''), 'N/A') as hsnSacCode, ii.unit,
                COALESCE(SUM(ii.qty), 0) as totalQty,
                COALESCE(SUM(ii.taxable_value), 0) as taxableValue,
                COALESCE(SUM(ii.cgst_amount), 0) as cgst,
                COALESCE(SUM(ii.sgst_amount), 0) as sgst,
                COALESCE(SUM(ii.igst_amount), 0) as igst,
                COALESCE(SUM(ii.line_total), 0) as total
         FROM invoice_items ii JOIN invoices i ON i.id = ii.invoice_id
         WHERE ${clauses.join(' AND ')} GROUP BY hsnSacCode, ii.unit ORDER BY total DESC`
      )
      .all(...params)) as any[];
    res.json(rows);
  })
);

reportsRouter.get(
  '/aging',
  asyncHandler(async (req, res) => {
    const rows = (await db
      .prepare(
        `SELECT i.id, i.invoice_number as invoiceNumber, i.invoice_date as invoiceDate, i.due_date as dueDate,
                c.id as customerId, c.name as customerName, (i.grand_total - i.amount_paid) as balanceDue
         FROM invoices i JOIN customers c ON c.id = i.customer_id
         WHERE i.company_id = ? AND i.status NOT IN ('cancelled', 'draft', 'paid')`
      )
      .all(req.companyId)) as any[];

    const today = new Date();
    const buckets: Record<string, { customerId: string; customerName: string; current: number; d30: number; d60: number; d90: number; over90: number; total: number }> = {};

    for (const row of rows) {
      const dueDate = row.dueDate ? new Date(row.dueDate) : new Date(row.invoiceDate);
      const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      if (!buckets[row.customerId]) {
        buckets[row.customerId] = { customerId: row.customerId, customerName: row.customerName, current: 0, d30: 0, d60: 0, d90: 0, over90: 0, total: 0 };
      }
      const b = buckets[row.customerId];
      const amt = round2(row.balanceDue);
      if (daysOverdue <= 0) b.current += amt;
      else if (daysOverdue <= 30) b.d30 += amt;
      else if (daysOverdue <= 60) b.d60 += amt;
      else if (daysOverdue <= 90) b.d90 += amt;
      else b.over90 += amt;
      b.total += amt;
    }

    res.json(Object.values(buckets).sort((a, b) => b.total - a.total));
  })
);
