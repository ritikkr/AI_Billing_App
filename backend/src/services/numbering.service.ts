import { db } from '../db/connection.js';
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
 */
export function nextDocumentNumber(companyId: string, series: Series, docDate: Date): string {
  const company = db
    .prepare(`SELECT financial_year_start_month, invoice_prefix, credit_note_prefix, debit_note_prefix FROM companies WHERE id = ?`)
    .get(companyId) as any;
  if (!company) throw new Error('Company not found');

  const fy = financialYearLabel(docDate, company.financial_year_start_month || 4);
  const prefix = company[prefixColumn[series]] || series.toUpperCase();

  const tx = db.transaction(() => {
    const existing = db
      .prepare(`SELECT last_number FROM invoice_counters WHERE company_id = ? AND financial_year = ? AND series = ?`)
      .get(companyId, fy, series) as any;

    let next = 1;
    if (existing) {
      next = existing.last_number + 1;
      db.prepare(`UPDATE invoice_counters SET last_number = ? WHERE company_id = ? AND financial_year = ? AND series = ?`)
        .run(next, companyId, fy, series);
    } else {
      db.prepare(`INSERT INTO invoice_counters (company_id, financial_year, series, last_number) VALUES (?, ?, ?, ?)`)
        .run(companyId, fy, series, next);
    }
    return next;
  });

  const next = tx();
  const padded = String(next).padStart(4, '0');
  return `${prefix}/${fy}/${padded}`;
}

export { financialYearLabel };
