import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { listQuotations, getQuotationSummary } from '../../api/quotations';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';

const STATUS_OPTIONS = ['', 'draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'];

export default function QuotationsList() {
  const { companyId, canEdit } = useCompany();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', companyId, search, status],
    queryFn: () => listQuotations(companyId!, { search: search || undefined, status: status || undefined }),
    enabled: !!companyId,
  });

  const { data: summary } = useQuery({
    queryKey: ['quotations-summary', companyId],
    queryFn: () => getQuotationSummary(companyId!),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Quotations</h1>
          <p className="text-sm text-slate-500">
            {summary
              ? `${summary.counts.total} quotations · ${formatCurrency(summary.totalQuoted)} quoted · ${summary.counts.converted} converted`
              : 'Price estimates before you create an invoice'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(
            (data ?? []).map((q) => ({
              quotationNumber: q.quotationNumber,
              customerName: q.customerName,
              quotationDate: q.quotationDate,
              validUntil: q.validUntil ?? '',
              subtotal: q.subtotal,
              totalDiscount: q.totalDiscount,
              taxableValue: q.taxableValue,
              totalCgst: q.totalCgst,
              totalSgst: q.totalSgst,
              totalIgst: q.totalIgst,
              grandTotal: q.grandTotal,
              status: q.status,
            })),
            'quotations-export.csv'
          )} disabled={!data?.length}>
            Export CSV
          </Button>
          {canEdit && (
            <Link to="/quotations/new">
              <Button>+ New Quotation</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-slate-50/40 p-4">
          <Input type="search" name="quotation-search" autoComplete="off" enterKeyHint="search" placeholder="Search quotation #…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}
              </option>
            ))}
          </Select>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No quotations yet" description="Create your first price estimate / quotation." action={canEdit && (
            <Link to="/quotations/new">
              <Button>+ New Quotation</Button>
            </Link>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Quotation #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Valid until</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((q) => (
                  <tr key={q.id} className="border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/quotations/${q.id}`} className="font-medium text-indigo-600 transition-colors hover:text-indigo-700">
                        {q.quotationNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{q.customerName}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(q.quotationDate)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(q.validUntil)}</td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">{formatCurrency(q.grandTotal)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={q.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}