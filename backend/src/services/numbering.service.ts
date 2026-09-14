import { db, type DbLike } from '../db/connection.js';
import { financialYearLabel } from './gst.service.js';

type Series = 'invoice' | 'credit_note' | 'debit_note';

const prefixColumn: Record<Series, 'invoice_prefix' | 'credit_note_prefix' | 'debit_note_prefix'> = {
  invoice: 'invoice_prefix',
  credit_note: 'credit_note_prefix',
  debit_note: 'debit_note_prefix',
};

/**
 * Allocates the next sequential document number for a company within its
 * current financial year, e.g. "INV/2026-27/0001". Sequence resets each
 * financial year, per common Indian GST invoicing practice.
 *
 * Must be called from within the caller's transaction (pass `tx`) so the
 * counter increment and the document insert are atomic.
 */
export async function nextDocumentNumber(
  companyId: string,
  series: Series,
  docDate: Date,
  tx: DbLike = db
): Promise<string> {
  const company = (await tx
    .prepare(`SELECT financial_year_start_month, invoice_prefix, credit_note_prefix, debit_note_prefix FROM companies WHERE id = ?`)
    .get(companyId)) as any;
  if (!company) throw new Error('Company not found');

  const fy = financialYearLabel(docDate, company.financial_year_start_month || 4);
  const prefix = company[prefixColumn[series]] || series.toUpperCase();

  const existing = (await tx
    .prepare(`SELECT last_number FROM invoice_counters WHERE company_id = ? AND financial_year = ? AND series = ?`)
    .get(companyId, fy, series)) as any;

  let next = 1;
  if (existing) {
    next = existing.last_number + 1;
    await tx
      .prepare(`UPDATE invoice_counters SET last_number = ? WHERE company_id = ? AND financial_year = ? AND series = ?`)
      .run(next, companyId, fy, series);
  } else {
    await tx
      .prepare(`INSERT INTO invoice_counters (company_id, financial_year, series, last_number) VALUES (?, ?, ?, ?)`)
      .run(companyId, fy, series, next);
  }

  const padded = String(next).padStart(4, '0');
  return `${prefix}/${fy}/${padded}`;
}

export { financialYearLabel };