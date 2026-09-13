import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { importCustomers, type ImportCustomersResult } from '../../api/customers';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { exportCsv } from '../../utils/exportCsv';

const ACCEPTED = '.csv,.xlsx,.xls';

export function ImportCustomersModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState<ImportCustomersResult | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a file first');
      return importCustomers(companyId!, file);
    },
    onSuccess: (res) => {
      setResult(res);
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerGroups', companyId] });
      if (res.failed === 0) {
        notify(`Imported ${res.created} customer${res.created === 1 ? '' : 's'}`);
      } else {
        notify(`Imported with ${res.failed} error(s)`, 'error');
      }
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not import customers'), 'error'),
  });

  function handleFile(f: File | undefined | null) {
    if (!f) return;
    if (!/\.(csv|xlsx|xls)$/i.test(f.name)) {
      notify('Unsupported file. Upload a .csv, .xlsx or .xls file', 'error');
      return;
    }
    setFile(f);
    setResult(null);
  }

  function downloadTemplate() {
    exportCsv(
      [
        {
          name: 'Example Retail Pvt Ltd',
          group: 'Retailer',
          email: 'billing@example.com',
          phone: '9876543210',
          address: '14 MG Road, Bengaluru, Karnataka 560001',
          gstin: '27AAPFU0939F1ZV',
          'receivable balance': 12500,
          'payable balance': 0,
          'credit limit': 50000,
        },
      ],
      'customer-import-template.csv'
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Import customers" widthClass="max-w-2xl">
      <div className="space-y-5">
        <p className="text-sm text-slate-500">
          Upload an Excel (.xlsx/.xls) or CSV file. Columns are matched by header name — supported headers:{' '}
          <span className="text-slate-700">name*</span>, <span className="text-slate-700">group</span>,{' '}
          <span className="text-slate-700">email</span>,{' '}
          <span className="text-slate-700">phone</span>, <span className="text-slate-700">address</span>,{' '}
          <span className="text-slate-700">gstin</span>, <span className="text-slate-700">receivable balance</span>,{' '}
          <span className="text-slate-700">payable balance</span>, <span className="text-slate-700">credit limit</span>.{' '}
          <span className="text-slate-600">
            GSTIN is used as the key — matching customers are updated, new ones are created.
          </span>
        </p>

        <button
          type="button"
          onClick={downloadTemplate}
          className="text-xs font-medium text-indigo-600 hover:underline"
        >
          Download sample template (.csv)
        </button>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFile(e.dataTransfer.files[0]);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-slate-400'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <svg xmlns="http://www.w3.org/2000/svg" className="mb-2 h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {file ? (
            <div>
              <p className="text-sm font-medium text-slate-800">{file.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · click to choose another</p>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium text-slate-700">Drag &amp; drop your file here, or click to browse</p>
              <p className="mt-0.5 text-xs text-slate-400">{ACCEPTED}</p>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600">
            A row is updated when its GSTIN matches an existing customer, otherwise it is created. Rows without a GSTIN are always created.
          </span>
        </div>

        {result && (
          <div className={`rounded-lg border px-4 py-3 text-sm ${result.failed > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              <span className="text-slate-700">
                <b>{result.total}</b> rows
              </span>
              <span className="text-emerald-700">
                <b>{result.created}</b> created
              </span>
              {result.updated > 0 && (
                <span className="text-indigo-700">
                  <b>{result.updated}</b> updated
                </span>
              )}
              {result.failed > 0 && (
                <span className="text-amber-700">
                  <b>{result.failed}</b> failed
                </span>
              )}
            </div>
            {result.errors.length > 0 && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-md bg-white/60 p-2 font-mono text-xs">
                {result.errors.map((e, i) => (
                  <div key={i} className="text-amber-800">
                    Row {e.row}{e.name ? ` · ${e.name}` : ''}: {e.reason}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!file || !canEdit} loading={mutation.isPending}>
            Import {file ? `“${file.name}”` : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}