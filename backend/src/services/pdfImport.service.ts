import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { ApiError } from '../utils/asyncHandler.js';
import { validateGSTIN, computeLineTax, aggregateTotals, financialYearLabel } from './gst.service.js';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface ParsedPdfLineItem {
  description: string;
  hsnSacCode: string | null;
  qty: number;
  rate: number;
  gstRate: number;
}

export interface ParsedPdfInvoice {
  page: number;
  supplierName: string;
  supplierGstin: string | null;
  invoiceNo: string;
  invoiceDate: string;
  placeOfSupplyStateCode: string;
  customer: {
    name: string;
    gstin: string | null;
    billingAddress: string;
    stateCode: string | null;
    email: string | null;
    phone: string | null;
  };
  lineItems: ParsedPdfLineItem[];
  parsed: {
    subtotal: number;
    tax: number;
    roundOff: number;
    grandTotal: number;
  };
}

export type PdfImportMode = 'import' | 'customers_only' | 'preview';

export interface PdfImportOptions {
  companyId: string;
  userId: string;
  status: 'draft' | 'sent';
  mode: PdfImportMode;
}

export interface PdfImportResult {
  totalPages: number;
  customers: { created: number; updated: number };
  invoices: { created: number; updated: number; skipped: number };
  created: Array<{
    page: number;
    invoiceNo: string;
    customerName: string;
    invoiceId: string;
    grandTotal: number;
  }>;
  updated: Array<{
    page: number;
    invoiceNo: string;
    customerName: string;
    invoiceId: string;
    grandTotal: number;
  }>;
  skipped: Array<{ page: number; invoiceNo: string; reason: string }>;
  failed: Array<{ page: number; invoiceNo: string; reason: string }>;
}

/* -------------------------------------------------------------------------- */
/*  Regex patterns                                                            */
/* -------------------------------------------------------------------------- */

const GSTIN_RE = /GSTIN\s*:\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i;
const GSTIN_BARE_RE = /\b([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])\b/;
const MONEY_RE = /[-+]?[\d,]+\.\d{2}/;
const DATE_DMY_RE = /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/;
const DATE_YMD_RE = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/;
const PHONE_RE = /(?:\+?91[\s-]?)?\d{10}/;
const ITEMS_HEADER_RE = /#\s*Item name|Item\s*(?:Name|Description|Details)|S\.?\s*No\.?\s*\*?\s*Item/i;
const ITEM_LINE_RE =
  /(\d{1,3})([A-Za-z][^₹]*?)(\d{3,8})(?=(?:[1-9]\d*(?:\.\d+)?)\s*₹)(\d+(?:\.\d+)?)\s*₹\s*([\d,]+\.\d{2})\s*₹\s*([\d,]+\.\d{2})/g;
const ITEM_LINE_ALT_RE =
  /(\d+)\s+([\w][\w\s.&-]{2,60}?)\s+(\d{3,8})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.\d{2})/g;
const TAX_ROW_RE =
  /(\d{3,8})\s*₹\s*([\d,]+\.\d{2})\s*(\d+(?:\.\d+)?)%\s*₹\s*([\d,]+\.\d{2})(?:\s*(\d+(?:\.\d+)?)%\s*₹\s*([\d,]+\.\d{2}))?\s*₹\s*([\d,]+\.\d{2})/g;
