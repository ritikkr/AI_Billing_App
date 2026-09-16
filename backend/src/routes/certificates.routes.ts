import { Router } from 'express';
import { z } from 'zod';
import { db, type DbLike } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { nextDocumentNumber, financialYearLabel } from '../services/numbering.service.js';

export const certificatesRouter = Router({ mergeParams: true });

const certificateSchema = z.object({
  templateId: z.string().optional().nullable(),
  certificateDate: z.string().min(1),
  customerId: z.string().optional().nullable(),
  outletName: z.string().optional().nullable(),
  outletAddress: z.string().optional().nullable(),
  serviceDate: z.string().optional().nullable(),
  serviceType: z.string().optional().nullable(),
  validFrom: z.string().optional().nullable(),
  validUntil: z.string().optional().nullable(),
  customFields: z.record(z.string()).optional(),
  notes: z.string().optional().nullable(),
  issuedBy: z.string().optional().nullable(),
});

function rowToCertificate(row: any) {
  return {
    id: row.id,
    companyId: row.company_id,
    certificateNumber: row.certificate_number,
    financialYear: row.financial_year,
    templateId: row.template_id,
    certificateDate: row.certificate_date,
    customerId: row.customer_id,
    outletName: row.outlet_name,
    outletAddress: row.outlet_address,
    serviceDate: row.service_date,
    serviceType: row.service_type,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    customFields: row.custom_fields ? JSON.parse(row.custom_fields) : null,
    notes: row.notes,
    status: row.status,
    issuedBy: row.issued_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

certificatesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { status, customerId, search, from, to } = req.query as Record<string, string>;
    const clauses = ['c.company_id = ?'];
    const params: any[] = [req.companyId];

    if (status) {
      clauses.push('c.status = ?');
      params.push(status);
    }
    if (customerId) {
      clauses.push('c.customer_id = ?');
      params.push(customerId);
    }
    if (search) {
      clauses.push('(c.certificate_number LIKE ? OR c.outlet_name LIKE ? OR c.service_type LIKE ? OR cust.name LIKE ?)');
      const like = `%${search}%`;
      params.push(like, like, like, like);
    }
    if (from) {
      clauses.push('c.certificate_date >= ?');
      params.push(from);
    }
    if (to) {
      clauses.push('c.certificate_date <= ?');
      params.push(to);
    }

    const rows = (await db
      .prepare(
        `SELECT c.*, cust.name AS customer_name, t.name AS template_name
         FROM certificates c
         LEFT JOIN customers cust ON cust.id = c.customer_id
         LEFT JOIN certificate_templates t ON t.id = c.template_id
         WHERE ${clauses.join(' AND ')}
         ORDER BY c.certificate_date DESC, c.created_at DESC`
      )
      .all(...params)) as any[];

    res.json(
      rows.map((r) => ({
        ...rowToCertificate(r),
        customerName: r.customer_name,
        templateName: r.template_name,
      }))
    );
  })
);

certificatesRouter.get(
  '/next-number',
  asyncHandler(async (req, res) => {
    const { date } = req.query as Record<string, string>;
    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    const docDate = date ? new Date(date) : new Date();
    const fy = financialYearLabel(docDate, company.financial_year_start_month || 4);
    const prefix = company.certificate_prefix || 'CERT';

    const last = (await db
      .prepare(`SELECT last_number FROM invoice_counters WHERE company_id = ? AND financial_year = ? AND series = 'certificate'`)
      .get(req.companyId, fy)) as any;
    const next = (last?.last_number ?? 0) + 1;

    res.json({ certificateNumber: `${prefix}/${fy}/${String(next).padStart(4, '0')}`, financialYear: fy, certificateDate: docDate.toISOString().slice(0, 10) });
  })
);

certificatesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const row = (await db.prepare(`SELECT * FROM certificates WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!row) throw new ApiError(404, 'Certificate not found');

    const customer = row.customer_id ? await db.prepare(`SELECT * FROM customers WHERE id = ?`).get(row.customer_id) : null;
    const company = await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(row.company_id);
    const template = row.template_id ? await db.prepare(`SELECT * FROM certificate_templates WHERE id = ?`).get(row.template_id) : null;

    res.json({
      ...rowToCertificate(row),
      customer: customer || null,
      company,
      template: template ? { id: template.id, name: template.name, subject: template.subject, body: template.body, isDefault: !!template.is_default } : null,
    });
  })
);

certificatesRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = certificateSchema.parse(req.body);
    const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(req.companyId)) as any;
    if (!company) throw new ApiError(404, 'Company not found');

    if (body.templateId) {
      const template = await db
        .prepare(`SELECT id FROM certificate_templates WHERE id = ? AND (company_id = ? OR company_id IS NULL)`)
        .get(body.templateId, req.companyId);
      if (!template) throw new ApiError(404, 'Template not found');
    }
    if (body.customerId) {
      const customer = await db.prepare(`SELECT id FROM customers WHERE id = ? AND company_id = ?`).get(body.customerId, req.companyId);
      if (!customer) throw new ApiError(404, 'Customer not found');
    }

    const certDate = new Date(body.certificateDate);
    const id = newId();

    await db.transaction(async (tx) => {
      const certNumber = await nextDocumentNumber(req.companyId!, 'certificate', certDate, tx);
      await tx
        .prepare(
          `INSERT INTO certificates (
            id, company_id, certificate_number, financial_year, template_id, certificate_date,
            customer_id, outlet_name, outlet_address, service_date, service_type,
            valid_from, valid_until, custom_fields, notes, status, issued_by, created_by
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
        )
        .run(
          id,
          req.companyId,
          certNumber,
          financialYearLabel(certDate, company.financial_year_start_month || 4),
          body.templateId || null,
          body.certificateDate,
          body.customerId || null,
          body.outletName || null,
          body.outletAddress || null,
          body.serviceDate || null,
          body.serviceType || null,
          body.validFrom || null,
          body.validUntil || null,
          body.customFields ? JSON.stringify(body.customFields) : null,
          body.notes || null,
          'draft',
          body.issuedBy || null,
          req.user!.id
        );
    });

    const row = await db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(id);
    res.status(201).json(rowToCertificate(row));
  })
);

certificatesRouter.patch(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const body = certificateSchema.partial().parse(req.body);
    const current = (await db.prepare(`SELECT * FROM certificates WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Certificate not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft certificates can be edited');

    await db
      .prepare(
        `UPDATE certificates SET
          template_id = COALESCE(?, template_id),
          certificate_date = COALESCE(?, certificate_date),
          customer_id = COALESCE(?, customer_id),
          outlet_name = COALESCE(?, outlet_name),
          outlet_address = COALESCE(?, outlet_address),
          service_date = COALESCE(?, service_date),
          service_type = COALESCE(?, service_type),
          valid_from = COALESCE(?, valid_from),
          valid_until = COALESCE(?, valid_until),
          custom_fields = COALESCE(?, custom_fields),
          notes = COALESCE(?, notes),
          issued_by = COALESCE(?, issued_by),
          updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(
        body.templateId ?? null,
        body.certificateDate ?? null,
        body.customerId ?? null,
        body.outletName ?? null,
        body.outletAddress ?? null,
        body.serviceDate ?? null,
        body.serviceType ?? null,
        body.validFrom ?? null,
        body.validUntil ?? null,
        body.customFields !== undefined ? JSON.stringify(body.customFields) : null,
        body.notes ?? null,
        body.issuedBy ?? null,
        req.params.id
      );

    const row = await db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(req.params.id);
    res.json(rowToCertificate(row));
  })
);

certificatesRouter.post(
  '/:id/issue',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = (await db.prepare(`SELECT * FROM certificates WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId)) as any;
    if (!current) throw new ApiError(404, 'Certificate not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft certificates can be issued');

    await db
      .prepare(`UPDATE certificates SET status = 'issued', issued_by = ?, updated_at = datetime('now') WHERE id = ?`)
      .run(req.user!.id, req.params.id);
    const row = await db.prepare(`SELECT * FROM certificates WHERE id = ?`).get(req.params.id);
    res.json(rowToCertificate(row));
  })
);

certificatesRouter.post(
  '/:id/cancel',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = await db.prepare(`SELECT * FROM certificates WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId);
    if (!current) throw new ApiError(404, 'Certificate not found');
    if (current.status === 'cancelled') throw new ApiError(400, 'Certificate already cancelled');
    await db.prepare(`UPDATE certificates SET status = 'cancelled', updated_at = datetime('now') WHERE id = ?`).run(req.params.id);
    res.json({ status: 'cancelled' });
  })
);

certificatesRouter.delete(
  '/:id',
  requireRole('admin', 'accountant'),
  asyncHandler(async (req, res) => {
    const current = await db.prepare(`SELECT * FROM certificates WHERE id = ? AND company_id = ?`).get(req.params.id, req.companyId);
    if (!current) throw new ApiError(404, 'Certificate not found');
    if (current.status !== 'draft') throw new ApiError(400, 'Only draft certificates can be deleted');
    await db.prepare(`DELETE FROM certificates WHERE id = ?`).run(req.params.id);
    res.json({ deleted: true });
  })
);