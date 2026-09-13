import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import { asyncHandler, ApiError } from '../utils/asyncHandler.js';
import { requireRole } from '../middleware/auth.js';
import { importInvoicesFromPdf } from '../services/pdfImport.service.js';

/**
 * @swagger
 * tags:
 *   - name: PDF Import
 *     description: Import invoices (and customers) from multi-page tax-invoice PDF files
 */

export const pdfImportRouter = Router({ mergeParams: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1 },
});

const querySchema = z.object({
  status: z.enum(['sent', 'draft']).optional(),
});

/**
 * @swagger
 * /api/companies/{companyId}/pdf-import:
 *   post:
 *     tags:
 *       - PDF Import
 *     summary: Import customers and invoices from a tax-invoice PDF
 *     description: |
 *       Accepts a multipart "file" (a PDF). Each page must contain one tax
 *       invoice (e.g. "Tax Invoice" in the header). Per invoice:
 *       - Customer is upserted keyed on GSTIN (created when new, updated when
 *         known; falls back to an exact name match when no GSTIN is present).
 *       - An invoice is created with the original invoice number from the PDF;
 *         line items, CGST/SGST or IGST, and round-off are recomputed by the
 *         app's own GST engine using the company state vs place of supply.
 *       Pages already imported (duplicate invoice number) are skipped. Set
 *       ?status=draft to create drafts instead of sent invoices.
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
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [sent, draft]
 *           default: sent
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Import result summary
 *       400:
 *         description: Invalid PDF or no invoices found
 */
pdfImportRouter.post(
  '/',
  requireRole('admin', 'accountant'),
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const file = req.file;
    if (!file) {
      throw new ApiError(400, 'No file uploaded. Send a PDF with field name "file".');
    }

    const { status } = querySchema.parse(req.query);

    const result = await importInvoicesFromPdf(file.buffer, {
      companyId: req.companyId!,
      userId: req.user!.id,
      status: status || 'sent',
    });

    res.json(result);
  })
);