import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireAuth, requireCompany, requireRole } from '../middleware/auth.js';
import { validateGSTIN } from '../services/gst.service.js';
import { hashPassword } from '../utils/password.js';

/**
 * @swagger
 * tags:
 *   - name: Companies
 *     description: Company management endpoints
 */

export const companiesRouter = Router();
companiesRouter.use(requireAuth);

const companySchema = z.object({
  name: z.string().min(1),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  addressLine1: z.string().optional().nullable(),
  addressLine2: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().min(1),
  stateCode: z.string().length(2),
  pincode: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal('')),
  bankName: z.string().optional().nullable(),
  bankAccountNo: z.string().optional().nullable(),
  bankIfsc: z.string().optional().nullable(),
  bankBranch: z.string().optional().nullable(),
  invoicePrefix: z.string().optional(),
  creditNotePrefix: z.string().optional(),
  debitNotePrefix: z.string().optional(),
  financialYearStartMonth: z.number().int().min(1).max(12).optional(),
  logoUrl: z.string().optional().nullable(),
  termsAndConditions: z.string().optional().nullable(),
});

function rowToCompany(row: any) {
  if (!row) return row;
  return {
    id: row.id,
    name: row.name,
    gstin: row.gstin,
    pan: row.pan,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    state: row.state,
    stateCode: row.state_code,
    pincode: row.pincode,
    phone: row.phone,
    email: row.email,
    bankName: row.bank_name,
    bankAccountNo: row.bank_account_no,
    bankIfsc: row.bank_ifsc,
    bankBranch: row.bank_branch,
    invoicePrefix: row.invoice_prefix,
    creditNotePrefix: row.credit_note_prefix,
    debitNotePrefix: row.debit_note_prefix,
    financialYearStartMonth: row.financial_year_start_month,
    logoUrl: row.logo_url,
    termsAndConditions: row.terms_and_conditions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

companiesRouter.get(
  '/',
  /**
   * @swagger
   * /api/companies:
   *   get:
   *     tags:
   *       - Companies
   *     summary: List all companies for current user
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: List of companies
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 allOf:
   *                   - $ref: '#/components/schemas/Company'
   *                   - type: object
   *                     properties:
   *                       myRole:
   *                         type: string
   *                         enum: [admin, accountant, viewer]
   *       401:
   *         description: Unauthorized
   */
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, ucr.role as my_role FROM companies c
         JOIN user_company_roles ucr ON ucr.company_id = c.id
         WHERE ucr.user_id = ? ORDER BY c.name`
      )
      .all(req.user!.id) as any[];
    res.json(rows.map((r) => ({ ...rowToCompany(r), myRole: r.my_role })));
  })
);

companiesRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = companySchema.parse(req.body);
    if (body.gstin) {
      const v = validateGSTIN(body.gstin);
      if (!v.valid) throw new ApiError(400, `Invalid GSTIN: ${v.reason}`);
    }
    const id = newId();
    db.prepare(
      `INSERT INTO companies (
        id, name, gstin, pan, address_line1, address_line2, city, state, state_code, pincode,
        phone, email, bank_name, bank_account_no, bank_ifsc, bank_branch,
        invoice_prefix, credit_note_prefix, debit_note_prefix, financial_year_start_month,
        logo_url, terms_and_conditions, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      id,
      body.name,
      body.gstin || null,
      body.pan || null,
      body.addressLine1 || null,
      body.addressLine2 || null,
      body.city || null,
      body.state,
      body.stateCode,
      body.pincode || null,
      body.phone || null,
      body.email || null,
      body.bankName || null,
      body.bankAccountNo || null,
      body.bankIfsc || null,
      body.bankBranch || null,
      body.invoicePrefix || 'INV',
      body.creditNotePrefix || 'CN',
      body.debitNotePrefix || 'DN',
      body.financialYearStartMonth || 4,
      body.logoUrl || null,
      body.termsAndConditions || null,
      req.user!.id
    );
    db.prepare(`INSERT INTO user_company_roles (id, user_id, company_id, role) VALUES (?, ?, ?, 'admin')`).run(
      newId(),
      req.user!.id,
      id
    );
    const row = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(id);
    res.status(201).json({ ...rowToCompany(row), myRole: 'admin' });
  })
);

companiesRouter.get(
  '/:companyId',
  requireCompany,
  asyncHandler(async (req, res) => {
    const row = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId);
    res.json({ ...rowToCompany(row), myRole: req.companyRole });
  })
);

