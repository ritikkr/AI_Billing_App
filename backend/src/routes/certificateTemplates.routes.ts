import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';

export const certificateTemplatesRouter = Router({ mergeParams: true });

const templateSchema = z.object({
  name: z.string().min(1),
  subject: z.string().min(1),
  body: z.string().min(1),
});

function rowToTemplate(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    subject: row.subject,
    body: row.body,
    isDefault: !!row.is_default,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** System-level defaults have company_id IS NULL; company templates are scoped. */
function companyScopeClause(alias: string, includeDefaults = true) {
  if (includeDefaults) return `(${alias}.company_id = ? OR ${alias}.company_id IS NULL)`;
  return `${alias}.company_id = ?`;
}

certificateTemplatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = (await db
      .prepare(
        `SELECT * FROM certificate_templates WHERE (company_id = ? OR company_id IS NULL)
         ORDER BY company_id IS NULL DESC, name ASC`
      )
      .all(req.companyId)) as any[];
    res.json(rows.map(rowToTemplate));
  })
);

certificateTemplatesRouter.post(
  '/',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);
    const id = newId();
    await db
      .prepare(`INSERT INTO certificate_templates (id, company_id, name, subject, body, is_default) VALUES (?, ?, ?, ?, ?, 0)`)
      .run(id, req.companyId, body.name, body.subject, body.body);
    const row = await db.prepare(`SELECT * FROM certificate_templates WHERE id = ?`).get(id);
    res.status(201).json(rowToTemplate(row));
  })
);

certificateTemplatesRouter.patch(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const body = templateSchema.partial().parse(req.body);
    const current = (await db
      .prepare(`SELECT * FROM certificate_templates WHERE id = ? AND company_id = ?`)
      .get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Template not found');

    await db
      .prepare(
        `UPDATE certificate_templates
         SET name = COALESCE(?, name), subject = COALESCE(?, subject), body = COALESCE(?, body),
             updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(body.name ?? null, body.subject ?? null, body.body ?? null, req.params.id);
    const row = await db.prepare(`SELECT * FROM certificate_templates WHERE id = ?`).get(req.params.id);
    res.json(rowToTemplate(row));
  })
);

certificateTemplatesRouter.delete(
  '/:id',
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const current = await db
      .prepare(`SELECT * FROM certificate_templates WHERE id = ? AND company_id = ?`)
      .get(req.params.id, req.companyId);
    if (!current) throw new ApiError(404, 'Template not found');
    await db.prepare(`DELETE FROM certificate_templates WHERE id = ?`).run(req.params.id);
    res.json({ deleted: true });
  })
);