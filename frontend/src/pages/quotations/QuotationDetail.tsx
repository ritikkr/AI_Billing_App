import { useState } from 'react';
import { useParams, Link, Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getQuotation, cancelQuotation, deleteQuotation, sendQuotation, acceptQuotation, rejectQuotation, convertQuotation } from '../../api/quotations';
import { getPreferences } from '../../api/preferences';
import { apiErrorMessage } from '../../api/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatCurrency, formatDate } from '../../utils/format';
import { amountInWords } from '../../utils/gst';
import { QuotationPreviewModal } from '../../components/print/QuotationPreviewModal';

export default function QuotationDetail() {
  const { id } = useParams();
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [previewOpen, setPreviewOpen] = useState(false);

  const { data: quotation, isLoading } = useQuery({
    queryKey: ['quotation', companyId, id],
    queryFn: () => getQuotation(companyId!, id!),
    enabled: !!companyId && !!id,
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences', companyId],
    queryFn: () => getPreferences(companyId!),
    enabled: !!companyId && !!quotation,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['quotation', companyId, id] });
    queryClient.invalidateQueries({ queryKey: ['quotations', companyId] });
    queryClient.invalidateQueries({ queryKey: ['quotations-summary', companyId] });
  };

  const sendMutation = useMutation({
    mutationFn: () => sendQuotation(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Quotation marked as sent');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not send quotation'), 'error'),
  });

  const acceptMutation = useMutation({
    mutationFn: () => acceptQuotation(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Quotation accepted');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not accept quotation'), 'error'),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectQuotation(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Quotation rejected');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not reject quotation'), 'error'),
  });

  const convertMutation = useMutation({
    mutationFn: () => convertQuotation(companyId!, id!),
    onSuccess: (res) => {
      invalidate();
      notify(`Created invoice ${res.invoice.invoiceNumber}`);
      navigate(`/invoices/${res.invoice.id}`);
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not convert quotation'), 'error'),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelQuotation(companyId!, id!),
    onSuccess: () => {
      invalidate();
      notify('Quotation cancelled');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not cancel quotation'), 'error'),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteQuotation(companyId!, id!),
    onSuccess: () => {
      notify('Quotation deleted');
      navigate('/quotations');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not delete quotation'), 'error'),
  });

  if (isLoading) return <PageLoader />;
  if (!quotation) return <Navigate to="/quotations" replace />;

  const canEditQuote = canEdit && ['draft', 'sent'].includes(quotation.status);
  const canConvert = canEdit && ['draft', 'sent', 'accepted'].includes(quotation.status);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/quotations" className="text-sm text-slate-400 hover:text-slate-600">
              Quotations
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-900">{quotation.quotationNumber}</h1>
            <StatusBadge status={quotation.status} />
          </div>
          <p className="text-sm text-slate-500">
            {quotation.customer?.name} · {formatDate(quotation.quotationDate)}
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
          {canEditQuote && (
            <Link to={`/quotations/${quotation.id}/edit`}>
              <Button variant="outline">Edit</Button>
            </Link>
          )}
          {canEdit && quotation.status === 'draft' && (
            <Button variant="outline" loading={sendMutation.isPending} onClick={() => sendMutation.mutate()}>
              Mark as Sent
            </Button>
          )}
          {canConvert && (
            <Button loading={convertMutation.isPending} onClick={() => confirm(`Convert ${quotation.quotationNumber} into an invoice?`) && convertMutation.mutate()}>
              Convert to Invoice
            </Button>
          )}
          {canEdit && ['draft', 'sent'].includes(quotation.status) && (
            <>
              <Button variant="outline" loading={acceptMutation.isPending} onClick={() => acceptMutation.mutate()}>
                Mark Accepted
              </Button>
              <Button variant="outline" loading={rejectMutation.isPending} onClick={() => rejectMutation.mutate()}>
                Reject
              </Button>
            </>
          )}
          {canEdit && quotation.status === 'draft' && (
            <Button variant="danger" loading={deleteMutation.isPending} onClick={() => confirm('Delete this draft quotation?') && deleteMutation.mutate()}>
              Delete
            </Button>
          )}
          {canEdit && !['cancelled', 'converted'].includes(quotation.status) && (
            <Button variant="danger" loading={cancelMutation.isPending} onClick={() => confirm('Cancel this quotation?') && cancelMutation.mutate()}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Grand total</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatCurrency(quotation.grandTotal)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Valid until</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{formatDate(quotation.validUntil)}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Tax type</p>
            <p className="mt-2 text-xl font-semibold text-slate-900">{quotation.isInterstate ? 'IGST' : 'CGST + SGST'}</p>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Quotation preview"
          subtitle={quotation.isInterstate ? `Inter-state supply to ${quotation.placeOfSupplyStateCode} — IGST applies` : `Intra-state supply — CGST + SGST applies`}
        />
        <CardBody>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Bill to</p>
              <p className="mt-1 font-medium text-slate-900">{quotation.customer?.name}</p>
              <p className="text-sm text-slate-500">
                {[quotation.customer?.billing_address, quotation.customer?.billing_city, quotation.customer?.billing_state].filter(Boolean).join(', ')}
              </p>
              {quotation.customer?.gstin && <p className="text-sm text-slate-500">GSTIN: {quotation.customer.gstin}</p>}
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">From</p>
              <p className="mt-1 font-medium text-slate-900">{quotation.company?.name}</p>
              <p className="text-sm text-slate-500">
                {[quotation.company?.address_line1, quotation.company?.city, quotation.company?.state].filter(Boolean).join(', ')}
              </p>
              {quotation.company?.gstin && <p className="text-sm text-slate-500">GSTIN: {quotation.company.gstin}</p>}
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
                {quotation.lineItems.map((item, idx) => (
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
              <SummaryRow label="Subtotal" value={quotation.subtotal} />
              {quotation.totalDiscount > 0 && <SummaryRow label="Discount" value={-quotation.totalDiscount} />}
              <SummaryRow label="Taxable value" value={quotation.taxableValue} />
              {quotation.isInterstate ? (
                <SummaryRow label="IGST" value={quotation.totalIgst} />
              ) : (
                <>
                  <SummaryRow label="CGST" value={quotation.totalCgst} />
                  <SummaryRow label="SGST" value={quotation.totalSgst} />
                </>
              )}
              {quotation.roundOff !== 0 && <SummaryRow label="Round off" value={quotation.roundOff} />}
              <div className="border-t border-slate-200 pt-1.5">
                <SummaryRow label="Grand total" value={quotation.grandTotal} bold />
              </div>
            </div>
          </div>
          <p className="mt-3 text-right text-xs italic text-slate-400">{amountInWords(quotation.grandTotal)}</p>

          {(quotation.notes || quotation.terms) && (
            <div className="mt-6 space-y-3 border-t border-slate-100 pt-4 text-sm">
              {quotation.notes && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Notes</p>
                  <p className="text-slate-600">{quotation.notes}</p>
                </div>
              )}
              {quotation.terms && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Terms & conditions</p>
                  <p className="text-slate-600">{quotation.terms}</p>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {previewOpen && quotation && (
        <QuotationPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          quotation={quotation}
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