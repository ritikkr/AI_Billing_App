import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Spinner } from '../../components/ui/Spinner';
import { BillLinesEditor } from '../../components/monthlybills/BillLinesEditor';
import { apiErrorMessage } from '../../api/client';
import { fetchMeta } from '../../api/meta';
import { listItems } from '../../api/items';
import { getCustomerMonthlyBill, getMonthlyBillCopySources, copyMonthlyBill, saveCustomerMonthlyBill } from '../../api/monthlyBills';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { toBillLinePayload, toBillLines, validateBillLines, type DraftBillLine } from '../../utils/monthlyBill';
import type { Customer } from '../../types';

export function MonthlyBillFormModal({
  open,
  onClose,
  customer,
}: {
  open: boolean;
  onClose: () => void;
  customer: Customer | null;
}) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [lines, setLines] = useState<DraftBillLine[]>(() => toBillLines());
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [copyFrom, setCopyFrom] = useState('');

  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const { data: items } = useQuery({
    queryKey: ['items', companyId, ''],
    queryFn: () => listItems(companyId!),
    enabled: !!companyId,
  });

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['customerMonthlyBill', companyId, customer?.id],
    queryFn: () => getCustomerMonthlyBill(companyId!, customer!.id),
    enabled: !!companyId && !!customer?.id,
  });

  const { data: copySources, isLoading: loadingSources } = useQuery({
    queryKey: ['monthlyBillCopySources', companyId, customer?.id],
    queryFn: () => getMonthlyBillCopySources(companyId!, customer!.id),
    enabled: !!companyId && !!customer?.id,
  });

  useEffect(() => {
    if (!open || !customer?.id) return;
    setLines(toBillLines());
    setNotes('');
    setError('');
    setCopyFrom('');
  }, [open, customer?.id]);

  useEffect(() => {
    if (!existing) return;
    setLines(toBillLines(existing.items));
    setNotes(existing.bill?.notes || '');
  }, [existing]);

  const isInterstate = existing?.isInterstate ?? false;

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        notes: notes.trim() || null,
        items: lines.filter((l) => l.description.trim()).map(toBillLinePayload),
      };
      return saveCustomerMonthlyBill(companyId!, customer!.id, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBills', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerMonthlyBill', companyId, customer!.id] });
      notify(`Monthly bill saved for ${customer!.name}`);
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save monthly bill')),
  });

  const copyMutation = useMutation({
    mutationFn: async () => copyMonthlyBill(companyId!, customer!.id, copyFrom),
    onSuccess: (result) => {
      setLines(toBillLines(result.items));
      setCopyFrom('');
      queryClient.invalidateQueries({ queryKey: ['monthlyBills', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerMonthlyBill', companyId, customer!.id] });
      const source = result.copiedFrom;
      notify(source ? `Copied ${source.itemCount} item(s) from ${source.name}` : 'Monthly bill copied');
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not copy monthly bill')),
  });

  const sourceOptions = useMemo(
    () => (copySources?.sources || []).map((s) => ({ value: s.id, label: s.name, hint: `${s.itemCount} item(s) per month` })),
    [copySources]
  );

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    const validationError = validateBillLines(lines);
    if (validationError) {
      setError(validationError);
      return;
    }
    saveMutation.mutate();
  }

  const group = existing?.customerGroup ?? customer?.group ?? null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Monthly bill${customer ? ` — ${customer.name}` : ''}`}
      subtitle="Recurring items, quantities and prices billed to this customer every month"
      widthClass="max-w-5xl"
      headerActions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="monthly-bill-form" size="sm" loading={saveMutation.isPending} disabled={loadingExisting}>
            Save monthly bill
          </Button>
        </>
      }
    >
      <form id="monthly-bill-form" onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="text-slate-500">Group</span>
          {group ? <Badge className="bg-indigo-50 text-indigo-700">{group}</Badge> : <Badge>Unassigned</Badge>}
          <span className="ml-auto text-xs text-slate-400">
            {isInterstate ? 'Inter-state supply — IGST applies' : 'Intra-state supply — CGST + SGST applies'}
          </span>
        </div>

        {!group && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Assign this customer to a group to unlock copying items and prices from another customer in the same group.
          </p>
        )}

        <div className="space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1">
              <SearchableSelect
                label={group ? `Copy from another customer in "${group}"` : 'Copy from another customer'}
                value={copyFrom}
                onChange={setCopyFrom}
                options={sourceOptions}
                placeholder={loadingSources ? 'Loading customers…' : 'Search customers in this group…'}
                emptyMessage={group ? 'No other customer in this group has a monthly bill yet' : 'Customer has no group'}
                disabled={!group}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => copyMutation.mutate()}
              disabled={!copyFrom || copyMutation.isPending}
              loading={copyMutation.isPending}
            >
              Copy items & prices
            </Button>
          </div>
          {group && !loadingSources && sourceOptions.length === 0 && (
            <p className="text-xs text-slate-400">
              No other customer in this group has a monthly bill yet. Set one up first, then copy it here.
            </p>
          )}
        </div>

        {loadingExisting ? (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        ) : (
          <BillLinesEditor
            idPrefix={`monthly-bill-${customer?.id || 'none'}`}
            lines={lines}
            onChange={setLines}
            items={items}
            units={meta?.units}
            gstRateSlabs={meta?.gstRateSlabs}
            isInterstate={isInterstate}
          />
        )}

        <Textarea
          label="Notes on this monthly bill"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          hint="Optional — shown only in the monthly bill setup, not on the invoice"
        />
      </form>
    </Modal>
  );
}