const TAX_ROW_ALT_RE =
  /(\d{3,8})\s+([\d,]+\.\d{2})\s+(\d+(?:\.\d+)?)%\s+([\d,]+\.\d{2})(?:\s+(\d+(?:\.\d+)?)%\s+([\d,]+\.\d{2}))?\s+([\d,]+\.\d{2})/g;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function toMoney(s: string): number {
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

/**
 * Split raw PDF text into per-invoice chunks. Uses multiple heuristics:
 * 1. "Tax Invoice" header (original format)
 * 2. Page-break form-feed characters
 * 3. Invoice number patterns as boundaries
 * Falls back to treating the entire document as one invoice if no split markers found.
 */
function splitPages(pdfText: string): string[] {
  // Strategy 1: Split on "Tax Invoice" header (original format)
  const taxInvoiceParts = pdfText
    .split(/\n+\s*Tax Invoice\s*\n/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (taxInvoiceParts.length > 1) return taxInvoiceParts;

  // Strategy 2: Split on form-feed characters (common in PDFs)
  const ffParts = pdfText
    .split(/\f/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (ffParts.length > 1) return ffParts;

  // Strategy 3: Split on invoice number patterns (Invoice No, Invoice #, Bill No)
  const invNumParts = pdfText
    .split(/\n(?=\s*(?:Invoice\s*(?:No|Number|#|\.No)|Bill\s*(?:No|Number|#)|Inv\s*#)\s*[:.\s])/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
  if (invNumParts.length > 1) return invNumParts;

  // Strategy 4: Split on repeated header patterns (company name + GSTIN appearing multiple times)
  const gstinHeaders = [...pdfText.matchAll(/\n([A-Z][\w\s&.]{3,50})\n.*GSTIN\s*:/gi)];
  if (gstinHeaders.length > 1) {
    const positions = gstinHeaders.map((m) => m.index!);
    const parts: string[] = [];
    for (let i = 0; i < positions.length; i++) {
      const start = positions[i];
      const end = i + 1 < positions.length ? positions[i + 1] : pdfText.length;
      parts.push(pdfText.slice(start, end).trim());
    }
    if (parts.length > 1) return parts.filter((p) => p.length > 20);
  }

  // Fallback: treat the entire text as one page
  return [pdfText.trim()];
}

/* -------------------------------------------------------------------------- */
/*  Parsing functions                                                         */
/* -------------------------------------------------------------------------- */

export function parsePdfInvoices(pdfText: string): ParsedPdfInvoice[] {
  const pages = splitPages(pdfText);

  const invoices: ParsedPdfInvoice[] = [];
  pages.forEach((pageText, idx) => {
    try {
      const parsed = parseInvoicePage(pageText);
      if (parsed) {
        invoices.push({ ...parsed, page: idx + 1 });
      } else {
        // Could not extract structured data — record a failed entry
        invoices.push({
          page: idx + 1,
          supplierName: '',
          supplierGstin: null,
          invoiceNo: '',
          invoiceDate: '',
          placeOfSupplyStateCode: '',
          customer: { name: '', gstin: null, billingAddress: '', stateCode: null, email: null, phone: null },
          lineItems: [],
          parsed: { subtotal: 0, tax: 0, roundOff: 0, grandTotal: 0 },
        });
      }
    } catch {
      invoices.push({
        page: idx + 1,
        supplierName: '',
        supplierGstin: null,
        invoiceNo: '',
        invoiceDate: '',
        placeOfSupplyStateCode: '',
        customer: { name: '', gstin: null, billingAddress: '', stateCode: null, email: null, phone: null },
        lineItems: [],
        parsed: { subtotal: 0, tax: 0, roundOff: 0, grandTotal: 0 },
      });
    }
  });

  return invoices;
}

function parseInvoicePage(pageText: string): Omit<ParsedPdfInvoice, 'page'> | null {
  const lines = pageText.split('\n').map((l) => l.trim());

  // Supplier name: first non-empty line or extracted from header
  const supplierName = lines.find((l) => l.length > 1 && !/^(Invoice|Bill|Tax|Page)/i.test(l)) || lines[0] || '';
  const supplierGstin =
    firstMatch(pageText, GSTIN_RE) || firstMatch(pageText, /GSTIN\s*[:.]?\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/i);

  // Invoice number — try multiple patterns
  const invoiceNo =
    firstMatch(pageText, /Invoice\s*(?:No|Number|#|\.No)\s*[:.\s]*\n?\s*([A-Z0-9/\-]+)/i) ||
    firstMatch(pageText, /Bill\s*(?:No|Number|#)\s*[:.\s]*\n?\s*([A-Z0-9/\-]+)/i) ||
    firstMatch(pageText, /Inv\s*#\s*[:.\s]*\n?\s*([A-Z0-9/\-]+)/i) ||
    firstMatch(pageText, /Invoice\s*No\.?\s*([A-Z0-9/\-]+)/i) ||
    '';

  // Date — try DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD, YYYY/MM/DD
  let invoiceDate = '';
  const dmyMatch = pageText.match(DATE_DMY_RE);
  const ymdMatch = pageText.match(DATE_YMD_RE);
  if (dmyMatch) {
    invoiceDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2, '0')}-${dmyMatch[1].padStart(2, '0')}`;
  } else if (ymdMatch) {
    invoiceDate = `${ymdMatch[1]}-${ymdMatch[2].padStart(2, '0')}-${ymdMatch[3].padStart(2, '0')}`;
  }

  // Place of supply
  const placeOfSupplyStateCode =
    firstMatch(pageText, /Place\s*of\s*(?:Supply|Delivery)\s*\n?\s*(\d{2})-/i) ||
    firstMatch(pageText, /POS\s*[:.\s]*(\d{2})/i) ||
    '';

  // Customer — try multiple section markers
  const billToIdx = pageText.search(/Bill\s*To|Sold\s*To|Buyer|Customer\s*Details|Consignee/i);
  const billToText = billToIdx >= 0 ? pageText.slice(billToIdx + /[A-Za-z\s]+/.exec(pageText.slice(billToIdx))![0].length) : '';
  const customer = parseCustomer(billToText || pageText);

  const defaultGstRate = parseDefaultGstRate(pageText);
  const lineItems = parseLineItems(pageText, defaultGstRate);
  const parsedTotals = parseTotals(pageText);

  if (!invoiceNo || !customer.name) return null;

  return {
    supplierName,
    supplierGstin,
    invoiceNo,
    invoiceDate,
    placeOfSupplyStateCode,
    customer,
    lineItems,
    parsed: parsedTotals,
  };
}

function parseCustomer(billToText: string): ParsedPdfInvoice['customer'] {
  const lines = billToText.split('\n').map((l) => l.trim());
  const nameIdx = lines.findIndex((l) => l.length > 0);
  const name = nameIdx >= 0 ? lines[nameIdx] : '';

  // GSTIN — try structured pattern first, then bare 15-char pattern
  const gstinMatch = billToText.match(GSTIN_RE) || billToText.match(GSTIN_BARE_RE);
  const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : null;

  // State code
  const stateMatch = billToText.match(/State\s*:\s*(\d{2})-/i) ?? null;
  const stateCode = stateMatch ? stateMatch[1] : null;

  // Email
  const emailMatch = billToText.match(EMAIL_RE);
  const email = emailMatch ? emailMatch[0] : null;

  // Phone
  const phoneMatch = billToText.match(PHONE_RE);
  const phone = phoneMatch ? phoneMatch[0].replace(/\s/g, '') : null;

  // Address — lines between name and GSTIN/State
  const addressLines: string[] = [];
  for (let i = nameIdx + 1; i < lines.length; i++) {
    if (/^GSTIN/i.test(lines[i])) break;
    if (/^State\s*:/i.test(lines[i])) break;
    if (/^Email|^Phone|^Mobile|^Tel/i.test(lines[i])) break;
    if (lines[i]) addressLines.push(lines[i]);
  }
  const billingAddress = addressLines.join(', ');

  return { name, gstin, billingAddress, stateCode, email, phone };
}

function parseLineItems(pageText: string, defaultGstRate: number): ParsedPdfLineItem[] {
  const headerIdx = pageText.search(ITEMS_HEADER_RE);
  if (headerIdx < 0) return [];

  const headerLineEnd = pageText.indexOf('\n', headerIdx);
  let region = pageText.slice(headerLineEnd < 0 ? headerIdx : headerLineEnd + 1);

  // Find end of items table
  const totalIdx = region.search(/(?:\n|^)(?:Total|Sub\s*Total|Amount|Taxable)/i);
  if (totalIdx >= 0) region = region.slice(0, totalIdx);
  const flat = region.replace(/\s+/g, ' ');

  const taxRates = parseTaxRateMap(pageText);

  const items: ParsedPdfLineItem[] = [];

  // Try primary regex pattern first
  let m: RegExpExecArray | null;
  ITEM_LINE_RE.lastIndex = 0;
  while ((m = ITEM_LINE_RE.exec(flat)) !== null) {
    const hsn = m[3];
    items.push({
      description: (m[2] || '').trim(),
      hsnSacCode: hsn,
      qty: Number(m[4]),
      rate: toMoney(m[5]),
      gstRate: taxRates[hsn] ?? defaultGstRate,
    });
  }

  // If primary pattern found nothing, try alternative pattern
  if (items.length === 0) {
    ITEM_LINE_ALT_RE.lastIndex = 0;
    while ((m = ITEM_LINE_ALT_RE.exec(flat)) !== null) {
      const hsn = m[3];
      items.push({
        description: (m[2] || '').trim(),
        hsnSacCode: hsn,
        qty: Number(m[4]),
        rate: toMoney(m[5]),
        gstRate: taxRates[hsn] ?? defaultGstRate,
      });
    }
  }

  return items;
}

function parseDefaultGstRate(pageText: string): number {
  const m = pageText.match(/Tax\s*\((\d+(?:\.\d+)?)%\)/i);
  return m ? Number(m[1]) : 0;
}

function parseTaxRateMap(pageText: string): Record<string, number> {
  const start = pageText.search(/Total\s*Tax\s*Amount|Tax\s*Summary|HSN\s*Summary/i);
  const end = pageText.search(/Bank\s*Details|Terms\s*and\s*Conditions|Declaration/i);
  if (start < 0) return {};
  const region = pageText.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  const map: Record<string, number> = {};

  // Try primary tax row pattern
  let m: RegExpExecArray | null;
  TAX_ROW_RE.lastIndex = 0;
  while ((m = TAX_ROW_RE.exec(region)) !== null) {
    const hsn = m[1];
    const rate = Number(m[3]) + (m[5] ? Number(m[5]) : 0);
    map[hsn] = Math.round(rate * 100) / 100;
  }

  // If no matches, try alternative pattern
  if (Object.keys(map).length === 0) {
    TAX_ROW_ALT_RE.lastIndex = 0;
    while ((m = TAX_ROW_ALT_RE.exec(region)) !== null) {
      const hsn = m[1];
      const rate = Number(m[3]) + (m[5] ? Number(m[5]) : 0);
      map[hsn] = Math.round(rate * 100) / 100;
    }
  }

  return map;
}

function parseTotals(pageText: string): { subtotal: number; tax: number; roundOff: number; grandTotal: number } {
  const amountsStart = pageText.search(/Amounts|Amount\s*Details|Total\s*Summary/i);
  const taxTableStart = pageText.search(/Total\s*Tax\s*Amount|Tax\s*Summary/i);
  const region = pageText.slice(amountsStart >= 0 ? amountsStart : 0, taxTableStart >= 0 ? taxTableStart : undefined);

  const subtotal = moneyMatch(region, /Sub\s*Total\s*\n?\s*₹?\s*/i) ?? moneyMatch(region, /Taxable\s*Amount\s*\n?\s*₹?\s*/i) ?? 0;
  const tax = moneyMatch(region, /Tax\s*\(\d+(?:\.\d+)?%\)\s*\n?\s*₹?\s*/i) ?? 0;
  const roundOff = moneyMatch(region, /Round\s*off\s*\n?\s*₹?\s*/i) ?? 0;
  const grandTotal = moneyMatch(region, /(?:Grand\s*)?Total\s*\n?\s*₹?\s*/i) ?? 0;

  return { subtotal, tax, roundOff, grandTotal };
}

function moneyMatch(region: string, leadRe: RegExp): number | null {
  const m = region.match(new RegExp(leadRe.source + MONEY_RE.source, 'i'));
  return m ? toMoney(m[0]) : null;
}

/* -------------------------------------------------------------------------- */
/*  PDF text extraction                                                       */
/* -------------------------------------------------------------------------- */

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; numPages: number }> {
  if (!buffer || buffer.length < 5 || buffer.toString('latin1', 0, 4) !== '%PDF') {
    throw new ApiError(400, 'Uploaded file is not a valid PDF');
  }

  try {
    const parsed = await pdfParse(buffer);
    return { text: parsed.text, numPages: parsed.numpages || 0 };
  } catch {
    throw new ApiError(400, 'Could not read the PDF file. Ensure it is a text-based (not scanned/image) PDF.');
  }
}

/* -------------------------------------------------------------------------- */
/*  Preview — parse without writing to DB                                     */
/* -------------------------------------------------------------------------- */

export async function previewPdfImport(
  buffer: Buffer,
  options: { companyId: string }
): Promise<{ totalPages: number; invoices: ParsedPdfInvoice[]; customers: Array<{ name: string; gstin: string | null; billingAddress: string; email: string | null; isNew: boolean }> }> {
  const { text, numPages } = await extractPdfText(buffer);
  const invoices = parsePdfInvoices(text);

  if (invoices.length === 0) {
    throw new ApiError(400, 'No tax invoices could be found in the PDF. Ensure each page contains a distinct invoice.');
  }

  // Determine customer status (new vs existing)
  const customers = await Promise.all(
    invoices.map(async (inv) => {
      if (!inv.customer.name) {
        return { ...inv.customer, isNew: false, exists: false };
      }
      let existing: any = null;
      if (inv.customer.gstin) {
        existing = await db.prepare(`SELECT id FROM customers WHERE gstin = ? AND company_id = ?`).get(inv.customer.gstin, options.companyId);
      }
      if (!existing) {
        existing = await db.prepare(`SELECT id FROM customers WHERE name = ? AND company_id = ?`).get(inv.customer.name, options.companyId);
      }
      return { ...inv.customer, isNew: !existing };
    })
  );

  return { totalPages: numPages || invoices.length, invoices, customers };
}

/* -------------------------------------------------------------------------- */
/*  Main import logic                                                         */
/* -------------------------------------------------------------------------- */

export async function importInvoicesFromPdf(buffer: Buffer, options: PdfImportOptions): Promise<PdfImportResult> {
  const { text } = await extractPdfText(buffer);
  const invoices = parsePdfInvoices(text);

  if (invoices.length === 0) {
    throw new ApiError(400, 'No tax invoices could be found in the PDF. Ensure each page contains a distinct invoice.');
  }

  const company = (await db.prepare(`SELECT * FROM companies WHERE id = ?`).get(options.companyId)) as any;
  if (!company) throw new ApiError(404, 'Company not found');

  const result: PdfImportResult = {
    totalPages: invoices.length,
    customers: { created: 0, updated: 0 },
    invoices: { created: 0, updated: 0, skipped: 0 },
    created: [],
    updated: [],
    skipped: [],
    failed: [],
  };

  await db.transaction(async (tx) => {
    const seenNumbers = new Set<string>();

    for (const inv of invoices) {
      const fail = (reason: string) => result.failed.push({ page: inv.page, invoiceNo: inv.invoiceNo, reason });
      const skip = (reason: string) => result.skipped.push({ page: inv.page, invoiceNo: inv.invoiceNo, reason });

      if (!inv.customer.name) {
        fail('Customer name not found');
        continue;
      }
      if (inv.customer.gstin) {
        const v = validateGSTIN(inv.customer.gstin);
        if (!v.valid) {
          fail(`Invalid GSTIN "${inv.customer.gstin}": ${v.reason}`);
          continue;
        }
      }
      if (!inv.invoiceNo) {
        fail('Invoice number not found');
        continue;
      }
      if (seenNumbers.has(inv.invoiceNo)) {
        skip('Duplicate invoice number within this file');
        continue;
      }
      seenNumbers.add(inv.invoiceNo);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.invoiceDate)) {
        fail('Invoice date not found or invalid format');
        continue;
      }

      // Upsert customer: try GSTIN first, then exact name
      let customer: any = null;
      if (inv.customer.gstin) {
        customer = await tx.prepare(`SELECT * FROM customers WHERE gstin = ? AND company_id = ?`).get(inv.customer.gstin, options.companyId);
      }
      if (!customer) {
        customer = await tx.prepare(`SELECT * FROM customers WHERE name = ? AND company_id = ?`).get(inv.customer.name, options.companyId);
      }

      if (customer) {
        // Update existing customer with any new data from PDF
        const updates: string[] = [];
        const values: any[] = [];
        if (inv.customer.billingAddress && inv.customer.billingAddress !== customer.billing_address) {
          updates.push('billing_address = ?');
          values.push(inv.customer.billingAddress);
        }
        if (inv.customer.gstin && inv.customer.gstin !== customer.gstin) {
          updates.push('gstin = ?');
          values.push(inv.customer.gstin);
        }
        if (inv.customer.email && inv.customer.email !== customer.email) {
          updates.push('email = ?');
          values.push(inv.customer.email);
        }
        if (inv.customer.phone && inv.customer.phone !== customer.phone) {
          updates.push('phone = ?');
          values.push(inv.customer.phone);
        }
        if (updates.length > 0) {
          values.push(customer.id, options.companyId);
          await tx.prepare(`UPDATE customers SET ${updates.join(', ')}, updated_at = datetime('now') WHERE id = ? AND company_id = ?`).run(...values);
        }
        result.customers.updated++;
      } else {
        customer = { id: newId() };
        await tx
          .prepare(
            `INSERT INTO customers (id, company_id, name, customer_group, gstin, pan, email, phone,
              billing_address, shipping_address, credit_limit, opening_balance, receivable_balance, payable_balance, notes)
             VALUES (?,?,?,NULL,?,NULL,?,?,?,NULL,0,0,0,0,NULL)`
          )
          .run(
            customer.id,
            options.companyId,
            inv.customer.name,
            inv.customer.gstin || null,
            inv.customer.email || null,
            inv.customer.phone || null,
            inv.customer.billingAddress || null
          );
        result.customers.created++;
      }

      // --- Customers-only mode: skip invoice creation ---
      if (options.mode === 'customers_only') continue;

      const placeOfSupply =
        inv.placeOfSupplyStateCode ||
        (inv.customer.gstin ? inv.customer.gstin.slice(0, 2) : company.state_code);
      if (!/^\d{2}$/.test(placeOfSupply)) {
        fail('Place of supply is missing or invalid');
        continue;
      }

      const isInterstate = placeOfSupply !== company.state_code;
      const rawLines = inv.lineItems.map((l) => ({ qty: l.qty, rate: l.rate, discountPercent: 0, gstRate: l.gstRate }));
      const taxedLines = inv.lineItems.map((l) =>
        computeLineTax({ qty: l.qty, rate: l.rate, discountPercent: 0, gstRate: l.gstRate }, isInterstate)
      );
      const totals = aggregateTotals(rawLines, taxedLines);
      const fy = financialYearLabel(new Date(inv.invoiceDate), company.financial_year_start_month || 4);

      // Check if invoice already exists (update vs create)
      const existingInvoice = await tx
        .prepare(`SELECT id FROM invoices WHERE company_id = ? AND invoice_number = ?`)
        .get(options.companyId, inv.invoiceNo) as any;

      if (existingInvoice) {
        // Update existing invoice
        const invoiceId = existingInvoice.id;
        await tx
          .prepare(
            `UPDATE invoices SET
              customer_id = ?, place_of_supply_state_code = ?, is_interstate = ?,
              subtotal = ?, total_discount = ?, taxable_value = ?,
              total_cgst = ?, total_sgst = ?, total_igst = ?, round_off = ?, grand_total = ?,
              status = ?, updated_at = datetime('now')
            WHERE id = ? AND company_id = ?`
          )
          .run(
            customer.id,
            placeOfSupply,
            isInterstate ? 1 : 0,
            totals.subtotal,
            totals.totalDiscount,
            totals.taxableValue,
            totals.totalCgst,
            totals.totalSgst,
            totals.totalIgst,
            totals.roundOff,
            totals.grandTotal,
            options.status || 'sent',
            invoiceId,
            options.companyId
          );

        // Replace line items
        await tx.prepare(`DELETE FROM invoice_items WHERE invoice_id = ?`).run(invoiceId);
        for (const [idx, l] of inv.lineItems.entries()) {
          const t = taxedLines[idx];
          await tx
            .prepare(
              `INSERT INTO invoice_items (
                id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
                taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            )
            .run(
              newId(),
              invoiceId,
              null,
              l.description,
              l.hsnSacCode || null,
              l.qty,
              'NOS',
              l.rate,
              0,
              t.taxableValue,
              l.gstRate,
              t.cgstAmount,
              t.sgstAmount,
              t.igstAmount,
              t.lineTotal,
              idx
            );
        }

        result.invoices.updated++;
        result.updated.push({
          page: inv.page,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customer.name,
          invoiceId,
          grandTotal: totals.grandTotal,
        });
      } else {
        // Create new invoice
        const invoiceId = newId();
        await tx
          .prepare(
            `INSERT INTO invoices (
              id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
              place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
              total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
              notes, terms, reverse_charge, created_by
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`
          )
          .run(
            invoiceId,
            options.companyId,
            inv.invoiceNo,
            fy,
            inv.invoiceDate,
            null,
            customer.id,
            placeOfSupply,
            isInterstate ? 1 : 0,
            totals.subtotal,
            totals.totalDiscount,
            totals.taxableValue,
            totals.totalCgst,
            totals.totalSgst,
            totals.totalIgst,
            totals.roundOff,
            totals.grandTotal,
            options.status || 'sent',
            null,
            null,
            0,
            options.userId
          );

        for (const [idx, l] of inv.lineItems.entries()) {
          const t = taxedLines[idx];
          await tx
            .prepare(
              `INSERT INTO invoice_items (
                id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
                taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
            )
            .run(
              newId(),
              invoiceId,
              null,
              l.description,
              l.hsnSacCode || null,
              l.qty,
              'NOS',
              l.rate,
              0,
              t.taxableValue,
              l.gstRate,
              t.cgstAmount,
              t.sgstAmount,
              t.igstAmount,
              t.lineTotal,
              idx
            );
        }

        result.invoices.created++;
        result.created.push({
          page: inv.page,
          invoiceNo: inv.invoiceNo,
          customerName: inv.customer.name,
          invoiceId,
          grandTotal: totals.grandTotal,
        });
      }
    }
  });

  return result;
}
