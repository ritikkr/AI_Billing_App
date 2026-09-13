import { STATE_CODE_TO_NAME } from './gst.constants.js';

const GSTIN_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

/**
 * Validates the structural format of a GSTIN (15 chars) and, if the format
 * matches, verifies the trailing checksum digit using the standard
 * GSTIN check-digit algorithm (mod-36, alternating weights of 1 and 2).
 */
export function validateGSTIN(gstin: string): { valid: boolean; reason?: string } {
  if (!gstin) return { valid: false, reason: 'GSTIN is required' };
  const value = gstin.trim().toUpperCase();
  if (value.length !== 15) return { valid: false, reason: 'GSTIN must be exactly 15 characters' };
  if (!GSTIN_FORMAT.test(value)) {
    return { valid: false, reason: 'GSTIN format is invalid (expected: 2-digit state code + 10-char PAN + entity code + Z + checksum)' };
  }
  const stateCode = value.slice(0, 2);
  if (!STATE_CODE_TO_NAME[stateCode]) {
    return { valid: false, reason: `Unknown state code "${stateCode}" in GSTIN` };
  }
  const expectedCheckDigit = computeGSTINCheckDigit(value.slice(0, 14));
  if (expectedCheckDigit !== value[14]) {
    return { valid: false, reason: 'GSTIN checksum digit does not match' };
  }
  return { valid: true };
}

function computeGSTINCheckDigit(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const value = GSTIN_CHARSET.indexOf(first14[i]);
    const factor = i % 2 === 0 ? 1 : 2;
    let product = value * factor;
    product = Math.floor(product / 36) + (product % 36);
    sum += product;
  }
  const checksum = (36 - (sum % 36)) % 36;
  return GSTIN_CHARSET[checksum];
}

export function stateCodeFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length < 2) return null;
  return gstin.slice(0, 2);
}

export function panFromGSTIN(gstin: string): string | null {
  if (!gstin || gstin.length < 12) return null;
  return gstin.slice(2, 12);
}

/** Rounds to 2 decimal places using standard rounding. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface TaxableLine {
  qty: number;
  rate: number;
  discountPercent?: number;
  gstRate: number;
}

export interface TaxedLine {
  taxableValue: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

/**
 * Computes CGST+SGST (intra-state) or IGST (inter-state) for a single line
 * item, per Indian GST rules: tax is split equally into CGST/SGST when the
 * supplier's state equals the place of supply, otherwise IGST applies in full.
 */
export function computeLineTax(line: TaxableLine, isInterstate: boolean): TaxedLine {
  const gross = line.qty * line.rate;
  const discountAmount = gross * ((line.discountPercent || 0) / 100);
  const taxableValue = round2(gross - discountAmount);
  const taxAmount = round2((taxableValue * line.gstRate) / 100);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (isInterstate) {
    igstAmount = taxAmount;
  } else {
    cgstAmount = round2(taxAmount / 2);
    sgstAmount = round2(taxAmount - cgstAmount); // avoids rounding drift
  }

  const lineTotal = round2(taxableValue + cgstAmount + sgstAmount + igstAmount);

  return { taxableValue, cgstAmount, sgstAmount, igstAmount, lineTotal };
}

export interface DocumentTotals {
  subtotal: number;
  totalDiscount: number;
  taxableValue: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
  roundOff: number;
  grandTotal: number;
}

/**
 * Aggregates a set of already-taxed lines into document-level totals,
 * applying GST "round off" of the final invoice value to the nearest rupee
 * (a common, GST-rule-compliant practice — the rounding difference itself
 * is shown as a separate "Round Off" line rather than baked into a rate).
 */
export function aggregateTotals(
  rawLines: TaxableLine[],
  taxedLines: TaxedLine[]
): DocumentTotals {
  const subtotal = round2(rawLines.reduce((s, l) => s + l.qty * l.rate, 0));
  const taxableValue = round2(taxedLines.reduce((s, l) => s + l.taxableValue, 0));
  const totalDiscount = round2(subtotal - taxableValue);
  const totalCgst = round2(taxedLines.reduce((s, l) => s + l.cgstAmount, 0));
  const totalSgst = round2(taxedLines.reduce((s, l) => s + l.sgstAmount, 0));
  const totalIgst = round2(taxedLines.reduce((s, l) => s + l.igstAmount, 0));
  const preRoundTotal = round2(taxableValue + totalCgst + totalSgst + totalIgst);
  const grandTotal = Math.round(preRoundTotal);
  const roundOff = round2(grandTotal - preRoundTotal);

  return { subtotal, totalDiscount, taxableValue, totalCgst, totalSgst, totalIgst, roundOff, grandTotal };
}

/**
 * Indian financial year runs Apr 1 - Mar 31. Given a date and the company's
 * FY-start month (default April = 4), returns a label like "2026-27".
 */
export function financialYearLabel(date: Date, fyStartMonth = 4): string {
  const month = date.getMonth() + 1; // 1-12
  const year = date.getFullYear();
  const startYear = month >= fyStartMonth ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
}

/** Converts a rupee amount into words (Indian numbering: lakh/crore), e.g. for "Amount in Words" on invoices. */
export function amountInWords(amount: number): string {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function twoDigits(n: number): string {
    if (n < 20) return ones[n];
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
  }
  function threeDigits(n: number): string {
    if (n < 100) return twoDigits(n);
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + twoDigits(n % 100) : '');
  }

  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);

  if (rupees === 0 && paise === 0) return 'Zero Rupees Only';

  let n = rupees;
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  const parts: string[] = [];
  if (crore) parts.push(threeDigits(crore) + ' Crore');
  if (lakh) parts.push(threeDigits(lakh) + ' Lakh');
  if (thousand) parts.push(threeDigits(thousand) + ' Thousand');
  if (hundred) parts.push(threeDigits(hundred));
  if (parts.length === 0) parts.push('Zero');

  let result = parts.join(' ') + ' Rupees';
  if (paise) {
    result += ' and ' + twoDigits(paise) + ' Paise';
  }
  return result + ' Only';
}