companiesRouter.patch(
  '/:companyId',
  requireCompany,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = companySchema.partial().parse(req.body);
    if (body.gstin) {
      const v = validateGSTIN(body.gstin);
      if (!v.valid) throw new ApiError(400, `Invalid GSTIN: ${v.reason}`);
    }
    const current = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId) as any;
    if (!current) throw new ApiError(404, 'Company not found');

    const merged = {
      name: body.name ?? current.name,
      gstin: body.gstin ?? current.gstin,
      pan: body.pan ?? current.pan,
      address_line1: body.addressLine1 ?? current.address_line1,
      address_line2: body.addressLine2 ?? current.address_line2,
      city: body.city ?? current.city,
      state: body.state ?? current.state,
      state_code: body.stateCode ?? current.state_code,
      pincode: body.pincode ?? current.pincode,
      phone: body.phone ?? current.phone,
      email: body.email ?? current.email,
      bank_name: body.bankName ?? current.bank_name,
      bank_account_no: body.bankAccountNo ?? current.bank_account_no,
      bank_ifsc: body.bankIfsc ?? current.bank_ifsc,
      bank_branch: body.bankBranch ?? current.bank_branch,
      invoice_prefix: body.invoicePrefix ?? current.invoice_prefix,
      credit_note_prefix: body.creditNotePrefix ?? current.credit_note_prefix,
      debit_note_prefix: body.debitNotePrefix ?? current.debit_note_prefix,
      financial_year_start_month: body.financialYearStartMonth ?? current.financial_year_start_month,
      logo_url: body.logoUrl ?? current.logo_url,
      terms_and_conditions: body.termsAndConditions ?? current.terms_and_conditions,
    };

    db.prepare(
      `UPDATE companies SET name=?, gstin=?, pan=?, address_line1=?, address_line2=?, city=?, state=?, state_code=?,
       pincode=?, phone=?, email=?, bank_name=?, bank_account_no=?, bank_ifsc=?, bank_branch=?,
       invoice_prefix=?, credit_note_prefix=?, debit_note_prefix=?, financial_year_start_month=?,
       logo_url=?, terms_and_conditions=?, updated_at=datetime('now') WHERE id=?`
    ).run(
      merged.name, merged.gstin, merged.pan, merged.address_line1, merged.address_line2, merged.city,
      merged.state, merged.state_code, merged.pincode, merged.phone, merged.email, merged.bank_name,
      merged.bank_account_no, merged.bank_ifsc, merged.bank_branch, merged.invoice_prefix,
      merged.credit_note_prefix, merged.debit_note_prefix, merged.financial_year_start_month,
      merged.logo_url, merged.terms_and_conditions, req.companyId
    );

    const row = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId);
    res.json({ ...rowToCompany(row), myRole: req.companyRole });
  })
);

// ---- Company user/role management ----

companiesRouter.get(
  '/:companyId/users',
  requireCompany,
  asyncHandler(async (req, res) => {
    const rows = db
      .prepare(
        `SELECT u.id, u.name, u.email, ucr.role FROM user_company_roles ucr
         JOIN users u ON u.id = ucr.user_id WHERE ucr.company_id = ? ORDER BY u.name`
      )
      .all(req.companyId);
    res.json(rows);
  })
);

const addUserSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'accountant', 'viewer']),
});

companiesRouter.post(
  '/:companyId/users',
  requireCompany,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = addUserSchema.parse(req.body);
    let user = db.prepare(`SELECT * FROM users WHERE email = ?`).get(body.email.toLowerCase()) as any;

    if (!user) {
      if (!body.name || !body.password) {
        throw new ApiError(400, 'name and password are required to create a new user for this email');
      }
      const id = newId();
      const passwordHash = await hashPassword(body.password);
      db.prepare(`INSERT INTO users (id, name, email, password_hash) VALUES (?, ?, ?, ?)`).run(
        id,
        body.name,
        body.email.toLowerCase(),
        passwordHash
      );
      user = { id, name: body.name, email: body.email.toLowerCase() };
    }

    const existingMembership = db
      .prepare(`SELECT id FROM user_company_roles WHERE user_id = ? AND company_id = ?`)
      .get(user.id, req.companyId);
    if (existingMembership) throw new ApiError(409, 'This user already has access to the company');

    db.prepare(`INSERT INTO user_company_roles (id, user_id, company_id, role) VALUES (?, ?, ?, ?)`).run(
      newId(),
      user.id,
      req.companyId,
      body.role
    );

    res.status(201).json({ id: user.id, name: user.name, email: user.email, role: body.role });
  })
);

const updateRoleSchema = z.object({ role: z.enum(['admin', 'accountant', 'viewer']) });

companiesRouter.patch(
  '/:companyId/users/:userId',
  requireCompany,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const { role } = updateRoleSchema.parse(req.body);
    const membership = db
      .prepare(`SELECT * FROM user_company_roles WHERE user_id = ? AND company_id = ?`)
      .get(req.params.userId, req.companyId) as any;
    if (!membership) throw new ApiError(404, 'Membership not found');

    if (membership.role === 'admin' && role !== 'admin') {
      const adminCount = db
        .prepare(`SELECT COUNT(*) as n FROM user_company_roles WHERE company_id = ? AND role = 'admin'`)
        .get(req.companyId) as any;
      if (adminCount.n <= 1) throw new ApiError(400, 'Cannot demote the last remaining admin');
    }

    db.prepare(`UPDATE user_company_roles SET role = ? WHERE user_id = ? AND company_id = ?`).run(
      role,
      req.params.userId,
      req.companyId
    );
    res.json({ userId: req.params.userId, role });
  })
);

companiesRouter.delete(
  '/:companyId/users/:userId',
  requireCompany,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const membership = db
      .prepare(`SELECT * FROM user_company_roles WHERE user_id = ? AND company_id = ?`)
      .get(req.params.userId, req.companyId) as any;
    if (!membership) throw new ApiError(404, 'Membership not found');

    if (membership.role === 'admin') {
      const adminCount = db
        .prepare(`SELECT COUNT(*) as n FROM user_company_roles WHERE company_id = ? AND role = 'admin'`)
        .get(req.companyId) as any;
      if (adminCount.n <= 1) throw new ApiError(400, 'Cannot remove the last remaining admin');
    }

    db.prepare(`DELETE FROM user_company_roles WHERE user_id = ? AND company_id = ?`).run(req.params.userId, req.companyId);
    res.status(204).send();
  })
);
