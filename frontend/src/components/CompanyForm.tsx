import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMeta } from '../api/meta';
import { Input, Select, Textarea } from './ui/Input';
import { Button } from './ui/Button';
import { validateGSTIN } from '../utils/gst';
import { apiErrorMessage } from '../api/client';
import { uploadCompanyLogo, removeCompanyLogo, uploadCompanySignature, removeCompanySignature } from '../api/companies';
import { useToast } from '../context/ToastContext';
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

      {initial?.id && (
        <section>
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Branding (shown on invoices)</h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <BrandingUpload
              label="Company logo"
              value={initial.logoUrl}
              fileKind="logo"
              companyId={initial.id}
              hint="PNG or JPG, max 2MB. Appears at the top of invoices."
              placeholder="No logo uploaded"
            />
            <BrandingUpload
              label="Authorized signatory signature"
              value={initial.signatureUrl}
              fileKind="signature"
              companyId={initial.id}
              hint="PNG or JPG, max 2MB. Printed in the signatory area of invoices."
              placeholder="No signature uploaded"
            />
          </div>
        </section>
      )}

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

const MAX_IMAGE_SIZE = 2 * 1024 * 1024; // 2MB

function BrandingUpload({
  label,
  value,
  fileKind,
  companyId,
  hint,
  placeholder,
}: {
  label: string;
  value: string | null;
  fileKind: 'logo' | 'signature';
  companyId: string;
  hint: string;
  placeholder: string;
}) {
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (file: File): Promise<{ logoUrl: string } | { signatureUrl: string }> =>
      fileKind === 'logo' ? uploadCompanyLogo(companyId, file) : uploadCompanySignature(companyId, file),
    onSuccess: async () => {
      notify(fileKind === 'logo' ? 'Logo uploaded' : 'Signature uploaded');
      await queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    },
    onError: (err) => notify(apiErrorMessage(err, 'Upload failed'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (): Promise<{ logoUrl: null } | { signatureUrl: null }> =>
      fileKind === 'logo' ? removeCompanyLogo(companyId) : removeCompanySignature(companyId),
    onSuccess: async () => {
      notify(fileKind === 'logo' ? 'Logo removed' : 'Signature removed');
      await queryClient.invalidateQueries({ queryKey: ['company', companyId] });
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not remove image'), 'error'),
  });

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      notify('Please choose an image file (PNG or JPG)', 'error');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      notify('Image must be smaller than 2MB', 'error');
      return;
    }
    uploadMutation.mutate(file);
  }

  return (
    <div>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        {value ? (
          <img
            src={value}
            alt={label}
            className="h-12 w-auto max-w-[160px] rounded border border-slate-200 bg-white object-contain p-1"
          />
        ) : (
          <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded border border-dashed border-slate-300 bg-slate-50 px-2 text-center text-xs text-slate-400">
            {placeholder}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={uploadMutation.isPending}>
            {value ? 'Change' : 'Upload'}
          </Button>
          {value && (
            <Button type="button" variant="outline" size="sm" onClick={() => removeMutation.mutate()} loading={removeMutation.isPending}>
              Remove
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={handleFileChange} />
      </div>
      <p className="mt-1 text-xs text-slate-400">{hint}</p>
    </div>
  );
}
