import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

/**
 * @swagger
 * tags:
 *   - name: Preferences
 *     description: Company print & download design preferences
 */

export const preferencesRouter = Router({ mergeParams: true });

const DESIGN = ['classic', 'modern', 'minimal', 'vyapar'] as const;
const preferencesSchema = z.object({
  printDesign: z.enum(DESIGN).optional(),
  downloadDesign: z.enum(DESIGN).optional(),
  showBankName: z.boolean().optional(),
  showBankBranch: z.boolean().optional(),
  showBankAccountNo: z.boolean().optional(),
  showBankIfsc: z.boolean().optional(),
  showPaymentQr: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one preference must be provided');

function rowToPreferences(row: any) {
  return {
    printDesign: row.print_design,
    downloadDesign: row.download_design,
    showBankName: !!row.show_bank_name,
    showBankBranch: !!row.show_bank_branch,
    showBankAccountNo: !!row.show_bank_account_no,
    showBankIfsc: !!row.show_bank_ifsc,
    showPaymentQr: !!row.show_payment_qr,
    updatedAt: row.updated_at,
  };
}

async function getPreferencesRow(companyId: string) {
  let row = (await db.prepare(`SELECT * FROM company_preferences WHERE company_id = ?`).get(companyId)) as any;
  if (!row) {
    await db.prepare(`INSERT INTO company_preferences (company_id) VALUES (?)`).run(companyId);
    row = (await db.prepare(`SELECT * FROM company_preferences WHERE company_id = ?`).get(companyId)) as any;
  }
  return row;
}

preferencesRouter.get(
  '/',
  /**
   * @swagger
   * /api/companies/{companyId}/preferences:
   *   get:
   *     tags:
   *       - Preferences
   *     summary: Get the company's print/download and invoice account-display preferences
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Design preferences
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 printDesign:
   *                   type: string
   *                   enum: [classic, modern, minimal, vyapar]
   *                 downloadDesign:
   *                   type: string
   *                   enum: [classic, modern, minimal, vyapar]
   *       401:
   *         description: Unauthorized
   *       403:
   *         description: Not a member of this company
   */
  asyncHandler(async (req, res) => {
    const company = await db.prepare(`SELECT id FROM companies WHERE id = ?`).get(req.companyId);
    if (!company) throw new ApiError(404, 'Company not found');
    res.json(rowToPreferences(await getPreferencesRow(req.companyId!)));
  })
);

preferencesRouter.put(
  '/',
  /**
   * @swagger
   * /api/companies/{companyId}/preferences:
   *   put:
   *     tags:
   *       - Preferences
   *     summary: Update the company's print/download and account-display preferences
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               printDesign:
   *                 type: string
   *                 enum: [classic, modern, minimal, vyapar]
   *               downloadDesign:
   *                 type: string
   *                 enum: [classic, modern, minimal, vyapar]
   *               showBankName:
   *                 type: boolean
   *               showBankBranch:
   *                 type: boolean
   *               showBankAccountNo:
   *                 type: boolean
   *               showBankIfsc:
   *                 type: boolean
   *               showPaymentQr:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Updated preferences
   *       403:
   *         description: Requires admin role
   */
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = preferencesSchema.parse(req.body);
    const company = await db.prepare(`SELECT id FROM companies WHERE id = ?`).get(req.companyId);
    if (!company) throw new ApiError(404, 'Company not found');
    const current = await getPreferencesRow(req.companyId!);
    const next = {
      printDesign: body.printDesign ?? current.print_design,
      downloadDesign: body.downloadDesign ?? current.download_design,
      showBankName: body.showBankName ?? !!current.show_bank_name,
      showBankBranch: body.showBankBranch ?? !!current.show_bank_branch,
      showBankAccountNo: body.showBankAccountNo ?? !!current.show_bank_account_no,
      showBankIfsc: body.showBankIfsc ?? !!current.show_bank_ifsc,
      showPaymentQr: body.showPaymentQr ?? !!current.show_payment_qr,
    };
    await db.prepare(
      `INSERT INTO company_preferences (
         company_id, print_design, download_design, show_bank_name, show_bank_branch,
         show_bank_account_no, show_bank_ifsc, show_payment_qr, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(company_id) DO UPDATE SET
         print_design = excluded.print_design,
         download_design = excluded.download_design,
         show_bank_name = excluded.show_bank_name,
         show_bank_branch = excluded.show_bank_branch,
         show_bank_account_no = excluded.show_bank_account_no,
         show_bank_ifsc = excluded.show_bank_ifsc,
         show_payment_qr = excluded.show_payment_qr,
         updated_at = datetime('now')`
    ).run(
      req.companyId,
      next.printDesign,
      next.downloadDesign,
      Number(next.showBankName),
      Number(next.showBankBranch),
      Number(next.showBankAccountNo),
      Number(next.showBankIfsc),
      Number(next.showPaymentQr)
    );
    const row = await db.prepare(`SELECT * FROM company_preferences WHERE company_id = ?`).get(req.companyId);
    res.json(rowToPreferences(row));
  })
);