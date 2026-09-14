import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import * as XLSX from 'xlsx';
import { db, type DbLike } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { validateGSTIN, round2 } from '../services/gst.service.js';

/**
 * @swagger
 * tags:
 *   - name: Customers
 *     description: Customer management endpoints
 */

export const customersRouter = Router({ mergeParams: true });

const customerSchema = z.object({
  name: z.string().min(1),
  group: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  phone: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  shippingAddress: z.string().optional().nullable(),
  creditLimit: z.number().optional(),
  openingBalance: z.number().optional(),
  receivableBalance: z.number().optional(),
  payableBalance: z.number().optional(),
  notes: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

function rowToCustomer(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    group: row.customer_group ?? null,
    gstin: row.gstin,
    pan: row.pan,
    email: row.email,
    phone: row.phone,
    billingAddress: row.billing_address,
    shippingAddress: row.shipping_address,
    creditLimit: row.credit_limit,
    openingBalance: row.opening_balance,
    receivableBalance: row.receivable_balance ?? 0,
    payableBalance: row.payable_balance ?? 0,
    notes: row.notes,
    isActive: !!row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * @swagger
 * /api/companies/{companyId}/customers:
 *   get:
 *     tags:
 *       - Customers
 *     summary: List all customers
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *       - name: group
 *         in: query
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of customers
 */
customersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const search = (req.query.search as string) || '';
    const group = (req.query.group as string) || '';
    const params: string[] = [req.companyId!];
    let where = 'company_id = ?';
    if (group) {
      where += ' AND customer_group = ?';
      params.push(group);
    }
    if (search) {
      where += ' AND (name LIKE ? OR gstin LIKE ? OR email LIKE ? OR customer_group LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    const rows = await db
      .prepare(`SELECT * FROM customers WHERE ${where} ORDER BY name`)
      .all(...params);
    res.json(rows.map(rowToCustomer));
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/customers/groups:
 *   get:
 *     tags:
 *       - Customers
 *     summary: List distinct customer groups
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Distinct customer groups
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 */
customersRouter.get(
  '/groups',
  asyncHandler(async (req, res) => {
    const rows = (await db
      .prepare(
        `SELECT DISTINCT customer_group FROM customers WHERE company_id = ? AND customer_group IS NOT NULL AND customer_group != '' ORDER BY customer_group`
      )
      .all(req.companyId)) as Array<{ customer_group: string }>;
    res.json(rows.map((r) => r.customer_group));
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/customers/{id}:
 *   get:
 *     tags:
 *       - Customers
 *     summary: Get customer details
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer details with outstanding balance
 *       404:
 *         description: Customer not found
 */
customersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = await db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId);
    if (!row) throw new ApiError(404, 'Customer not found');

    const invoices = (await db
      .prepare(
        `SELECT id, invoice_number, invoice_date, grand_total, amount_paid, status FROM invoices
         WHERE customer_id = ? AND company_id = ? ORDER BY invoice_date DESC`
      )
      .all(req.params.id, req.companyId)) as any[];

    const outstanding = invoices.reduce((sum, inv) => {
      if (inv.status === 'cancelled') return sum;
      return sum + (inv.grand_total - inv.amount_paid);
    }, 0);

    res.json({
      ...rowToCustomer(row),
      outstandingBalance: outstanding,
      invoices: invoices.map((i) => ({
        id: i.id,
        invoiceNumber: i.invoice_number,
        invoiceDate: i.invoice_date,
        grandTotal: i.grand_total,
        amountPaid: i.amount_paid,
        status: i.status,
      })),
    });
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/customers:
 *   post:
 *     tags:
 *       - Customers
 *     summary: Create a new customer
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Customer created
 *       400:
 *         description: Invalid GSTIN
 */
customersRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = customerSchema.parse(req.body);
    if (body.gstin) {
      const v = validateGSTIN(body.gstin);
      if (!v.valid) throw new ApiError(400, `Invalid GSTIN: ${v.reason}`);
    }
    const id = newId();
    await db.prepare(
      `INSERT INTO customers (
        id, company_id, name, customer_group, gstin, pan, email, phone,
        billing_address, shipping_address,
        credit_limit, opening_balance, receivable_balance, payable_balance, notes
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      req.companyId,
      body.name,
      body.group || null,
      body.gstin || null,
      body.pan || null,
      body.email || null,
      body.phone || null,
      body.billingAddress || null,
      body.shippingAddress || null,
      body.creditLimit || 0,
      body.openingBalance || 0,
      body.receivableBalance || 0,
      body.payableBalance || 0,
      body.notes || null
    );
    const row = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(id);
    res.status(201).json(rowToCustomer(row));
  })
);

// ---------------------------------------------------------------------------
// Customer import from Excel / CSV files
// ---------------------------------------------------------------------------

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const normalizeHeader = (s: string) => s.toLowerCase().replace(/[\s_\-.()/]+/g, '');

function pick(row: Record<string, unknown>, ...aliases: string[]) {
  const keys = Object.keys(row);
  const normalized = keys.map(normalizeHeader);
  for (const alias of aliases) {
    const target = normalizeHeader(alias);
    const idx = normalized.indexOf(target);
    if (idx >= 0) return row[keys[idx]];
  }
  return undefined;
}

function str(v: unknown): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

function maybeNumber(v: unknown): number | null {
  if (v === undefined || v === null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim().replace(/[₹,\s]/g, '');
  if (/^\(.*\)$/.test(s)) s = '-' + s.slice(1, -1);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapImportRow(row: Record<string, unknown>) {
  return {
    name: str(pick(row, 'name', 'customer', 'customer name', 'customer_name', 'business name', 'business', 'company', 'company name', 'party')),
    group: str(pick(row, 'group', 'customer group', 'customer_group', 'segment', 'category', 'account group')),
    gstin: str(pick(row, 'gstin', 'gst', 'gst no', 'gst number', 'gstin no', 'gst registration no', 'registration no', 'reg no', 'tax id', 'taxid')).toUpperCase(),
    pan: str(pick(row, 'pan', 'pan no', 'pan number')).toUpperCase(),
    email: str(pick(row, 'email', 'email address', 'e-mail', 'e mail', 'customer email')).toLowerCase(),
    phone: str(pick(row, 'phone', 'phone no', 'phone number', 'mobile', 'mobile no', 'mobile number', 'contact', 'contact no', 'contact number', 'telephone', 'tel')),
    billingAddress: str(pick(row, 'address', 'billing address', 'billing_address', 'bill to', 'street', 'street address', 'address line', 'address1', 'full address')),
    shippingAddress: str(pick(row, 'shipping address', 'shipping_address', 'ship to', 'delivery address', 'delivery_address', 'address2')),
    creditLimit: maybeNumber(pick(row, 'credit limit', 'credit_limit', 'creditlimit', 'credit', 'limit', 'credit amount')),
    openingBalance: maybeNumber(pick(row, 'opening balance', 'opening_balance', 'opening bal', 'balance b/f', 'balance brought forward')),
    receivableBalance: maybeNumber(pick(row, 'receivable balance', 'receivable_balance', 'receivable', 'receivable amount', 'accounts receivable', 'amount receivable', 'balance receivable', 'debit balance', 'outstanding balance')),
    payableBalance: maybeNumber(pick(row, 'payable balance', 'payable_balance', 'payable', 'payable amount', 'accounts payable', 'amount payable', 'balance payable', 'credit balance')),
    notes: str(pick(row, 'notes', 'note', 'remarks', 'comments', 'comment')),
  };
}

async function findExistingCustomer(
  companyId: string | undefined,
  data: ReturnType<typeof mapImportRow>,
  tx: DbLike = db
) {
  if (!data.gstin) return undefined;
  return (await tx.prepare(`SELECT * FROM customers WHERE gstin = ? AND company_id = ?`).get(data.gstin, companyId)) as any;
}

/**
 * @swagger
 * /api/companies/{companyId}/customers/import:
 *   post:
 *     tags:
 *       - Customers
 *     summary: Import customers from an Excel (.xlsx/.xls) or CSV file
 *     description: |
 *       Accepts a multipart "file". Supported columns: name (required), email,
 *       phone, address, gstin, receivable balance, payable balance, credit
 *       limit, opening balance, shipping address, pan, notes.
 *       GSTIN is used as the key: a customer with the same GSTIN is updated
 *       with the row's details, otherwise a new customer is created. Rows
 *       without a GSTIN are always created. Missing optional values are left
 *       empty.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Import result summary
 */
customersRouter.post(
  '/import',
  requireRole('admin', 'accountant'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) throw new ApiError(400, 'No file uploaded. Send a .csv, .xlsx or .xls file with field name "file".');

    let rows: Record<string, unknown>[] = [];
    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('empty sheet');
      rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];
    } catch {
      throw new ApiError(400, 'Could not parse the file. Upload a valid .csv, .xlsx or .xls file.');
    }
    if (rows.length === 0) throw new ApiError(400, 'No rows found in the file.');
    if (rows.length > 2000) throw new ApiError(400, 'File contains too many rows (max 2000).');

    const created: Array<{ row: number; name: string }> = [];
    const updatedRows: Array<{ row: number; id: string; name: string }> = [];
    const errors: Array<{ row: number; name: string; reason: string }> = [];

    await db.transaction(async (tx) => {
      for (const [index, rawRow] of rows.entries()) {
        const rowNumber = index + 2; // 1 for headers
        const data = mapImportRow(rawRow);

        if (!data.name) {
          errors.push({ row: rowNumber, name: '', reason: 'Name is required' });
          continue;
        }
        if (data.email && !EMAIL_RE.test(data.email)) {
          errors.push({ row: rowNumber, name: data.name, reason: `Invalid email "${data.email}"` });
          continue;
        }
        if (data.gstin) {
          const v = validateGSTIN(data.gstin);
          if (!v.valid) {
            errors.push({ row: rowNumber, name: data.name, reason: `Invalid GSTIN "${data.gstin}": ${v.reason}` });
            continue;
          }
        }

        const existing = await findExistingCustomer(req.companyId, data, tx);

        if (existing) {
          const merged = {
            name: data.name || existing.name,
            group: data.group || existing.customer_group,
            gstin: data.gstin || existing.gstin,
            pan: data.pan || existing.pan,
            email: data.email || existing.email,
            phone: data.phone || existing.phone,
            billing_address: data.billingAddress || existing.billing_address,
            shipping_address: data.shippingAddress || existing.shipping_address,
            credit_limit: data.creditLimit ?? existing.credit_limit,
            opening_balance: data.openingBalance ?? existing.opening_balance,
            receivable_balance: data.receivableBalance ?? existing.receivable_balance,
            payable_balance: data.payableBalance ?? existing.payable_balance,
            notes: data.notes || existing.notes,
          };
          await tx
            .prepare(
              `UPDATE customers SET name=?, customer_group=?, gstin=?, pan=?, email=?, phone=?, billing_address=?,
                shipping_address=?, credit_limit=?, opening_balance=?, receivable_balance=?, payable_balance=?,
                notes=?, updated_at=datetime('now')
               WHERE id=? AND company_id=?`
            )
            .run(
              merged.name, merged.group, merged.gstin, merged.pan, merged.email, merged.phone, merged.billing_address,
              merged.shipping_address, merged.credit_limit, merged.opening_balance, merged.receivable_balance,
              merged.payable_balance, merged.notes, existing.id, req.companyId
            );
          updatedRows.push({ row: rowNumber, id: existing.id, name: data.name });
          continue;
        }

        const id = newId();
        await tx
          .prepare(
            `INSERT INTO customers (id, company_id, name, customer_group, gstin, pan, email, phone, billing_address,
              shipping_address, credit_limit, opening_balance, receivable_balance, payable_balance, notes)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
          )
          .run(
            id,
            req.companyId,
            data.name,
            data.group || null,
            data.gstin || null,
            data.pan || null,
            data.email || null,
            data.phone || null,
            data.billingAddress || null,
            data.shippingAddress || null,
            data.creditLimit ?? 0,
            data.openingBalance ?? 0,
            data.receivableBalance ?? 0,
            data.payableBalance ?? 0,
            data.notes || null
          );
        created.push({ row: rowNumber, name: data.name });
      }
    });

    res.json({
      total: rows.length,
      created: created.length,
      updated: updatedRows.length,
      failed: errors.length,
      createdRows: created,
      updatedRows,
      errors,
    });
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/customers/{id}:
 *   patch:
 *     tags:
 *       - Customers
 *     summary: Update customer
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer updated
 *       404:
 *         description: Not found
 */
customersRouter.patch(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = customerSchema.partial().parse(req.body);
    if (body.gstin) {
      const v = validateGSTIN(body.gstin);
      if (!v.valid) throw new ApiError(400, `Invalid GSTIN: ${v.reason}`);
    }
    const current = (await db.prepare(`SELECT * FROM customers WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Customer not found');

    const m = {
      name: body.name ?? current.name,
      group: body.group ?? current.customer_group,
      gstin: body.gstin ?? current.gstin,
      pan: body.pan ?? current.pan,
      email: body.email ?? current.email,
      phone: body.phone ?? current.phone,
      billing_address: body.billingAddress ?? current.billing_address,
      shipping_address: body.shippingAddress ?? current.shipping_address,
      credit_limit: body.creditLimit ?? current.credit_limit,
      opening_balance: body.openingBalance ?? current.opening_balance,
      receivable_balance: body.receivableBalance ?? current.receivable_balance,
      payable_balance: body.payableBalance ?? current.payable_balance,
      notes: body.notes ?? current.notes,
      is_active: body.isActive === undefined ? current.is_active : body.isActive ? 1 : 0,
    };

    await db.prepare(
      `UPDATE customers SET name=?, customer_group=?, gstin=?, pan=?, email=?, phone=?, billing_address=?,
       shipping_address=?, credit_limit=?, opening_balance=?, receivable_balance=?, payable_balance=?,
       notes=?, is_active=?, updated_at=datetime('now')
       WHERE id=? AND company_id=?`
    ).run(
      m.name, m.group, m.gstin, m.pan, m.email, m.phone, m.billing_address, m.shipping_address,
      m.credit_limit, m.opening_balance, m.receivable_balance, m.payable_balance, m.notes, m.is_active,
      req.params.id, req.companyId
    );

    const row = await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(req.params.id);
    res.json(rowToCustomer(row));
  })
);

/**
 * @swagger
 * /api/companies/{companyId}/customers/{id}:
 *   delete:
 *     tags:
 *       - Customers
 *     summary: Delete or archive customer
 *     parameters:
 *       - name: companyId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Deleted
 *       200:
 *         description: Archived
 */
customersRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const used = (await db.prepare(`SELECT COUNT(*) as n FROM invoices WHERE customer_id = ? AND company_id = ?`).get(
      req.params.id,
      req.companyId
    )) as any;
    if (used.n > 0) {
      await db.prepare(`UPDATE customers SET is_active = 0, updated_at=datetime('now') WHERE id=? AND company_id=?`).run(
        req.params.id,
        req.companyId
      );
      return res.json({ archived: true });
    }
    await db.prepare(`DELETE FROM customers WHERE id = ? AND company_id = ?`).run(req.params.id, req.companyId);
    res.status(204).send();
  })
);
