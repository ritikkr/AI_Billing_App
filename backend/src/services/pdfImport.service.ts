import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { db } from '../db/connection.js';
import { newId } from '../utils/id.js';
import { ApiError } from '../utils/asyncHandler.js';
import { validateGSTIN, computeLineTax, aggregateTotals, financialYearLabel } from './gst.service.js';

export interface ParsedPdfLineItem {
  description: string;
  hsnSacCode: string | null;
  qty: number;
  rate: number;
  /** Effective GST rate for the line, e.g. 18 for an 18% slab. */
  gstRate: number;
}

export interface ParsedPdfInvoice {
  /** 1-based page (invoice) number within the PDF. */
  page: number;
  supplierName: string;
  supplierGstin: string | null;
  invoiceNo: string;
  /** Normalized to yyyy-mm-dd. */
  invoiceDate: string;
  /** Two-digit state code of the place of supply. */
  placeOfSupplyStateCode: string;
  customer: {
    name: string;
    gstin: string | null;
    billingAddress: string;
    stateCode: string | null;
  };
  lineItems: ParsedPdfLineItem[];
  /** Parsed values from the invoice for cross-validation against computed totals. */
  parsed: {
    subtotal: number;
    tax: number;
    roundOff: number;
    grandTotal: number;
  };
}

const GSTIN_RE = /GSTIN\s*:\s*([0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z])/;
const MONEY_RE = /[-+]?[\d,]+\.\d{2}/;
const DATE_DMY_RE = /(\d{1,2})-(\d{1,2})-(\d{4})/;
const ITEMS_HEADER_RE = /#\s*Item name/;
const ITEM_LINE_RE =
  /(\d{1,3})([A-Za-z][^₹]*?)(\d{3,8})(?=(?:[1-9]\d*(?:\.\d+)?)\s*₹)(\d+(?:\.\d+)?)\s*₹\s*([\d,]+\.\d{2})\s*₹\s*([\d,]+\.\d{2})/g;
const TAX_ROW_RE =
  /(\d{3,8})\s*₹\s*([\d,]+\.\d{2})\s*(\d+(?:\.\d+)?)%\s*₹\s*([\d,]+\.\d{2})(?:\s*(\d+(?:\.\d+)?)%\s*₹\s*([\d,]+\.\d{2}))?\s*₹\s*([\d,]+\.\d{2})/g;

