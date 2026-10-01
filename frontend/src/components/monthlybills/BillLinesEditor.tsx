import { useMemo } from 'react';
import { Button } from '../ui/Button';
import { formatCurrency } from '../../utils/format';
import { computeLineTax, aggregateTotals, type TaxableLine } from '../../utils/gst';
import type { Item } from '../../types';
import { newBillLine, type DraftBillLine } from '../../utils/monthlyBill';

/**
 * Editable line-item grid shared by the monthly-bill editor and the
 * generate-invoices preview, so a customer's recurring items and prices are
 * always edited the same way in both places.
 */
export function BillLinesEditor({
  lines,
  onChange,
  items,
  units,
  gstRateSlabs,
  isInterstate,
  idPrefix,
}: {
  lines: DraftBillLine[];
  onChange: (lines: DraftBillLine[]) => void;
  items?: Item[];
  units?: string[];
  gstRateSlabs?: number[];
  isInterstate: boolean;
  /** Keeps input ids unique when several editors render on one page. */
  idPrefix: string;
}) {
  const taxableLines = useMemo<TaxableLine[]>(
    () =>
      lines.map((l) => ({
        qty: Number(l.qty) || 0,
        rate: Number(l.rate) || 0,
        discountPercent: Number(l.discountPercent) || 0,
        gstRate: Number(l.gstRate) || 0,
      })),
    [lines]
  );
  const taxedLines = taxableLines.map((l) => computeLineTax(l, isInterstate));
  const totals = aggregateTotals(taxableLines, taxedLines);

  function update(key: string, patch: Partial<DraftBillLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function applyItem(key: string, itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (!item) {
      update(key, { itemId: null });
      return;
    }
    update(key, {
      itemId: item.id,
      description: item.name,
      hsnSacCode: item.hsnSacCode || '',
      unit: item.unit,
      rate: item.salePrice,
      gstRate: item.gstRate,
    });
  }

  function addLine() {
    onChange([...lines, newBillLine()]);
  }

  function removeLine(key: string) {
    if (lines.length <= 1) return;
    onChange(lines.filter((l) => l.key !== key));
  }

  return (
    <div className="rounded-xl border border-slate-200/70">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2.5 font-medium">Item</th>
              <th className="px-3 py-2.5 font-medium">HSN/SAC</th>
              <th className="w-20 px-3 py-2.5 font-medium">Qty</th>
              <th className="w-24 px-3 py-2.5 font-medium">Unit</th>
              <th className="w-24 px-3 py-2.5 font-medium">Rate</th>
              <th className="w-20 px-3 py-2.5 font-medium">Disc %</th>
              <th className="w-20 px-3 py-2.5 font-medium">GST %</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="w-8 px-3 py-2.5">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={line.key} className="border-b border-slate-50 align-top last:border-0">
                <td className="px-3 py-2">
                  <select
                    aria-label={`Item for line ${idx + 1}`}
                    className="mb-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500"
                    value={line.itemId || ''}
                    onChange={(e) => applyItem(line.key, e.target.value)}
                  >
                    <option value="">Custom line item…</option>
                    {(items || []).map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.name}
                      </option>
                    ))}
                  </select>
                  <input
                    aria-label={`Description for line ${idx + 1}`}
                    className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Description"
                    value={line.description}
                    onChange={(e) => update(line.key, { description: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`HSN/SAC for line ${idx + 1}`}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.hsnSacCode || ''}
                    onChange={(e) => update(line.key, { hsnSacCode: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Quantity for line ${idx + 1}`}
                    type="number"
                    min="0"
                    step="any"
                    className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.qty}
                    onChange={(e) => update(line.key, { qty: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`Unit for line ${idx + 1}`}
                    className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.unit}
                    onChange={(e) => update(line.key, { unit: e.target.value })}
                  >
                    {(units || ['NOS']).map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Rate for line ${idx + 1}`}
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.rate}
                    onChange={(e) => update(line.key, { rate: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    aria-label={`Discount percent for line ${idx + 1}`}
                    type="number"
                    min="0"
                    max="100"
                    className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.discountPercent ?? 0}
                    onChange={(e) => update(line.key, { discountPercent: Number(e.target.value) })}
                  />
                </td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`GST rate for line ${idx + 1}`}
                    className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={line.gstRate}
                    onChange={(e) => update(line.key, { gstRate: Number(e.target.value) })}
                  >
                    {(gstRateSlabs || [0, 5, 12, 18, 28]).map((r) => (
                      <option key={r} value={r}>
                        {r}%
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums text-slate-900">
                  {formatCurrency(taxedLines[idx]?.lineTotal || 0)}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => removeLine(line.key)}
                    disabled={lines.length <= 1}
                    className="text-slate-400 transition-colors hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label={`Remove line ${idx + 1}`}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 p-3">
        <Button type="button" variant="outline" size="sm" onClick={addLine}>
          + Add line
        </Button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>
            Subtotal <strong className="ml-1 font-medium tabular-nums text-slate-700">{formatCurrency(totals.subtotal)}</strong>
          </span>
          <span>
            {isInterstate ? 'IGST' : 'CGST + SGST'}{' '}
            <strong className="ml-1 font-medium tabular-nums text-slate-700">
              {formatCurrency(isInterstate ? totals.totalIgst : totals.totalCgst + totals.totalSgst)}
            </strong>
          </span>
          <span id={`${idPrefix}-total`} className="text-sm text-slate-700">
            Monthly total{' '}
            <strong className="font-semibold tabular-nums text-slate-900">{formatCurrency(totals.grandTotal)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
