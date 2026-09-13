import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { listInvoices } from '../../api/invoices';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';

const STATUS_OPTIONS = ['', 'draft', 'sent', 'partially_paid', 'paid', 'overdue', 'cancelled'];

export default function InvoicesList() {
  const { companyId, canEdit } = useCompany();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['invoices', companyId, search, status],
    queryFn: () => listInvoices(companyId!, { search: search || undefined, status: status || undefined }),
    enabled: !!companyId,
  });

  const totals = data?.reduce(
    (acc, inv) => {
      if (inv.status === 'cancelled') return acc;
      acc.total += inv.grandTotal;
      acc.outstanding += inv.balanceDue;
      return acc;
    },
    { total: 0, outstanding: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Invoices</h1>
          <p className="text-sm text-slate-500">
            {data && totals ? `${data.length} invoices · ${formatCurrency(totals.total)} billed · ${formatCurrency(totals.outstanding)} outstanding` : 'GST tax invoices for your customers'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(
            (data ?? []).map((invoice) => ({
              invoiceNumber: invoice.invoiceNumber,
              customerName: invoice.customerName,
              invoiceDate: invoice.invoiceDate,
              dueDate: invoice.dueDate ?? '',
              subtotal: invoice.subtotal,
              totalDiscount: invoice.totalDiscount,
              taxableValue: invoice.taxableValue,
              totalCgst: invoice.totalCgst,
              totalSgst: invoice.totalSgst,
              totalIgst: invoice.totalIgst,
              grandTotal: invoice.grandTotal,
              amountPaid: invoice.amountPaid,
              balanceDue: invoice.balanceDue,
              status: invoice.status,
            })),
            'invoices-export.csv'
          )} disabled={!data?.length}>
            Export CSV
          </Button>
          {canEdit && (
            <Link to="/invoices/new">
              <Button>+ New Invoice</Button>
            </Link>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 p-4">
          <Input placeholder="Search invoice #…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
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
          <EmptyState title="No invoices yet" description="Create your first GST invoice." action={canEdit && (
            <Link to="/invoices/new">
              <Button>+ New Invoice</Button>
            </Link>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Invoice #</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Due</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Balance</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{inv.customerName}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(inv.dueDate)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatCurrency(inv.balanceDue)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
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
