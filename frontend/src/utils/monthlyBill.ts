import type { MonthlyBillItem } from '../types';

/** A monthly-bill line plus an editor-only key for stable React list rendering. */
export interface DraftBillLine extends MonthlyBillItem {
  key: string;
}

let keySeq = 0;

export function newBillLine(partial: Partial<MonthlyBillItem> = {}): DraftBillLine {
  keySeq += 1;
  return {
    key: `mb${keySeq}`,
    itemId: partial.itemId ?? null,
    description: partial.description ?? '',
    hsnSacCode: partial.hsnSacCode ?? '',
    qty: partial.qty ?? 1,
    unit: partial.unit ?? 'NOS',
    rate: partial.rate ?? 0,
    discountPercent: partial.discountPercent ?? 0,
    gstRate: partial.gstRate ?? 18,
  };
}

/** Turns stored lines into editable drafts; always returns at least one empty row. */
export function toBillLines(items?: MonthlyBillItem[] | null): DraftBillLine[] {
  if (!items || items.length === 0) return [newBillLine()];
  return items.map((item) => newBillLine(item));
}

/** Strips editor-only fields and coerces the numeric inputs before hitting the API. */
export function toBillLinePayload(line: DraftBillLine) {
  return {
    itemId: line.itemId || null,
    description: line.description.trim(),
    hsnSacCode: line.hsnSacCode || null,
    qty: Number(line.qty) || 0,
    unit: line.unit,
    rate: Number(line.rate) || 0,
    discountPercent: Number(line.discountPercent) || 0,
    gstRate: Number(line.gstRate) || 0,
  };
}

export function validateBillLines(lines: DraftBillLine[]): string | null {
  const filled = lines.filter((l) => l.description.trim());
  if (filled.length === 0) return 'Add at least one item to the monthly bill';
  for (const line of filled) {
    if (Number(line.qty) <= 0) return `Quantity must be greater than 0 for "${line.description.trim()}"`;
    if (Number(line.rate) < 0) return `Rate cannot be negative for "${line.description.trim()}"`;
  }
  return null;
}
