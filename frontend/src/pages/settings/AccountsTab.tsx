import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { getCompany, updateCompany } from '../../api/companies';
import { getPreferences, updatePreferences } from '../../api/preferences';
import { CompanyImageUpload } from '../../components/CompanyImageUpload';
import { Button } from '../../components/ui/Button';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import type { Company, Preferences } from '../../types';

type AccountSettings = Pick<Company, 'bankName' | 'bankBranch' | 'bankAccountNo' | 'bankIfsc'> &
  Pick<Preferences, 'showBankName' | 'showBankBranch' | 'showBankAccountNo' | 'showBankIfsc' | 'showPaymentQr'>;

const DISPLAY_OPTIONS: Array<{ key: keyof AccountSettings; label: string }> = [
  { key: 'showBankName', label: 'Bank name' },
  { key: 'showBankBranch', label: 'Branch' },
  { key: 'showBankAccountNo', label: 'Account number' },
  { key: 'showBankIfsc', label: 'IFSC code' },
  { key: 'showPaymentQr', label: 'Payment QR code' },
];

function accountSettings(company: Company, preferences: Preferences): AccountSettings {
  return {
    bankName: company.bankName || '',
    bankBranch: company.bankBranch || '',
    bankAccountNo: company.bankAccountNo || '',
    bankIfsc: company.bankIfsc || '',
    showBankName: preferences.showBankName,
    showBankBranch: preferences.showBankBranch,
    showBankAccountNo: preferences.showBankAccountNo,
    showBankIfsc: preferences.showBankIfsc,
    showPaymentQr: preferences.showPaymentQr,
  };
}

export function AccountsTab() {
  const { companyId, isAdmin } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<AccountSettings | null>(null);

  const { data: company, isLoading: companyLoading } = useQuery({
    queryKey: ['company', companyId],
    queryFn: () => getCompany(companyId!),
    enabled: !!companyId,
  });
  const { data: preferences, isLoading: preferencesLoading } = useQuery({
    queryKey: ['preferences', companyId],
    queryFn: () => getPreferences(companyId!),
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: async (values: AccountSettings) => {
      await Promise.all([
        updateCompany(companyId!, {
          bankName: values.bankName || null,
          bankBranch: values.bankBranch || null,
          bankAccountNo: values.bankAccountNo || null,
          bankIfsc: values.bankIfsc || null,
        }),
        updatePreferences(companyId!, {
          showBankName: values.showBankName,
          showBankBranch: values.showBankBranch,
          showBankAccountNo: values.showBankAccountNo,
          showBankIfsc: values.showBankIfsc,
          showPaymentQr: values.showPaymentQr,
        }),
      ]);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['company', companyId] }),
        queryClient.invalidateQueries({ queryKey: ['preferences', companyId] }),
      ]);
      setDraft(null);
      notify('Account settings saved');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not save account settings'), 'error'),
  });

  if (companyLoading || preferencesLoading || !company || !preferences) return <PageLoader />;

  const saved = accountSettings(company, preferences);
  const current = draft ?? saved;
  const dirty = Object.keys(saved).some((key) => current[key as keyof AccountSettings] !== saved[key as keyof AccountSettings]);
  const setValue = <K extends keyof AccountSettings>(key: K, value: AccountSettings[K]) =>
    setDraft((previous) => ({ ...(previous ?? saved), [key]: value }));

  return (
    <Card>
      <CardHeader title="Accounts" subtitle="Manage payment details and choose what appears on invoices" />
      <CardBody className="space-y-6">
        {!isAdmin && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Only company admins can change account settings. You can view the current setup.
          </div>
        )}

        <fieldset disabled={!isAdmin} className="space-y-6">
          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Bank details</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Bank name" value={current.bankName || ''} onChange={(e) => setValue('bankName', e.target.value)} />
              <Input label="Branch" value={current.bankBranch || ''} onChange={(e) => setValue('bankBranch', e.target.value)} />
              <Input label="Account number" value={current.bankAccountNo || ''} onChange={(e) => setValue('bankAccountNo', e.target.value)} />
              <Input label="IFSC code" value={current.bankIfsc || ''} onChange={(e) => setValue('bankIfsc', e.target.value.toUpperCase())} />
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-900">Show on invoices</h3>
            <p className="mb-3 text-xs text-slate-500">Choose which payment details are printed or included in downloaded PDFs.</p>
            <div className="divide-y divide-slate-100 border-y border-slate-100">
              {DISPLAY_OPTIONS.map((option) => (
                <label key={option.key} className="flex items-center gap-3 py-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(current[option.key])}
                    onChange={(e) => setValue(option.key, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Payment QR code</h3>
            <CompanyImageUpload
              label="Invoice payment QR"
              value={company.paymentQrUrl}
              fileKind="paymentQr"
              companyId={company.id}
              hint="PNG, JPG, WebP or GIF, max 2MB. Display is controlled by the checkbox above."
              placeholder="No QR code uploaded"
            />
          </section>
        </fieldset>

        {isAdmin && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            {dirty && <span className="mr-auto text-xs text-slate-400">You have unsaved changes</span>}
            <Button onClick={() => mutation.mutate(current)} loading={mutation.isPending} disabled={!dirty}>
              Save changes
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}