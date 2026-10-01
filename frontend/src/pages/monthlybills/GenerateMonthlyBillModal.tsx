import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { PageLoader, Spinner } from '../../components/ui/Spinner';
import { BillLinesEditor } from '../../components/monthlybills/BillLinesEditor';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { fetchMeta } from '../../api/meta';
import { listItems } from '../../api/items';
import { listCustomerGroups } from '../../api/customers';
import { generateMonthlyBills, listMonthlyBills } from '../../api/monthlyBills';
import { addDaysIso, formatCurrency, initials, todayIso } from '../../utils/format';
import { aggregateTotals, computeLineTax } from '../../utils/gst';
import { toBillLinePayload, toBillLines, validateBillLines, type DraftBillLine } from '../../utils/monthlyBill';
import type { MonthlyBillSummary } from '../../types';

type TargetMode = 'group' | 'individual';

/** Sentinel used by the group filter; customers with no group are billed together. */
const UNGROUPED = '__ungrouped__';

const groupKey = (bill: MonthlyBillSummary) => bill.customerGroup || UNGROUPED;

export function GenerateMonthlyBillModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [mode, setMode] = useState<TargetMode>('group');
  const [group, setGroup] = useState('');
  const [search, setSearch] = useState('');
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, DraftBillLine[]>>({});
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [paymentTermDays, setPaymentTermDays] = useState('15');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [error, setError] = useState('');

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const { data: groups } = useQuery({ queryKey: ['customerGroups', companyId], queryFn: () => listCustomerGroups(companyId!), enabled: !!companyId });
  const { data: items } = useQuery({ queryKey: ['items', companyId, ''], queryFn: () => listItems(companyId!), enabled: !!companyId });
  const { data: bills, isLoading } = useQuery({
    queryKey: ['monthlyBills', companyId, 'withItems'],
    queryFn: () => listMonthlyBills(companyId!, '', true),
    enabled: !!companyId && open,
  });

  useEffect(() => {
    if (!open) return;
    setError('');
    setSearch('');
    setExpanded(null);
    setInvoiceDate(todayIso());
    setPaymentTermDays('15');
    setNotes('');
    setTerms('');
  }, [open]);

  // Seed editable line drafts and default selection whenever the bill set changes.
  useEffect(() => {
    if (!bills) return;
    const nextDrafts: Record<string, DraftBillLine[]> = {};
    for (const bill of bills) nextDrafts[bill.customerId] = toBillLines(bill.items);
    setDrafts(nextDrafts);
    setIncluded(new Set(bills.filter((b) => b.isActive && b.itemCount > 0).map((b) => b.customerId)));
  }, [bills]);

  const groupOptions = useMemo(() => {
    const names = new Set((groups || []).filter(Boolean) as string[]);
    let hasUngrouped = false;
    for (const bill of bills || []) {
      if (bill.customerGroup) names.add(bill.customerGroup);
      else hasUngrouped = true;
    }
    return { names: Array.from(names).sort(), hasUngrouped };
  }, [groups, bills]);

  const targets = useMemo(() => {
    const all = (bills || []).filter((b) => b.itemCount > 0);
    const scoped = mode === 'group' ? all.filter((b) => groupKey(b) === group) : all;
    const q = search.trim().toLowerCase();
    return q ? scoped.filter((b) => b.customerName.toLowerCase().includes(q)) : scoped;
  }, [bills, mode, group, search]);

  const dueDate = useMemo(() => {
    const days = Number(paymentTermDays);
    return days > 0 ? addDaysIso(days, new Date(invoiceDate)) : '';
  }, [paymentTermDays, invoiceDate]);

  function draftTotal(bill: MonthlyBillSummary): number {
    return computeDraftTotal(drafts[bill.customerId] || [], bill.isInterstate);
  }

  const selectedBills = useMemo(
    () => targets.filter((b) => included.has(b.customerId)),
    [targets, included]
  );

  const grandTotal = useMemo(
    () => selectedBills.reduce((sum, b) => sum + computeDraftTotal(drafts[b.customerId] || [], b.isInterstate), 0),
    [selectedBills, drafts]
  );

  function toggleIncluded(customerId: string) {
    setIncluded((prev) => {
      const next = new Set(prev);
      if (next.has(customerId)) next.delete(customerId);
      else next.add(customerId);
      return next;
    });
  }

  function toggleAll() {
    const selectable = targets.filter((b) => b.isActive);
    setIncluded((prev) => (selectable.every((b) => prev.has(b.customerId)) ? new Set() : new Set(selectable.map((b) => b.customerId))));
  }

  function resetDraft(customerId: string, bill: MonthlyBillSummary) {
    setDrafts((prev) => ({ ...prev, [customerId]: toBillLines(bill.items) }));
  }

  const generateMutation = useMutation({
    mutationFn: async () => {
      const invoices = selectedBills.map((bill) => ({
        customerId: bill.customerId,
        lineItems: (drafts[bill.customerId] || []).filter((l) => l.description.trim()).map(toBillLinePayload),
      }));
      return generateMonthlyBills(companyId!, {
        invoiceDate,
        dueDate: dueDate || null,
        status: 'draft',
        notes: notes.trim() || null,
        terms: terms.trim() || null,
        invoices,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] });
      const skipped = result.skippedCount > 0 ? `, ${result.skippedCount} skipped` : '';
      notify(`${result.createdCount} draft invoice(s) created${skipped}`);
      onClose();
      if (result.createdCount === 1) navigate(`/invoices/${result.created[0].id}`);
      else navigate('/invoices');
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not generate monthly bills')),
  });

  function handleGenerate() {
    setError('');
    if (selectedBills.length === 0) {
      setError('Select at least one customer to bill');
      return;
    }
    if (!invoiceDate) {
      setError('Choose an invoice date');
      return;
    }
    for (const bill of selectedBills) {
      const problem = validateBillLines(drafts[bill.customerId] || []);
      if (problem) {
        setError(`${bill.customerName}: ${problem}`);
        setExpanded(bill.customerId);
        return;
      }
    }
    generateMutation.mutate();
  }

  const groupCustomerCount = mode === 'group' && group
    ? (bills || []).filter((b) => groupKey(b) === group && b.itemCount > 0).length
    : 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate monthly bills"
      subtitle="Creates one draft invoice per customer from their saved monthly bill"
      widthClass="max-w-5xl"
      headerActions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={handleGenerate} loading={generateMutation.isPending} disabled={selectedBills.length === 0}>
            Create {selectedBills.length} draft invoice{selectedBills.length === 1 ? '' : 's'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Who to bill */}
        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Bill for</h3>
          <div role="tablist" aria-label="Select customers to bill" className="inline-flex rounded-lg bg-slate-100 p-1">
            {(
              [
                { key: 'group' as const, label: 'Customer group' },
                { key: 'individual' as const, label: 'Individual customers' },
              ]
            ).map((tab) => (
              <button
                key={tab.key}
                role="tab"
                type="button"
                aria-selected={mode === tab.key}
                onClick={() => setMode(tab.key)}
                className={clsx(
                  'rounded-md px-3 py-1.5 text-sm font-medium transition duration-150',
                  mode === tab.key ? 'bg-white text-slate-900 shadow-card' : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {mode === 'group' ? (
            <Select
              label="Group"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              hint={group ? `${groupCustomerCount} customer(s) in this group have a monthly bill` : 'Pick the group whose customers you want to bill'}
            >
              <option value="">Select a group…</option>
              {groupOptions.names.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
              {groupOptions.hasUngrouped && <option value={UNGROUPED}>No group</option>}
            </Select>
          ) : (
            <Input
              type="search"
              placeholder="Filter customers…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Filter customers"
            />
          )}
        </section>

        {/* Invoice details */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Invoice date" type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <Input
            label="Payment terms (days)"
            type="number"
            min="0"
            value={paymentTermDays}
            onChange={(e) => setPaymentTermDays(e.target.value)}
            hint={dueDate ? `Due ${dueDate}` : '0 = no due date'}
          />
          <div className="flex items-end">
            <p className="pb-2 text-xs text-slate-500">
              Invoices are created as <Badge>draft</Badge> so you can review before sending.
            </p>
          </div>
        </section>

        {/* Review */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Review &amp; adjust
            </h3>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-500">
                {selectedBills.length} selected · {formatCurrency(grandTotal)} total
              </span>
              {targets.length > 0 && (
                <button type="button" onClick={toggleAll} className="font-medium text-indigo-600 hover:text-indigo-700">
                  {selectedBills.length === targets.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : targets.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
              <p className="text-sm text-slate-500">
                {mode === 'group' && !group
                  ? 'Select a group to see its customers.'
                  : 'No customers with a monthly bill here yet. Set one up under Monthly Bills first.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {targets.map((bill) => {
                const isIncluded = included.has(bill.customerId);
                const isOpen = expanded === bill.customerId;
                const lines = drafts[bill.customerId] || [];
                const dirty = JSON.stringify(toBillLines(bill.items)) !== JSON.stringify(lines);

                return (
                  <li key={bill.customerId} className={clsx('overflow-hidden rounded-xl border transition-colors', isIncluded ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 bg-white')}>
                    <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        disabled={!bill.isActive}
                        onChange={() => toggleIncluded(bill.customerId)}
                        aria-label={`Include ${bill.customerName}`}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 disabled:opacity-40"
                      />
                      <span
                        aria-hidden
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 text-xs font-semibold text-white"
                      >
                        {initials(bill.customerName)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-medium text-slate-900">{bill.customerName}</span>
                          {bill.customerGroup && <Badge className="bg-slate-100 text-slate-600">{bill.customerGroup}</Badge>}
                          {bill.isInterstate && <Badge className="bg-violet-50 text-violet-700">IGST</Badge>}
                          {!bill.isActive && <Badge className="bg-slate-100 text-slate-400">Archived</Badge>}
                          {dirty && isIncluded && <Badge className="bg-amber-50 text-amber-700">Edited</Badge>}
                        </div>
                        <p className="text-xs text-slate-500">
                          {bill.itemCount} item{bill.itemCount === 1 ? '' : 's'} per month
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(draftTotal(bill))}</p>
                        {dirty && <p className="text-xs text-slate-400 line-through">{formatCurrency(bill.monthlyGrandTotal)}</p>}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setExpanded(isOpen ? null : bill.customerId)}
                        aria-expanded={isOpen}
                      >
                        {isOpen ? 'Close' : 'Adjust'}
                      </Button>
                    </div>

                    {isOpen && (
                      <div className="space-y-2 border-t border-slate-200/70 bg-white px-3 py-3">
                        <BillLinesEditor
                          idPrefix={`generate-${bill.customerId}`}
                          lines={lines}
                          onChange={(next) => setDrafts((prev) => ({ ...prev, [bill.customerId]: next }))}
                          items={items}
                          units={meta?.units}
                          gstRateSlabs={meta?.gstRateSlabs}
                          isInterstate={bill.isInterstate}
                        />
                        {dirty && (
                          <Button type="button" variant="outline" size="sm" onClick={() => resetDraft(bill.customerId, bill)}>
                            Reset to saved monthly bill
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <details className="rounded-xl border border-slate-200/70 px-3 py-2">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Notes &amp; terms on every invoice</summary>
          <div className="mt-3 space-y-3">
            <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Textarea label="Terms & conditions" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
        </details>

        {generateMutation.isPending && (
          <p className="flex items-center justify-center gap-2 text-sm text-slate-500">
            <Spinner className="h-4 w-4" />
            Creating invoices…
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Uses the same tax engine as the backend, so the preview total matches the created invoice. */
function computeDraftTotal(lines: DraftBillLine[], isInterstate: boolean): number {
  const taxable = lines.map((l) => ({
    qty: Number(l.qty) || 0,
    rate: Number(l.rate) || 0,
    discountPercent: Number(l.discountPercent) || 0,
    gstRate: Number(l.gstRate) || 0,
  }));
  return aggregateTotals(taxable, taxable.map((l) => computeLineTax(l, isInterstate))).grandTotal;
}
