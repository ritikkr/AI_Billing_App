import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { listCustomers } from '../../api/customers';
import { listItems } from '../../api/items';
import { listInvoices, getInvoice } from '../../api/invoices';
import { fetchMeta } from '../../api/meta';
import { getCompany } from '../../api/companies';
import { createCreditNote } from '../../api/creditNotes';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { formatCurrency, todayIso } from '../../utils/format';
import { computeLineTax, aggregateTotals, type TaxableLine } from '../../utils/gst';
import type { InvoiceLineItem, NoteType } from '../../types';

interface DraftLine extends InvoiceLineItem {
  key: string;
}
let keySeq = 0;
function newLine(): DraftLine {
  return { key: `l${++keySeq}`, itemId: null, description: '', hsnSacCode: '', qty: 1, unit: 'NOS', rate: 0, gstRate: 18 };
}

export default function CreditNoteForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({ queryKey: ['customers', companyId, ''], queryFn: () => listCustomers(companyId!), enabled: !!companyId });
  const { data: items } = useQuery({ queryKey: ['items', companyId, ''], queryFn: () => listItems(companyId!), enabled: !!companyId });
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const { data: company } = useQuery({ queryKey: ['company', companyId], queryFn: () => getCompany(companyId!), enabled: !!companyId });

  const [noteType, setNoteType] = useState<NoteType>('credit');
  const [customerId, setCustomerId] = useState('');
  const [invoiceId, setInvoiceId] = useState(searchParams.get('invoiceId') || '');
  const [noteDate, setNoteDate] = useState(todayIso());
  const [reason, setReason] = useState('');
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [error, setError] = useState('');

  const { data: customerInvoices } = useQuery({
    queryKey: ['invoices', companyId, 'for-customer', customerId],
    queryFn: () => listInvoices(companyId!, { customerId }),
    enabled: !!companyId && !!customerId,
  });

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  useEffect(() => {
    if (selectedCustomer && !placeOfSupplyStateCode) {
      const stateCode = selectedCustomer.gstin ? selectedCustomer.gstin.slice(0, 2) : '';
      setPlaceOfSupplyStateCode(stateCode || '');
    }
  }, [selectedCustomer, placeOfSupplyStateCode]);

  // Prefill from an invoice if navigated with ?invoiceId=
  useEffect(() => {
    if (invoiceId && companyId && !customerId) {
      getInvoice(companyId, invoiceId).then((inv) => {
        setCustomerId(inv.customerId);
        setPlaceOfSupplyStateCode(inv.placeOfSupplyStateCode);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, companyId]);

  const companyStateCode = company?.stateCode || '';
  const isInterstate = useMemo(
    () => (companyStateCode && placeOfSupplyStateCode ? placeOfSupplyStateCode !== companyStateCode : false),
    [companyStateCode, placeOfSupplyStateCode]
  );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function selectItemForLine(key: string, itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (!item) return updateLine(key, { itemId: null });
    updateLine(key, { itemId: item.id, description: item.name, hsnSacCode: item.hsnSacCode || '', unit: item.unit, rate: item.salePrice, gstRate: item.gstRate });
  }
  function addLine() {
    setLines((ls) => [...ls, newLine()]);
  }
  function removeLine(key: string) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  const taxableLines: TaxableLine[] = lines.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, gstRate: Number(l.gstRate) || 0 }));
  const taxedLines = taxableLines.map((l) => computeLineTax(l, isInterstate));
  const totals = aggregateTotals(taxableLines, taxedLines);

  const mutation = useMutation({
    mutationFn: () =>
      createCreditNote(companyId!, {
        noteType,
        customerId,
        invoiceId: invoiceId || null,
        noteDate,
        reason: reason || null,
        placeOfSupplyStateCode: placeOfSupplyStateCode || undefined,
        notes: notes || null,
        lineItems: lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description,
          hsnSacCode: l.hsnSacCode || undefined,
          qty: Number(l.qty),
          unit: l.unit,
          rate: Number(l.rate),
          gstRate: Number(l.gstRate),
        })),
      }),
    onSuccess: (note) => {
      queryClient.invalidateQueries({ queryKey: ['credit-notes', companyId] });
      notify(`${note.noteType === 'credit' ? 'Credit' : 'Debit'} note ${note.noteNumber} created`);
      navigate(`/credit-notes/${note.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not create note')),
  });

  function handleSubmit() {
    setError('');
    if (!customerId) return setError('Please select a customer');
    if (!placeOfSupplyStateCode) return setError('Please select a place of supply');
    if (lines.every((l) => !l.description.trim())) return setError('Add at least one line item');
    mutation.mutate();
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Link to="/credit-notes" className="text-sm text-slate-400 hover:text-slate-600">
          Credit / Debit Notes
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">New Note</h1>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader title="Note details" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select label="Note type" value={noteType} onChange={(e) => setNoteType(e.target.value as NoteType)}>
            <option value="credit">Credit Note (reduces amount owed)</option>
            <option value="debit">Debit Note (increases amount owed)</option>
          </Select>
          <Select label="Customer" required value={customerId} onChange={(e) => { setCustomerId(e.target.value); setInvoiceId(''); }}>
            <option value="">Select a customer</option>
            {(customers || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select label="Against invoice (optional)" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
            <option value="">Not linked to an invoice</option>
            {(customerInvoices || []).map((inv) => (
              <option key={inv.id} value={inv.id}>
                {inv.invoiceNumber} — {formatCurrency(inv.grandTotal)}
              </option>
            ))}
          </Select>
          <Input label="Note date" type="date" required value={noteDate} onChange={(e) => setNoteDate(e.target.value)} />
          <Select label="Place of supply" required value={placeOfSupplyStateCode} onChange={(e) => setPlaceOfSupplyStateCode(e.target.value)}>
            <option value="">Select state</option>
            {(meta?.states || []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Goods returned, pricing correction" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line items" subtitle={isInterstate ? 'Inter-state — IGST' : 'Intra-state — CGST + SGST'} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-3 py-2.5 font-medium">Item</th>
                <th className="px-3 py-2.5 font-medium">HSN/SAC</th>
                <th className="w-20 px-3 py-2.5 font-medium">Qty</th>
                <th className="w-24 px-3 py-2.5 font-medium">Rate</th>
                <th className="w-20 px-3 py-2.5 font-medium">GST %</th>
                <th className="px-3 py-2.5 text-right font-medium">Amount</th>
                <th className="w-8 px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key} className="border-b border-slate-50 align-top">
                  <td className="px-3 py-2">
                    <select className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500" value={line.itemId || ''} onChange={(e) => selectItemForLine(line.key, e.target.value)}>
                      <option value="">Custom line item…</option>
                      {(items || []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm" placeholder="Description" value={line.description} onChange={(e) => updateLine(line.key, { description: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={line.hsnSacCode || ''} onChange={(e) => updateLine(line.key, { hsnSacCode: e.target.value })} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="any" className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={line.qty} onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="number" min="0" step="0.01" className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={line.rate} onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })} />
                  </td>
                  <td className="px-3 py-2">
                    <select className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm" value={line.gstRate} onChange={(e) => updateLine(line.key, { gstRate: Number(e.target.value) })}>
                      {(meta?.gstRateSlabs || [0, 5, 12, 18, 28]).map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(taxedLines[idx]?.lineTotal || 0)}</td>
                  <td className="px-3 py-2">
            <button type="button" onClick={() => removeLine(line.key)} className="text-slate-400 hover:text-red-600" aria-label={`Remove line ${idx + 1}`}>
              <span aria-hidden="true">✕</span>
            </button>
          </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-100 p-4">
          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + Add line
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Notes" />
          <CardBody>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Summary" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Taxable value" value={totals.taxableValue} />
            {isInterstate ? <Row label="IGST" value={totals.totalIgst} /> : (
              <>
                <Row label="CGST" value={totals.totalCgst} />
                <Row label="SGST" value={totals.totalSgst} />
              </>
            )}
            {totals.roundOff !== 0 && <Row label="Round off" value={totals.roundOff} />}
            <div className="border-t border-slate-100 pt-2">
              <Row label="Grand total" value={totals.grandTotal} bold />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-200 bg-slate-50/95 px-1 py-3 backdrop-blur">
        <Button onClick={handleSubmit} loading={mutation.isPending}>
          Issue {noteType === 'credit' ? 'Credit' : 'Debit'} Note
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
