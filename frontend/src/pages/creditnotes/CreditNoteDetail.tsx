import { useParams, Link, Navigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { getCreditNote, cancelCreditNote } from '../../api/creditNotes';
import { apiErrorMessage } from '../../api/client';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { formatCurrency, formatDate } from '../../utils/format';

export default function CreditNoteDetail() {
  const { id } = useParams();
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const { data: note, isLoading } = useQuery({
    queryKey: ['credit-note', companyId, id],
    queryFn: () => getCreditNote(companyId!, id!),
    enabled: !!companyId && !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelCreditNote(companyId!, id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-note', companyId, id] });
      queryClient.invalidateQueries({ queryKey: ['credit-notes', companyId] });
      notify('Note cancelled');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not cancel note'), 'error'),
  });

  if (isLoading) return <PageLoader />;
  if (!note) return <Navigate to="/credit-notes" replace />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/credit-notes" className="text-sm text-slate-400 hover:text-slate-600">
              Credit / Debit Notes
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-900">{note.noteNumber}</h1>
            <StatusBadge status={note.status} />
            <Badge className={note.noteType === 'credit' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}>
              {note.noteType === 'credit' ? 'Credit Note' : 'Debit Note'}
            </Badge>
          </div>
          <p className="text-sm text-slate-500">
            {note.customer?.name} · {formatDate(note.noteDate)}
          </p>
        </div>
        {canEdit && note.status === 'issued' && (
          <Button variant="danger" loading={cancelMutation.isPending} onClick={() => confirm('Cancel this note?') && cancelMutation.mutate()}>
            Cancel Note
          </Button>
        )}
      </div>

      <Card>
        <CardHeader title="Details" />
        <CardBody className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Customer</p>
            <p className="mt-1 font-medium text-slate-900">{note.customer?.name}</p>
            {note.customer?.gstin && <p className="text-sm text-slate-500">GSTIN: {note.customer.gstin}</p>}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Reason</p>
            <p className="mt-1 text-slate-700">{note.reason || '-'}</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Line items" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-5 py-2.5 font-medium">Description</th>
                <th className="px-5 py-2.5 font-medium">HSN/SAC</th>
                <th className="px-5 py-2.5 text-right font-medium">Qty</th>
                <th className="px-5 py-2.5 text-right font-medium">Rate</th>
                <th className="px-5 py-2.5 text-right font-medium">Taxable</th>
                <th className="px-5 py-2.5 text-right font-medium">Tax</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {note.lineItems.map((item, idx) => (
                <tr key={item.id || idx} className="border-b border-slate-50 last:border-0">
                  <td className="px-5 py-2.5 text-slate-800">{item.description}</td>
                  <td className="px-5 py-2.5 text-slate-500">{item.hsnSacCode || '-'}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">
                    {item.qty} {item.unit}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{formatCurrency(item.rate)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">{formatCurrency(item.taxableValue)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-600">
                    {formatCurrency((item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0))}
                  </td>
                  <td className="px-5 py-2.5 text-right font-medium text-slate-900">{formatCurrency(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <CardBody>
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Taxable value</span>
                <span>{formatCurrency(note.taxableValue)}</span>
              </div>
              {note.isInterstate ? (
                <div className="flex justify-between text-slate-600">
                  <span>IGST</span>
                  <span>{formatCurrency(note.totalIgst)}</span>
                </div>
              ) : (
                <>
                  <div className="flex justify-between text-slate-600">
                    <span>CGST</span>
                    <span>{formatCurrency(note.totalCgst)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>SGST</span>
                    <span>{formatCurrency(note.totalSgst)}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-1.5 text-base font-semibold text-slate-900">
                <span>Grand total</span>
                <span>{formatCurrency(note.grandTotal)}</span>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