function toMoney(s: string): number {
  const n = Number(s.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function firstMatchLine(text: string, name: string, re: RegExp): string | null {
  const m = text.match(re);
  if (!m) return null;
  return m[1];
}

/**
 * Extracts all tax invoices from the raw text of a multi-page PDF. Each page is
 * expected to contain exactly one invoice ("Tax Invoice" in the page header).
 */
export function parsePdfInvoices(pdfText: string): ParsedPdfInvoice[] {
  const pages = pdfText
    .split(/\n+\s*Tax Invoice\s*\n/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const invoices: ParsedPdfInvoice[] = [];
  pages.forEach((pageText, idx) => {
    try {
      const parsed = parseInvoicePage(pageText);
      if (parsed) invoices.push({ ...parsed, page: idx + 1 });
    } catch (err) {
      invoices.push({
        page: idx + 1,
        supplierName: '',
        supplierGstin: null,
        invoiceNo: '',
        invoiceDate: '',
        placeOfSupplyStateCode: '',
        customer: { name: '', gstin: null, billingAddress: '', stateCode: null },
        lineItems: [],
        parsed: { subtotal: 0, tax: 0, roundOff: 0, grandTotal: 0 },
      });
    }
  });

  return invoices;
}

function parseInvoicePage(pageText: string): Omit<ParsedPdfInvoice, 'page'> | null {
  const lines = pageText.split('\n').map((l) => l.trim());

  const supplierName = lines[0] || '';
  const supplierGstin = firstMatchLine(pageText, 'supplier GSTIN', GSTIN_RE);

  const invoiceNo =
    firstMatchLine(pageText, 'invoice no', /Invoice No\.\s*\n?\s*([A-Z0-9/\-]+)/i) || '';
  const dateMatch = pageText.match(DATE_DMY_RE);
  const invoiceDate = dateMatch ? `${dateMatch[3]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[1].padStart(2, '0')}` : '';
  const placeOfSupplyStateCode =
    firstMatchLine(pageText, 'place of supply', /Place\s*of\s*supply\s*\n?\s*(\d{2})-/) || '';

  const billToIdx = pageText.indexOf('Bill To');
  const billToText = billToIdx >= 0 ? pageText.slice(billToIdx + 'Bill To'.length) : '';
  const customer = parseCustomer(billToText);

  const defaultGstRate = parseDefaultGstRate(pageText);
  const lineItems = parseLineItems(pageText, defaultGstRate);
  const parsedTotals = parseTotals(pageText);

  if (!invoiceNo || !invoiceDate || !customer.name) return null;

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

function parseCustomer(billToText: string) {
  const lines = billToText.split('\n').map((l) => l.trim());
  const nameIdx = lines.findIndex((l) => l.length > 0);
  const name = nameIdx >= 0 ? lines[nameIdx] : '';
  const gstinMatch = billToText.match(GSTIN_RE);
  const gstin = gstinMatch ? gstinMatch[1].toUpperCase() : null;
  const stateMatch = billToText.match(/State\s*:\s*(\d{2})-/) ?? null;
  const stateCode = stateMatch ? stateMatch[1] : null;

  const addressLines: string[] = [];
  for (let i = nameIdx + 1; i < lines.length; i++) {
    if (/^GSTIN/.test(lines[i])) break;
    if (/^State\s*:/.test(lines[i])) break;
    if (lines[i]) addressLines.push(lines[i]);
  }
  const billingAddress = addressLines.join(', ');

  return { name, gstin, billingAddress, stateCode };
}

function parseLineItems(pageText: string, defaultGstRate: number): ParsedPdfLineItem[] {
  const headerIdx = pageText.search(ITEMS_HEADER_RE);
  if (headerIdx < 0) return [];

  const headerLineEnd = pageText.indexOf('\n', headerIdx);
  let region = pageText.slice(headerLineEnd < 0 ? headerIdx : headerLineEnd + 1);
  const totalIdx = region.search(/(?:\n|^)Total\s*\d/);
  if (totalIdx >= 0) region = region.slice(0, totalIdx);
  const flat = region.replace(/\s+/g, ' ');

  const taxRates = parseTaxRateMap(pageText);

  const items: ParsedPdfLineItem[] = [];
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
  return items;
}

function parseDefaultGstRate(pageText: string): number {
  const m = pageText.match(/Tax\s*\((\d+(?:\.\d+)?)%\)/);
  return m ? Number(m[1]) : 0;
}

function parseTaxRateMap(pageText: string): Record<string, number> {
  const start = pageText.indexOf('Total Tax Amount');
  const end = pageText.indexOf('Bank Details');
  if (start < 0) return {};
  const region = pageText.slice(start, end < 0 ? undefined : end).replace(/\s+/g, ' ');
  const map: Record<string, number> = {};
  let m: RegExpExecArray | null;
  TAX_ROW_RE.lastIndex = 0;
  while ((m = TAX_ROW_RE.exec(region)) !== null) {
    const hsn = m[1];
    const rate = Number(m[3]) + (m[5] ? Number(m[5]) : 0);
    map[hsn] = Math.round(rate * 100) / 100;
  }
  return map;
}

function parseTotals(pageText: string): { subtotal: number; tax: number; roundOff: number; grandTotal: number } {
  const amountsStart = pageText.indexOf('Amounts');
  const taxTableStart = pageText.indexOf('Total Tax Amount');
  const region = pageText.slice(amountsStart >= 0 ? amountsStart : 0, taxTableStart >= 0 ? taxTableStart : undefined);

  const subtotal = moneyMatch(region, /Sub Total\s*\n?\s*₹?\s*/);
  const tax = moneyMatch(region, /Tax\s*\(\d+(?:\.\d+)?%\)\s*\n?\s*₹?\s*/);
  const roundOff = moneyMatch(region, /Round\s*off\s*\n?\s*₹?\s*/) ?? 0;
  const grandTotal = moneyMatch(region, /Total\s*\n?\s*₹?\s*/);

  return { subtotal, tax, roundOff, grandTotal };
}

function moneyMatch(region: string, leadRe: RegExp): number {
  const m = region.match(new RegExp(leadRe.source + MONEY_RE.source));
  return m ? toMoney(m[0]) : 0;
}

export interface PdfImportOptions {
  companyId: string;
  userId: string;
  status: 'draft' | 'sent';
}

export interface PdfImportResult {
  totalPages: number;
  customers: { created: number; updated: number };
  invoices: { created: number; skipped: number };
  created: Array<{
    page: number;
    invoiceNo: string;
    customerName: string;
    invoiceId: string;
    grandTotal: number;
  }>;
  skipped: Array<{ page: number; invoiceNo: string; reason: string }>;
  failed: Array<{ page: number; invoiceNo: string; reason: string }>;
}

/**
 * Parses a multi-page tax-invoice PDF, upserts customers keyed on their GSTIN
 * (create when new, update when known) and inserts one invoice per page.
 * Invoices keep the original number from the PDF; totals are recomputed by the
 * app's GST engine (CGST+SGST vs IGST from the company state vs place of supply).
 */
export async function importInvoicesFromPdf(buffer: Buffer, options: PdfImportOptions): Promise<PdfImportResult> {
  if (!buffer || buffer.length < 5 || buffer.toString('latin1', 0, 4) !== '%PDF') {
    throw new ApiError(400, 'Uploaded file is not a valid PDF');
  }

  let pdfText: string;
  try {
    const parsed = await pdfParse(buffer);
    pdfText = parsed.text;
  } catch {
    throw new ApiError(400, 'Could not read the PDF file. Upload a valid, text-based PDF.');
  }

  const invoices = parsePdfInvoices(pdfText);
  if (invoices.length === 0) {
    throw new ApiError(400, 'No tax invoices could be found in the PDF.');
  }

  const company = db.prepare(`SELECT * FROM companies WHERE id = ?`).get(options.companyId) as any;
  if (!company) throw new ApiError(404, 'Company not found');

  const result: PdfImportResult = {
    totalPages: invoices.length,
    customers: { created: 0, updated: 0 },
    invoices: { created: 0, skipped: 0 },
    created: [],
    skipped: [],
    failed: [],
  };

  const findCustomerByGstin = db.prepare(`SELECT * FROM customers WHERE gstin = ? AND company_id = ?`);
  const findCustomerByName = db.prepare(`SELECT * FROM customers WHERE name = ? AND company_id = ?`);
  const findInvoiceByIdNo = db.prepare(`SELECT id FROM invoices WHERE company_id = ? AND invoice_number = ?`);

  db.transaction(() => {
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
      if (inv.invoiceNo) {
        if (seenNumbers.has(inv.invoiceNo)) {
          skip('Duplicate invoice number within this file');
          continue;
        }
        seenNumbers.add(inv.invoiceNo);
        if (findInvoiceByIdNo.get(options.companyId, inv.invoiceNo)) {
          skip('Invoice with this number already exists');
          continue;
        }
      } else {
        fail('Invoice number not found');
        continue;
      }
      if (inv.lineItems.length === 0) {
        fail('No line items could be parsed');
        continue;
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(inv.invoiceDate)) {
        fail('Invoice date not found');
        continue;
      }

      // Upsert customer keyed on GSTIN (fallback: exact name match when no GSTIN).
      let customer = inv.customer.gstin
        ? (findCustomerByGstin.get(inv.customer.gstin, options.companyId) as any)
        : undefined;
      if (!customer && !inv.customer.gstin) {
        customer = findCustomerByName.get(inv.customer.name, options.companyId) as any;
      }

      if (customer) {
        db.prepare(`UPDATE customers SET name=?, billing_address=?, updated_at=datetime('now') WHERE id=? AND company_id=?`).run(
          inv.customer.name,
          inv.customer.billingAddress,
          customer.id,
          options.companyId
        );
        result.customers.updated++;
      } else {
        customer = {
          id: newId(),
        };
        db.prepare(
          `INSERT INTO customers (id, company_id, name, customer_group, gstin, email, phone,
            billing_address, shipping_address, credit_limit, opening_balance, receivable_balance, payable_balance, notes)
           VALUES (?,?,?,NULL,?,NULL,NULL,?,NULL,0,0,0,0,NULL)`
        ).run(
          customer.id,
          options.companyId,
          inv.customer.name,
          inv.customer.gstin || null,
          inv.customer.billingAddress || null
        );
        result.customers.created++;
      }

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

      const invoiceId = newId();
      const fy = financialYearLabel(new Date(inv.invoiceDate), company.financial_year_start_month || 4);
      db.prepare(
        `INSERT INTO invoices (
          id, company_id, invoice_number, financial_year, invoice_date, due_date, customer_id,
          place_of_supply_state_code, is_interstate, subtotal, total_discount, taxable_value,
          total_cgst, total_sgst, total_igst, round_off, grand_total, amount_paid, status,
          notes, terms, reverse_charge, created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?,?)`
      ).run(
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

      const insertItem = db.prepare(
        `INSERT INTO invoice_items (
          id, invoice_id, item_id, description, hsn_sac_code, qty, unit, rate, discount_percent,
          taxable_value, gst_rate, cgst_amount, sgst_amount, igst_amount, line_total, sort_order
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      );
      inv.lineItems.forEach((l, idx) => {
        const t = taxedLines[idx];
        insertItem.run(
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
      });

      result.invoices.created++;
      result.created.push({
        page: inv.page,
        invoiceNo: inv.invoiceNo,
        customerName: inv.customer.name,
        invoiceId,
        grandTotal: totals.grandTotal,
      });
    }
  })();

  return result;
}