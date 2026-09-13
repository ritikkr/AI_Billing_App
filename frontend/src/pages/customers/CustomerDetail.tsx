import { useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { getCustomer } from '../../api/customers';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../../utils/format';
import { CustomerFormModal } from './CustomerFormModal';

export default function CustomerDetail() {
  const { id } = useParams();
  const { companyId, canEdit } = useCompany();
  const [editOpen, setEditOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['customer', companyId, id],
    queryFn: () => getCustomer(companyId!, id!),
    enabled: !!companyId && !!id,
  });

  if (isLoading) return <PageLoader />;
  if (!data) return <Navigate to="/customers" replace />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link to="/customers" className="text-sm text-slate-400 hover:text-slate-600">
              Customers
            </Link>
            <span className="text-slate-300">/</span>
            <h1 className="text-xl font-semibold text-slate-900">{data.name}</h1>
            {!data.isActive && <Badge>Archived</Badge>}
          </div>
          <p className="text-sm text-slate-500">{data.gstin || 'Unregistered (B2C) customer'}</p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              Edit
            </Button>
          )}
          {canEdit && (
            <Link to={`/invoices/new?customerId=${data.id}`}>
              <Button>+ New Invoice</Button>
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Outstanding balance</p>
            <p className={`mt-2 text-2xl font-semibold ${data.outstandingBalance > 0 ? 'text-amber-600' : 'text-slate-900'}`}>
              {formatCurrency(data.outstandingBalance)}
            </p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Total invoices</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{data.invoices.length}</p>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Credit limit</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(data.creditLimit)}</p>
          </CardBody>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Contact & address" />
          <CardBody className="space-y-3 text-sm">
            <div>
              <p className="text-xs text-slate-400">Email</p>
              <p className="text-slate-700">{data.email || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="text-slate-700">{data.phone || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">PAN</p>
              <p className="text-slate-700">{data.pan || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Billing address</p>
              <p className="text-slate-700">{data.billingAddress || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Shipping address</p>
              <p className="text-slate-700">{data.shippingAddress || '-'}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Receivable balance</p>
              <p className="text-slate-700">{formatCurrency(data.receivableBalance ?? 0)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Payable balance</p>
              <p className="text-slate-700">{formatCurrency(data.payableBalance ?? 0)}</p>
            </div>
            {data.notes && (
              <div>
                <p className="text-xs text-slate-400">Notes</p>
                <p className="text-slate-700">{data.notes}</p>
              </div>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Invoice history" />
          {data.invoices.length === 0 ? (
            <EmptyState title="No invoices yet" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-5 py-2.5 font-medium">Invoice #</th>
                    <th className="px-5 py-2.5 font-medium">Date</th>
                    <th className="px-5 py-2.5 font-medium">Amount</th>
                    <th className="px-5 py-2.5 font-medium">Balance</th>
                    <th className="px-5 py-2.5 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((inv) => (
                    <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                      <td className="px-5 py-2.5">
                        <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                          {inv.invoiceNumber}
                        </Link>
                      </td>
                      <td className="px-5 py-2.5 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                      <td className="px-5 py-2.5 font-medium text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                      <td className="px-5 py-2.5 text-slate-600">{formatCurrency(inv.grandTotal - inv.amountPaid)}</td>
                      <td className="px-5 py-2.5">
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

      <CustomerFormModal open={editOpen} onClose={() => setEditOpen(false)} customer={data} />
    </div>
  );
}
