import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchMeta } from '../api/meta';
import { Input, Select, Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { validateGSTIN } from '../utils/gst';
import type { Company } from '../types';

export interface CompanyFormValues {
  name: string;
  gstin: string;
  pan: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateCode: string;
  pincode: string;
  phone: string;
  email: string;
  bankName: string;
  bankAccountNo: string;
  bankIfsc: string;
  bankBranch: string;
  invoicePrefix: string;
  creditNotePrefix: string;
  debitNotePrefix: string;
  financialYearStartMonth: number;
  termsAndConditions: string;
}

function toFormValues(company?: Company | null): CompanyFormValues {
  return {
    name: company?.name || '',
    gstin: company?.gstin || '',
    pan: company?.pan || '',
    addressLine1: company?.addressLine1 || '',
    addressLine2: company?.addressLine2 || '',
    city: company?.city || '',
    stateCode: company?.stateCode || '27',
    pincode: company?.pincode || '',
    phone: company?.phone || '',
    email: company?.email || '',
    bankName: company?.bankName || '',
    bankAccountNo: company?.bankAccountNo || '',
    bankIfsc: company?.bankIfsc || '',
    bankBranch: company?.bankBranch || '',
    invoicePrefix: company?.invoicePrefix || 'INV',
    creditNotePrefix: company?.creditNotePrefix || 'CN',
    debitNotePrefix: company?.debitNotePrefix || 'DN',
    financialYearStartMonth: company?.financialYearStartMonth || 4,
    termsAndConditions: company?.termsAndConditions || '',
  };
}

export function CompanyForm({
  initial,
  onSubmit,
  submitLabel = 'Save',
  loading,
}: {
  initial?: Company | null;
  onSubmit: (values: ReturnType<typeof buildPayload>) => Promise<void> | void;
  submitLabel?: string;
  loading?: boolean;
}) {
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });
  const [values, setValues] = useState<CompanyFormValues>(() => toFormValues(initial));
  const [gstinError, setGstinError] = useState('');

  function update<K extends keyof CompanyFormValues>(key: K, value: CompanyFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleGstinBlur() {
    if (!values.gstin) {
      setGstinError('');
      return;
    }
    const result = validateGSTIN(values.gstin);
    setGstinError(result.valid ? '' : result.reason || 'Invalid GSTIN');
    if (result.valid) {
      update('stateCode', values.gstin.slice(0, 2));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (values.gstin) {
      const result = validateGSTIN(values.gstin);
      if (!result.valid) {
        setGstinError(result.reason || 'Invalid GSTIN');
        return;
      }
    }
    await onSubmit(buildPayload(values, meta?.states || []));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Business details</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Company name" required value={values.name} onChange={(e) => update('name', e.target.value)} className="sm:col-span-2" />
          <Input
            label="GSTIN"
            value={values.gstin}
            onChange={(e) => update('gstin', e.target.value.toUpperCase())}
            onBlur={handleGstinBlur}
            error={gstinError}
            hint="15-character GST Identification Number (optional for unregistered businesses)"
            maxLength={15}
            placeholder="27AAPFU0939F1ZV"
          />
          <Input label="PAN" value={values.pan} onChange={(e) => update('pan', e.target.value.toUpperCase())} maxLength={10} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Registered address</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Address line 1" value={values.addressLine1} onChange={(e) => update('addressLine1', e.target.value)} className="sm:col-span-2" />
          <Input label="Address line 2" value={values.addressLine2} onChange={(e) => update('addressLine2', e.target.value)} className="sm:col-span-2" />
          <Input label="City" value={values.city} onChange={(e) => update('city', e.target.value)} />
          <Input label="Pincode" value={values.pincode} onChange={(e) => update('pincode', e.target.value)} />
          <Select label="State" required value={values.stateCode} onChange={(e) => update('stateCode', e.target.value)}>
            {(meta?.states || []).map((s) => (
              <option key={s.code} value={s.code}>
                {s.name}
              </option>
            ))}
          </Select>
          <Input label="Phone" value={values.phone} onChange={(e) => update('phone', e.target.value)} />
          <Input label="Email" type="email" value={values.email} onChange={(e) => update('email', e.target.value)} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Bank details (shown on invoices)</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Bank name" value={values.bankName} onChange={(e) => update('bankName', e.target.value)} />
          <Input label="Branch" value={values.bankBranch} onChange={(e) => update('bankBranch', e.target.value)} />
          <Input label="Account number" value={values.bankAccountNo} onChange={(e) => update('bankAccountNo', e.target.value)} />
          <Input label="IFSC code" value={values.bankIfsc} onChange={(e) => update('bankIfsc', e.target.value.toUpperCase())} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-sm font-semibold text-slate-900">Invoicing preferences</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Input label="Invoice prefix" value={values.invoicePrefix} onChange={(e) => update('invoicePrefix', e.target.value.toUpperCase())} hint="e.g. INV/2026-27/0001" />
          <Input label="Credit note prefix" value={values.creditNotePrefix} onChange={(e) => update('creditNotePrefix', e.target.value.toUpperCase())} />
          <Input label="Debit note prefix" value={values.debitNotePrefix} onChange={(e) => update('debitNotePrefix', e.target.value.toUpperCase())} />
          <Select
            label="Financial year starts"
            value={values.financialYearStartMonth}
            onChange={(e) => update('financialYearStartMonth', Number(e.target.value))}
            className="sm:col-span-1"
          >
            {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, idx) => (
              <option key={m} value={idx + 1}>
                {m}
              </option>
            ))}
          </Select>
        </div>
        <div className="mt-4">
          <Textarea
            label="Default terms & conditions"
            rows={3}
            value={values.termsAndConditions}
            onChange={(e) => update('termsAndConditions', e.target.value)}
            hint="Printed at the bottom of every invoice by default"
          />
        </div>
      </section>

      <div className="flex justify-end border-t border-slate-100 pt-4">
        <Button type="submit" loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

function buildPayload(values: CompanyFormValues, states: { code: string; name: string }[]) {
  const state = states.find((s) => s.code === values.stateCode);
  return {
    name: values.name,
    gstin: values.gstin || null,
    pan: values.pan || null,
    addressLine1: values.addressLine1 || null,
    addressLine2: values.addressLine2 || null,
    city: values.city || null,
    state: state?.name || '',
    stateCode: values.stateCode,
    pincode: values.pincode || null,
    phone: values.phone || null,
    email: values.email || null,
    bankName: values.bankName || null,
    bankAccountNo: values.bankAccountNo || null,
    bankIfsc: values.bankIfsc || null,
    bankBranch: values.bankBranch || null,
    invoicePrefix: values.invoicePrefix,
    creditNotePrefix: values.creditNotePrefix,
    debitNotePrefix: values.debitNotePrefix,
    financialYearStartMonth: values.financialYearStartMonth,
    termsAndConditions: values.termsAndConditions || null,
  };
}
