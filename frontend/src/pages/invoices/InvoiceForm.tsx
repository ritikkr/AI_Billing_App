import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { listCustomers } from '../../api/customers';
import { listItems } from '../../api/items';
import { fetchMeta } from '../../api/meta';
import { getCompany } from '../../api/companies';
import { createInvoice, getInvoice, updateInvoice } from '../../api/invoices';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { PageLoader } from '../../components/ui/Spinner';
import { formatCurrency, todayIso } from '../../utils/format';
import { computeLineTax, aggregateTotals, type TaxableLine } from '../../utils/gst';
import type { InvoiceLineItem } from '../../types';

interface DraftLine extends InvoiceLineItem {
  key: string;
}

let keySeq = 0;
function newLine(): DraftLine {
  return { key: `l${++keySeq}`, itemId: null, description: '', hsnSacCode: '', qty: 1, unit: 'NOS', rate: 0, discountPercent: 0, gstRate: 18 };
}

export default function InvoiceForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: customers } = useQuery({ queryKey: ['customers', companyId, ''], queryFn: () => listCustomers(companyId!), enabled: !!companyId });
  const { data: items } = useQuery({ queryKey: ['items', companyId, ''], queryFn: () => listItems(companyId!), enabled: !!companyId });
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const { data: company } = useQuery({ queryKey: ['company', companyId], queryFn: () => getCompany(companyId!), enabled: !!companyId });
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['invoice', companyId, id],
    queryFn: () => getInvoice(companyId!, id!),
    enabled: !!companyId && isEdit,
  });

  const [customerId, setCustomerId] = useState(searchParams.get('customerId') || '');
  const [invoiceDate, setInvoiceDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupplyStateCode, setPlaceOfSupplyStateCode] = useState('');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);
  const [error, setError] = useState('');

  const selectedCustomer = customers?.find((c) => c.id === customerId);

  useEffect(() => {
    if (existing) {
      setCustomerId(existing.customerId);
      setInvoiceDate(existing.invoiceDate);
      setDueDate(existing.dueDate || '');
      setPlaceOfSupplyStateCode(existing.placeOfSupplyStateCode);
      setNotes(existing.notes || '');
      setTerms(existing.terms || '');
      setReverseCharge(existing.reverseCharge);
      setLines(
        existing.lineItems.map((l) => ({
          key: `e${++keySeq}`,
          itemId: l.itemId,
          description: l.description,
          hsnSacCode: l.hsnSacCode || '',
          qty: l.qty,
          unit: l.unit,
          rate: l.rate,
          discountPercent: l.discountPercent || 0,
          gstRate: l.gstRate,
        }))
      );
    }
  }, [existing]);

  useEffect(() => {
    if (!isEdit && selectedCustomer && !placeOfSupplyStateCode) {
      const stateCode = selectedCustomer.gstin ? selectedCustomer.gstin.slice(0, 2) : '';
      setPlaceOfSupplyStateCode(stateCode || '');
    }
  }, [selectedCustomer, isEdit, placeOfSupplyStateCode]);

  const companyStateCode = company?.stateCode || '';

  const isInterstate = useMemo(() => {
    // The backend recomputes this authoritatively on save; this is just a live preview.
    return companyStateCode && placeOfSupplyStateCode ? placeOfSupplyStateCode !== companyStateCode : false;
  }, [companyStateCode, placeOfSupplyStateCode]);

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  function selectItemForLine(key: string, itemId: string) {
    const item = items?.find((i) => i.id === itemId);
    if (!item) {
      updateLine(key, { itemId: null });
      return;
    }
    updateLine(key, {
      itemId: item.id,
      description: item.name,
      hsnSacCode: item.hsnSacCode || '',
      unit: item.unit,
      rate: item.salePrice,
      gstRate: item.gstRate,
    });
  }

  function addLine() {
    setLines((ls) => [...ls, newLine()]);
  }
  function removeLine(key: string) {
    setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.key !== key) : ls));
  }

  const taxableLines: TaxableLine[] = lines.map((l) => ({ qty: Number(l.qty) || 0, rate: Number(l.rate) || 0, discountPercent: Number(l.discountPercent) || 0, gstRate: Number(l.gstRate) || 0 }));
  const taxedLines = taxableLines.map((l) => computeLineTax(l, isInterstate));
  const totals = aggregateTotals(taxableLines, taxedLines);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        invoiceDate,
        dueDate: dueDate || null,
        placeOfSupplyStateCode: placeOfSupplyStateCode || undefined,
        reverseCharge,
        notes: notes || null,
        terms: terms || null,
        lineItems: lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description,
          hsnSacCode: l.hsnSacCode || undefined,
          qty: Number(l.qty),
          unit: l.unit,
          rate: Number(l.rate),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate),
        })),
      };
      if (isEdit) return updateInvoice(companyId!, id!, { ...payload, status: existing?.status === 'draft' ? 'draft' : 'sent' });
      return createInvoice(companyId!, { ...payload, status: 'sent' });
    },
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] });
      notify(isEdit ? 'Invoice updated' : `Invoice ${inv.invoiceNumber} created`);
      navigate(`/invoices/${inv.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save invoice')),
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        customerId,
        invoiceDate,
        dueDate: dueDate || null,
        placeOfSupplyStateCode: placeOfSupplyStateCode || undefined,
        reverseCharge,
        status: 'draft' as const,
        notes: notes || null,
        terms: terms || null,
        lineItems: lines.map((l) => ({
          itemId: l.itemId || undefined,
          description: l.description,
          hsnSacCode: l.hsnSacCode || undefined,
          qty: Number(l.qty),
          unit: l.unit,
          rate: Number(l.rate),
          discountPercent: Number(l.discountPercent) || 0,
          gstRate: Number(l.gstRate),
        })),
      };
      if (isEdit) return updateInvoice(companyId!, id!, payload);
      return createInvoice(companyId!, payload);
    },
    onSuccess: (inv) => {
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      notify('Draft saved');
      navigate(`/invoices/${inv.id}`);
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save draft')),
  });

  function validate(): string | null {
    if (!customerId) return 'Please select a customer';
    if (!placeOfSupplyStateCode) return 'Please select a place of supply';
    if (lines.length === 0 || lines.every((l) => !l.description.trim())) return 'Add at least one line item';
    for (const l of lines) {
      if (!l.description.trim()) return 'Every line item needs a description';
      if (!l.qty || Number(l.qty) <= 0) return 'Quantity must be greater than 0';
    }
    return null;
  }

  function handleSubmit(asDraft: boolean) {
    setError('');
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    if (asDraft) saveDraftMutation.mutate();
    else mutation.mutate();
  }

  if (isEdit && loadingExisting) return <PageLoader />;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <div className="flex items-center gap-2">
        <Link to="/invoices" className="text-sm text-slate-400 hover:text-slate-600">
          Invoices
        </Link>
        <span className="text-slate-300">/</span>
        <h1 className="text-xl font-semibold text-slate-900">{isEdit ? `Edit ${existing?.invoiceNumber}` : 'New Invoice'}</h1>
      </div>

      {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <Card>
        <CardHeader title="Invoice details" />
        <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SearchableSelect
            label="Customer"
            required
            value={customerId}
            onChange={setCustomerId}
            placeholder="Search by name, GSTIN or email…"
            className="sm:col-span-2"
            options={(customers || []).map((c) => ({
              value: c.id,
              label: c.name,
              searchText: `${c.gstin || ''} ${c.email || ''}`,
              hint: c.gstin ? `GSTIN: ${c.gstin}` : 'Unregistered (B2C)',
            }))}
          />
          <Select
            label="Place of supply"
            required
            value={placeOfSupplyStateCode}
            onChange={(e) => setPlaceOfSupplyStateCode(e.target.value)}
            hint="Determines CGST+SGST vs IGST"
          >
            <option value="">Select state</option>
            {(meta?.states || []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
          <div />
          <Input label="Invoice date" type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          <Input label="Due date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} hint="Optional" />
          <label className="flex items-end gap-2 pb-2 text-sm text-slate-700">
            <input type="checkbox" checked={reverseCharge} onChange={(e) => setReverseCharge(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Reverse charge applicable
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line items" subtitle={isInterstate ? 'Inter-state supply — IGST will apply' : 'Intra-state supply — CGST + SGST will apply'} />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Item</th>
                <th className="px-3 py-2 font-medium">HSN/SAC</th>
                <th className="w-20 px-3 py-2 font-medium">Qty</th>
                <th className="w-24 px-3 py-2 font-medium">Rate</th>
                <th className="w-20 px-3 py-2 font-medium">Disc %</th>
                <th className="w-20 px-3 py-2 font-medium">GST %</th>
                <th className="px-3 py-2 text-right font-medium">Amount</th>
                <th className="w-8 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={line.key} className="border-b border-slate-50 align-top">
                  <td className="px-3 py-2">
                    <select
                      className="mb-1 w-full rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-500"
                      value={line.itemId || ''}
                      onChange={(e) => selectItemForLine(line.key, e.target.value)}
                    >
                      <option value="">Custom line item…</option>
                      {(items || []).map((i) => (
                        <option key={i.id} value={i.id}>
                          {i.name}
                        </option>
                      ))}
                    </select>
                    <input
                      className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      placeholder="Description"
                      value={line.description}
                      onChange={(e) => updateLine(line.key, { description: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={line.hsnSacCode || ''}
                      onChange={(e) => updateLine(line.key, { hsnSacCode: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={line.qty}
                      onChange={(e) => updateLine(line.key, { qty: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-24 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={line.rate}
                      onChange={(e) => updateLine(line.key, { rate: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={line.discountPercent}
                      onChange={(e) => updateLine(line.key, { discountPercent: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="w-20 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      value={line.gstRate}
                      onChange={(e) => updateLine(line.key, { gstRate: Number(e.target.value) })}
                    >
                      {(meta?.gstRateSlabs || [0, 5, 12, 18, 28]).map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-slate-900">{formatCurrency(taxedLines[idx]?.lineTotal || 0)}</td>
                  <td className="px-3 py-2">
                    <button type="button" onClick={() => removeLine(line.key)} className="text-slate-400 hover:text-red-600">
                      ✕
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
          <CardHeader title="Notes & terms" />
          <CardBody className="space-y-4">
            <Textarea label="Notes to customer" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            <Textarea label="Terms & conditions" rows={3} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Summary" />
          <CardBody className="space-y-2 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.totalDiscount > 0 && <Row label="Discount" value={-totals.totalDiscount} />}
            <Row label="Taxable value" value={totals.taxableValue} />
            {isInterstate ? (
              <Row label="IGST" value={totals.totalIgst} />
            ) : (
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
        <Button variant="outline" onClick={() => handleSubmit(true)} loading={saveDraftMutation.isPending}>
          Save as draft
        </Button>
        <Button onClick={() => handleSubmit(false)} loading={mutation.isPending}>
          {isEdit ? 'Save & Send' : 'Create & Send'}
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
