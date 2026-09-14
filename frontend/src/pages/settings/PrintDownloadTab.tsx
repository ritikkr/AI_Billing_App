import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getPreferences, updatePreferences } from '../../api/preferences';
import { apiErrorMessage } from '../../api/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { DesignThumbnail } from '../../components/ui/DesignThumbnail';
import { PageLoader } from '../../components/ui/Spinner';
import { DOCUMENT_DESIGNS } from '../../utils/designs';
import type { DocumentDesign, Preferences } from '../../types';

export function PrintDownloadTab() {
  const { companyId, isAdmin } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [printDesign, setPrintDesign] = useState<DocumentDesign | null>(null);
  const [downloadDesign, setDownloadDesign] = useState<DocumentDesign | null>(null);

  const { data: preferences, isLoading } = useQuery({
    queryKey: ['preferences', companyId],
    queryFn: () => getPreferences(companyId!),
    enabled: !!companyId,
  });

  const mutation = useMutation({
    mutationFn: (payload: Pick<Preferences, 'printDesign' | 'downloadDesign'>) => updatePreferences(companyId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['preferences', companyId] });
      notify('Print & download preferences saved');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not save preferences'), 'error'),
  });

  if (isLoading || !preferences) return <PageLoader />;

  const currentPrint = printDesign ?? preferences.printDesign;
  const currentDownload = downloadDesign ?? preferences.downloadDesign;
  const dirty = currentPrint !== preferences.printDesign || currentDownload !== preferences.downloadDesign;

  return (
    <Card>
      <CardHeader
        title="Print & download design"
        subtitle="Choose the layout used when invoices are printed from /serve or downloaded as PDF"
      />
      <CardBody className="space-y-6">
        {!isAdmin && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Only company admins can change these preferences. You can view them but not edit.
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <DesignPicker
            title="Print design"
            hint="Used when an invoice is opened for printing (e.g. /serve)"
            value={currentPrint}
            disabled={!isAdmin}
            onChange={(v) => setPrintDesign(v)}
          />
          <DesignPicker
            title="Download design"
            hint="Used when an invoice is downloaded as a PDF"
            value={currentDownload}
            disabled={!isAdmin}
            onChange={(v) => setDownloadDesign(v)}
          />
        </div>

        {isAdmin && (
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            {dirty && <span className="mr-auto text-xs text-slate-400">You have unsaved changes</span>}
            <Button
              onClick={() => mutation.mutate({ printDesign: currentPrint, downloadDesign: currentDownload })}
              loading={mutation.isPending}
              disabled={!dirty}
            >
              Save changes
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function DesignPicker({
  title,
  hint,
  value,
  onChange,
  disabled,
}: {
  title: string;
  hint: string;
  value: DocumentDesign;
  onChange: (v: DocumentDesign) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-0.5 text-xs text-slate-500">{hint}</p>
      <div className="mt-3 grid grid-cols-1 gap-3">
        {DOCUMENT_DESIGNS.map((d) => (
          <button
            key={d.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(d.value)}
            className={clsx(
              'rounded-xl border p-3.5 text-left transition duration-150',
              value === d.value
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-500/20'
                : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50',
              disabled && 'cursor-not-allowed opacity-80'
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className={clsx('text-sm font-medium', value === d.value ? 'text-indigo-700' : 'text-slate-800')}>{d.label}</span>
              <DesignThumbnail design={d.value} />
            </div>
            <p className="mt-1 text-xs text-slate-500">{d.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}