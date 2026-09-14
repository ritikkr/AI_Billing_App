import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Input, Textarea } from '../../components/ui/Input';
import { SearchableSelect } from '../../components/ui/SearchableSelect';
import { Button } from '../../components/ui/Button';
import { createCustomer, updateCustomer, listCustomerGroups } from '../../api/customers';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { validateGSTIN } from '../../utils/gst';
import type { Customer } from '../../types';

export function CustomerFormModal({ open, onClose, customer }: { open: boolean; onClose: () => void; customer?: Customer | null }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [form, setForm] = useState(() => toValues(customer));
  const [gstinError, setGstinError] = useState('');
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(toValues(customer));
    setError('');
  }, [customer?.id]);

  const { data: groups } = useQuery({
    queryKey: ['customerGroups', companyId],
    queryFn: () => listCustomerGroups(companyId!),
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = buildPayload(form, sameAsBilling);
      if (customer) return updateCustomer(companyId!, customer.id, payload);
      return createCustomer(companyId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerGroups', companyId] });
      notify(customer ? 'Customer updated' : 'Customer created');
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save customer')),
  });

  function update(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleGstinBlur() {
    if (!form.gstin) {
      setGstinError('');
      return;
    }
    const result = validateGSTIN(form.gstin);
    setGstinError(result.valid ? '' : result.reason || 'Invalid GSTIN');
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.gstin) {
      const result = validateGSTIN(form.gstin);
      if (!result.valid) {
        setGstinError(result.reason || 'Invalid GSTIN');
        return;
      }
    }
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={customer ? 'Edit customer' : 'New customer'}
      subtitle={customer ? `ID ${customer.id.slice(0, 8)}` : 'Add a business or person you bill'}
      widthClass="max-w-2xl"
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-2-7.46m3 6.59a4.5 4.5 0 106 0M13 7a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      }
      headerActions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="customer-form" size="sm" loading={mutation.isPending}>
            {customer ? 'Save changes' : 'Create customer'}
          </Button>
        </>
      }
    >
      <form id="customer-form" onSubmit={handleSubmit} className="space-y-5">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Customer / Business name" required value={form.name} onChange={(e) => update('name', e.target.value)} className="sm:col-span-2" />
          <SearchableSelect
            label="Group"
            value={form.group}
            onChange={(val) => update('group', val)}
            placeholder="Search existing groups or type a new one…"
            emptyMessage="No matching groups — type to create a new one"
            freeText
            hint="e.g. Retailer, Wholesaler, Government – pick an existing group or type a new one"
            options={(groups || []).map((g) => ({ value: g, label: g }))}
          />
          <Input
            label="GSTIN"
            value={form.gstin}
            onChange={(e) => update('gstin', e.target.value.toUpperCase())}
            onBlur={handleGstinBlur}
            error={gstinError}
            maxLength={15}
            hint="Leave blank for an unregistered (B2C) customer"
          />
          <Input label="PAN" value={form.pan} onChange={(e) => update('pan', e.target.value.toUpperCase())} maxLength={10} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Billing address</h4>
          <Textarea label="Address" rows={3} value={form.billingAddress} onChange={(e) => update('billingAddress', e.target.value)} />
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={sameAsBilling} onChange={(e) => setSameAsBilling(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            Shipping address same as billing
          </label>
          {!sameAsBilling && (
            <div className="mt-3">
              <Textarea label="Shipping address" rows={3} value={form.shippingAddress} onChange={(e) => update('shippingAddress', e.target.value)} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Credit limit (₹)" type="number" min="0" value={form.creditLimit} onChange={(e) => update('creditLimit', e.target.value)} />
          <Input label="Opening balance (₹)" type="number" value={form.openingBalance} onChange={(e) => update('openingBalance', e.target.value)} />
          <Input label="Receivable balance (₹)" type="number" value={form.receivableBalance} onChange={(e) => update('receivableBalance', e.target.value)} />
          <Input label="Payable balance (₹)" type="number" value={form.payableBalance} onChange={(e) => update('payableBalance', e.target.value)} />
        </div>
        <Textarea label="Notes" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </form>
    </Modal>
  );
}

function toValues(customer?: Customer | null) {
  return {
    name: customer?.name || '',
    group: customer?.group || '',
    gstin: customer?.gstin || '',
    pan: customer?.pan || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    billingAddress: customer?.billingAddress || '',
    shippingAddress: customer?.shippingAddress || '',
    creditLimit: String(customer?.creditLimit ?? 0),
    openingBalance: String(customer?.openingBalance ?? 0),
    receivableBalance: String(customer?.receivableBalance ?? 0),
    payableBalance: String(customer?.payableBalance ?? 0),
    notes: customer?.notes || '',
  };
}

function buildPayload(form: ReturnType<typeof toValues>, sameAsBilling: boolean) {
  return {
    name: form.name,
    group: form.group || null,
    gstin: form.gstin || null,
    pan: form.pan || null,
    email: form.email || null,
    phone: form.phone || null,
    billingAddress: form.billingAddress || null,
    shippingAddress: sameAsBilling ? form.billingAddress || null : form.shippingAddress || null,
    creditLimit: Number(form.creditLimit) || 0,
    openingBalance: Number(form.openingBalance) || 0,
    receivableBalance: Number(form.receivableBalance) || 0,
    payableBalance: Number(form.payableBalance) || 0,
    notes: form.notes || null,
  };
}
