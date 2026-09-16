import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { previewPdfImport, importPdf, type PdfImportPreviewResult, type PdfImportResult } from '../../api/customers';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { formatCurrency } from '../../utils/format';

const ACCEPTED = '.pdf';

type Step = 'upload' | 'preview' | 'result';
type Mode = 'import' | 'customers_only';

export function ImportPdfModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [mode, setMode] = useState<Mode>('import');
  const [preview, setPreview] = useState<PdfImportPreviewResult | null>(null);
  const [result, setResult] = useState<PdfImportResult | null>(null);

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a PDF file first');
      return previewPdfImport(companyId!, file);
    },
    onSuccess: (res) => {
      setPreview(res);
      setStep('preview');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not parse PDF'), 'error'),
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('Choose a PDF file first');
      return importPdf(companyId!, file, { mode });
    },
    onSuccess: (res) => {
      setResult(res);
      setStep('result');
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      const parts: string[] = [];
      if (res.customers.created > 0) parts.push(`${res.customers.created} customer(s) created`);
      if (res.customers.updated > 0) parts.push(`${res.customers.updated} customer(s) updated`);
      if (res.invoices.created > 0) parts.push(`${res.invoices.created} invoice(s) created`);
      if (res.invoices.updated > 0) parts.push(`${res.invoices.updated} invoice(s) updated`);
      if (res.invoices.skipped > 0) parts.push(`${res.invoices.skipped} skipped`);
      if (res.failed.length > 0) parts.push(`${res.failed.length} failed`);
      notify(parts.length > 0 ? parts.join(', ') : 'Import complete');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not import from PDF'), 'error'),
  });

  function handleFile(f: File | undefined | null) {
    if (!f) return;
    if (!/\.pdf$/i.test(f.name)) {
      notify('Upload a PDF file', 'error');
      return;
    }
    setFile(f);
    setPreview(null);
    setResult(null);
    setStep('upload');
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setStep('upload');
  }

  return (
    <Modal open={open} onClose={onClose} title="Import from PDF" widthClass="max-w-3xl">
      <div className="space-y-5">
        {/* Step: Upload */}
        {step === 'upload' && (
          <>
            <p className="text-sm text-slate-500">
              Upload a multi-page tax-invoice PDF. Each page should contain one invoice.
              The parser extracts customer details, line items, and tax information —
              then creates/updates customers and generates invoices in the app.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
              onClick={() => inputRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition duration-150 ${
                dragOver ? 'border-indigo-500 bg-indigo-50/70' : 'border-slate-300 hover:border-slate-400'
              }`}
            >
              <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
              <svg xmlns="http://www.w3.org/2000/svg" className="mb-2 h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {file ? (
                <div>
                  <p className="text-sm font-medium text-slate-800">{file.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-slate-700">Drag &amp; drop your PDF here, or click to browse</p>
                  <p className="mt-0.5 text-xs text-slate-400">.pdf files up to 15 MB</p>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>Close</Button>
              <Button type="button" onClick={() => previewMutation.mutate()} disabled={!file || !canEdit} loading={previewMutation.isPending}>
                Preview &amp; Import
              </Button>
            </div>
          </>
        )}

        {/* Step: Preview */}
        {step === 'preview' && preview && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-600">
                Found <b>{preview.invoices.length}</b> invoice(s) across <b>{preview.totalPages}</b> page(s) ·{' '}
                <b>{preview.customers.filter((c) => c.isNew).length}</b> new customer(s)
              </p>
              <Button variant="outline" size="sm" onClick={reset}>Choose another file</Button>
            </div>

            {/* Mode selector */}
            <div className="flex gap-3">
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                mode === 'import' ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
                <input type="radio" name="mode" value="import" checked={mode === 'import'} onChange={() => setMode('import')} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Import customers &amp; invoices</span>
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                mode === 'customers_only' ? 'border-indigo-300 bg-indigo-50 text-indigo-800' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}>
                <input type="radio" name="mode" value="customers_only" checked={mode === 'customers_only'} onChange={() => setMode('customers_only')} className="text-indigo-600 focus:ring-indigo-500" />
                <span>Customers only</span>
              </label>
            </div>

            {/* Invoice cards */}
            <div className="max-h-96 space-y-3 overflow-y-auto pr-1">
              {preview.invoices.map((inv) => (
                <div key={inv.page} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-xs font-medium text-slate-500">Page {inv.page}</span>
                      <div className="mt-0.5 font-medium text-slate-900">
                        {inv.invoiceNo || <span className="text-red-500">No invoice number</span>}
                      </div>
                      <div className="text-xs text-slate-500">
                        {inv.invoiceDate && <span>{inv.invoiceDate}</span>}
                        {inv.customer.name && <span> · {inv.customer.name}</span>}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-slate-900">
                        {inv.parsed.grandTotal > 0 ? formatCurrency(inv.parsed.grandTotal) : '—'}
                      </div>
                      <div className="text-xs text-slate-400">{inv.lineItems.length} item(s)</div>
                    </div>
                  </div>
                  {inv.customer.gstin && (
                    <div className="mt-1 text-xs text-slate-500">GSTIN: {inv.customer.gstin}</div>
                  )}
                  {preview.customers[preview.invoices.indexOf(inv)]?.isNew && (
                    <Badge className="mt-1 bg-blue-50 text-blue-700">New customer</Badge>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => importMutation.mutate()} loading={importMutation.isPending}>
                {mode === 'import' ? 'Import all' : 'Import customers only'}
              </Button>
            </div>
          </>
        )}

        {/* Step: Result */}
        {step === 'result' && result && (
          <>
            <div className={`rounded-lg border px-4 py-3 text-sm ${
              result.failed.length > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'
            }`}>
              <div className="flex flex-wrap gap-x-5 gap-y-1">
                <span className="text-slate-700"><b>{result.totalPages}</b> pages</span>
                <span className="text-emerald-700"><b>{result.customers.created}</b> customers created</span>
                {result.customers.updated > 0 && <span className="text-indigo-700"><b>{result.customers.updated}</b> customers updated</span>}
                {result.invoices.created > 0 && <span className="text-emerald-700"><b>{result.invoices.created}</b> invoices created</span>}
                {result.invoices.updated > 0 && <span className="text-indigo-700"><b>{result.invoices.updated}</b> invoices updated</span>}
                {result.invoices.skipped > 0 && <span className="text-slate-500"><b>{result.invoices.skipped}</b> skipped</span>}
                {result.failed.length > 0 && <span className="text-amber-700"><b>{result.failed.length}</b> failed</span>}
              </div>
            </div>

            {result.created.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-slate-500">Created</h4>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {result.created.map((r) => (
                    <div key={r.invoiceNo} className="text-sm text-slate-700">
                      {r.invoiceNo} — {r.customerName} — {formatCurrency(r.grandTotal)}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.failed.length > 0 && (
              <div>
                <h4 className="mb-2 text-xs font-semibold uppercase text-amber-600">Failed</h4>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {result.failed.map((r) => (
                    <div key={r.page} className="text-sm text-amber-800">
                      Page {r.page} ({r.invoiceNo || 'unknown'}): {r.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <Button variant="outline" onClick={reset}>Import another PDF</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
