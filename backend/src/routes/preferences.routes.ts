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
  printDesign: z.enum(DESIGN),
  downloadDesign: z.enum(DESIGN),
});

function rowToPreferences(row: any) {
  return {
    printDesign: row.print_design,
    downloadDesign: row.download_design,
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
   *     summary: Get the company's print/download design preferences
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
   *     summary: Update the company's print/download design preferences
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [printDesign, downloadDesign]
   *             properties:
   *               printDesign:
   *                 type: string
   *                 enum: [classic, modern, minimal, vyapar]
   *               downloadDesign:
   *                 type: string
   *                 enum: [classic, modern, minimal, vyapar]
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
    await db.prepare(
      `INSERT INTO company_preferences (company_id, print_design, download_design, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(company_id) DO UPDATE SET
         print_design = excluded.print_design,
         download_design = excluded.download_design,
         updated_at = datetime('now')`
    ).run(req.companyId, body.printDesign, body.downloadDesign);
    const row = await db.prepare(`SELECT * FROM company_preferences WHERE company_id = ?`).get(req.companyId);
    res.json(rowToPreferences(row));
  })
);