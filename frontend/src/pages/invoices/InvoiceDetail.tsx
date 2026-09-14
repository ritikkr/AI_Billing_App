import { useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getInvoice, cancelInvoice, deleteInvoice } from '../../api/invoices';
import { getPreferences } from '../../api/preferences';
import { apiErrorMessage } from '../../api/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatCurrency, formatDate } from '../../utils/format';
import { amountInWords } from '../../utils/gst';
import { DocumentPreviewModal } from '../../components/print/DocumentPreviewModal';
import { RecordPaymentModal } from './RecordPaymentModal';

export default function InvoiceDetail() {
  const { id } = useParams();
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['invoice', companyId, id],
    queryFn: () => getInvoice(companyId!, id!),
    enabled: !!companyId && !!id,
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences', companyId],
    queryFn: () => getPreferences(companyId!),
    enabled: !!companyId && !!invoice,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelInvoice(companyId!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', companyId, id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      notify('Invoice cancelled');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not cancel invoice'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteInvoice(companyId!, id!),
    onSuccess: () => {
      notify('Draft deleted');
      navigate('/invoices');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not delete invoice'), 'error'),
  });

  if (isLoading) return <PageLoader />;
  if (!invoice) return <Navigate to="/invoices" replace />;

  const canRecordPayment = canEdit && ['sent', 'partially_paid', 'overdue'].includes(invoice.status);
  const canEditInvoice = canEdit && ['draft', 'sent'].includes(invoice.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/invoices" className="text-sm text-slate-400 hover:text-slate-600">
              Invoices
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-900">{invoice.invoiceNumber}</h1>
            <StatusBadge status={invoice.status} />
          </div>
          <p className="text-sm text-slate-500">
            {invoice.customer?.name} · {formatDate(invoice.invoiceDate)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPreviewOpen(true)}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
              />
            </svg>
            Print / Download
          </Button>
          {canEditInvoice && (
            <Link to={`/invoices/${invoice.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {canRecordPayment && <Button onClick={() => setPaymentModalOpen(true)}>Record Payment</Button>}
          {canEdit && invoice.status === 'draft' && (
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => confirm('Delete this draft invoice?') && deleteMutation.mutate()}>
              Delete
            </Button>
          )}
          {canEdit && !['cancelled', 'draft'].includes(invoice.status) && invoice.amountPaid === 0 && (
            <Button
              variant="danger"
              loading={cancelMutation.isPending}
              onClick={() => confirm('Cancel this invoice? This cannot be undone.') && cancelMutation.mutate()}
            >
              Cancel Invoice
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Grand total</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(invoice.grandTotal)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Amount paid</p>
            <p className="mt-2 text-xl font-semibold text-emerald-600">{formatCurrency(invoice.amountPaid)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Balance due</p>
            <p className={`mt-2 text-xl font-semibold ${invoice.balanceDue > 0 ? 'text-amber-600' : 'text-slate-900'}`}>{formatCurrency(invoice.balanceDue)}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Invoice preview"
          subtitle={invoice.isInterstate ? `Inter-state supply to ${invoice.placeOfSupplyStateCode} — IGST applies` : `Intra-state supply — CGST + SGST applies`}
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill to</p>
              <p className="mt-1 font-medium text-slate-900">{invoice.customer?.name}</p>
              <p className="text-sm text-slate-500">
                {[invoice.customer?.billing_address, invoice.customer?.billing_city, invoice.customer?.billing_state].filter(Boolean).join(', ')}
              </p>
              {invoice.customer?.gstin && <p className="text-sm text-slate-500">GSTIN: {invoice.customer.gstin}</p>}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">From</p>
              <p className="mt-1 font-medium text-slate-900">{invoice.company?.name}</p>
              <p className="text-sm text-slate-500">
                {[invoice.company?.address_line1, invoice.company?.city, invoice.company?.state].filter(Boolean).join(', ')}
              </p>
              {invoice.company?.gstin && <p className="text-sm text-slate-500">GSTIN: {invoice.company.gstin}</p>}
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="py-2 pr-3 font-medium">Description</th>
                  <th className="py-2 pr-3 font-medium">HSN/SAC</th>
                  <th className="py-2 pr-3 text-right font-medium">Qty</th>
                  <th className="py-2 pr-3 text-right font-medium">Rate</th>
                  <th className="py-2 pr-3 text-right font-medium">Taxable</th>
                  <th className="py-2 pr-3 text-right font-medium">Tax</th>
                  <th className="py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.lineItems.map((item, idx) => (
                  <tr key={item.id || idx} className="border-b border-slate-100/70 last:border-0">
                    <td className="py-2 pr-3 text-slate-800">{item.description}</td>
                    <td className="py-2 pr-3 text-slate-500">{item.hsnSacCode || '-'}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">
                      {item.qty} {item.unit}
                    </td>
                    <td className="py-2 pr-3 text-right text-slate-600">{formatCurrency(item.rate)}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">{formatCurrency(item.taxableValue)}</td>
                    <td className="py-2 pr-3 text-right text-slate-600">
                      {formatCurrency((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0))}
                      <span className="ml-1 text-xs text-slate-400">({item.gstRate}%)</span>
                    </td>
                    <td className="py-2 text-right font-medium text-slate-900">{formatCurrency(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <SummaryRow label="Subtotal" value={invoice.subtotal} />
              {invoice.totalDiscount > 0 && <SummaryRow label="Discount" value={-invoice.totalDiscount} />}
              <SummaryRow label="Taxable value" value={invoice.taxableValue} />
              {invoice.isInterstate ? (
                <SummaryRow label="IGST" value={invoice.totalIgst} />
              ) : (
                <>
                  <SummaryRow label="CGST" value={invoice.totalCgst} />
                  <SummaryRow label="SGST" value={invoice.totalSgst} />
                </>
              )}
              {invoice.roundOff !== 0 && <SummaryRow label="Round off" value={invoice.roundOff} />}
              <div className="border-t border-slate-200 pt-1.5">
                <SummaryRow label="Grand total" value={invoice.grandTotal} bold />
              </div>
            </div>
          </div>
          <p className="mt-3 text-right text-xs italic text-slate-400">{amountInWords(invoice.grandTotal)}</p>

          {(invoice.notes || invoice.terms) && (
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
              {invoice.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="text-slate-600">{invoice.notes}</p>
                </div>
              )}
              {invoice.terms && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Terms & conditions</p>
                  <p className="text-slate-600">{invoice.terms}</p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Payment history" />
        {invoice.payments.length === 0 ? (
          <CardBody>
            <p className="text-sm text-slate-500">No payments recorded yet.</p>
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Mode</th>
                  <th className="px-5 py-3 font-medium">Reference</th>
                </tr>
              </thead>
              <tbody>
                {invoice.payments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100/70 last:border-0">
                    <td className="px-5 py-2.5 text-slate-600">{formatDate(p.paymentDate)}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-900">{formatCurrency(p.amount)}</td>
                    <td className="px-5 py-2.5 capitalize text-slate-600">{p.paymentMode.replace('_', ' ')}</td>
                    <td className="px-5 py-2.5 text-slate-500">{p.referenceNo || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {paymentModalOpen && <RecordPaymentModal open={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} invoice={invoice} />}
      {previewOpen && (
        <DocumentPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          invoice={invoice}
          defaultDesign={preferences?.downloadDesign ?? preferences?.printDesign ?? 'classic'}
        />
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? 'text-base font-semibold text-slate-900' : 'text-slate-600'}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
