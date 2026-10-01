import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { listCustomerGroups, listCustomers } from '../../api/customers';
import { deleteCustomerMonthlyBill, listMonthlyBills } from '../../api/monthlyBills';
import { apiErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency, formatDate } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { MonthlyBillFormModal } from './MonthlyBillFormModal';
import { GenerateMonthlyBillModal } from './GenerateMonthlyBillModal';
import type { Customer, MonthlyBillSummary } from '../../types';

const PAGE_SIZE = 10;

export default function MonthlyBillsList() {
  const { companyId, canEdit } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [generateOpen, setGenerateOpen] = useState(false);

  const { data: customers, isLoading: loadingCustomers } = useQuery({
    queryKey: ['customers', companyId, '', group],
    queryFn: () => listCustomers(companyId!, '', group),
    enabled: !!companyId,
  });

  const { data: groups } = useQuery({
    queryKey: ['customerGroups', companyId],
    queryFn: () => listCustomerGroups(companyId!),
    enabled: !!companyId,
  });

  const { data: bills, isLoading: loadingBills } = useQuery({
    queryKey: ['monthlyBills', companyId],
    queryFn: () => listMonthlyBills(companyId!),
    enabled: !!companyId,
  });

  useEffect(() => {
    setPage(1);
  }, [search, group]);

  const billByCustomer = useMemo(() => {
    const map = new Map<string, MonthlyBillSummary>();
    for (const bill of bills || []) map.set(bill.customerId, bill);
    return map;
  }, [bills]);

  const rows = useMemo(() => {
    const list = customers || [];
    const q = search.trim().toLowerCase();
    return list
      .map((customer) => ({ customer, bill: billByCustomer.get(customer.id) }))
      .filter(({ customer }) => !q || customer.name.toLowerCase().includes(q) || (customer.gstin || '').toLowerCase().includes(q));
  }, [customers, billByCustomer, search]);

  const configured = rows.filter((r) => r.bill);
  const monthlyTotal = configured.reduce((sum, r) => sum + (r.bill?.monthlyGrandTotal || 0), 0);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const paged = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const deleteMutation = useMutation({
    mutationFn: (customerId: string) => deleteCustomerMonthlyBill(companyId!, customerId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['monthlyBills', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerMonthlyBill', companyId] });
      notify('Monthly bill removed');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not remove monthly bill'), 'error'),
  });

  function handleDelete(customer: Customer) {
    if (!confirm(`Remove the monthly bill for ${customer.name}? Their invoices are not affected.`)) return;
    deleteMutation.mutate(customer.id);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Monthly Bills</h1>
          <p className="text-sm text-slate-500">
            {configured.length > 0
              ? `${configured.length} of ${rows.length} customers configured · ${formatCurrency(monthlyTotal)} billed every month`
              : 'Set the items and prices you bill each customer every month'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              exportCsv(
                configured.map(({ customer, bill }) => ({
                  name: customer.name,
                  group: customer.group ?? '',
                  items: bill?.itemCount ?? 0,
                  monthlySubtotal: bill?.monthlySubtotal ?? 0,
                  monthlyTax: bill?.monthlyTax ?? 0,
                  monthlyTotal: bill?.monthlyGrandTotal ?? 0,
                  updatedAt: bill?.updatedAt ?? '',
                })),
                'monthly-bills-export.csv'
              )
            }
            disabled={!configured.length}
          >
            Export CSV
          </Button>
          {canEdit && (
            <Button onClick={() => setGenerateOpen(true)} disabled={!configured.length}>
              Generate Monthly Bills
            </Button>
          )}
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 bg-slate-50/40 p-4">
          <Input
            type="search"
            name="monthly-bill-search"
            autoComplete="off"
            enterKeyHint="search"
            placeholder="Search customer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value)}
            aria-label="Filter by customer group"
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition duration-150 hover:border-slate-300 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15"
          >
            <option value="">All groups</option>
            {(groups || []).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        {loadingCustomers || loadingBills ? (
          <PageLoader />
        ) : rows.length === 0 ? (
          <EmptyState title="No customers found" description="Add customers to define their monthly bill." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Group</th>
                  <th className="px-5 py-3 font-medium">Items / month</th>
                  <th className="px-5 py-3 font-medium">Taxable value</th>
                  <th className="px-5 py-3 font-medium">Monthly total</th>
                  <th className="px-5 py-3 font-medium">Updated</th>
                  <th className="px-5 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map(({ customer, bill }) => (
                  <tr
                    key={customer.id}
                    className="border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/60"
                  >
                    <td className="px-5 py-3">
                      <Link
                        to={`/customers/${customer.id}`}
                        className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                      >
                        {customer.name}
                      </Link>
                      {!customer.isActive && <Badge className="ml-2">Archived</Badge>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">
                      {customer.group || <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{bill ? bill.itemCount : <span className="text-slate-300">–</span>}</td>
                    <td className="px-5 py-3 tabular-nums text-slate-600">
                      {bill ? formatCurrency(bill.monthlyTaxableValue) : <span className="text-slate-300">–</span>}
                    </td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">
                      {bill ? (
                        formatCurrency(bill.monthlyGrandTotal)
                      ) : (
                        <Badge>Not set</Badge>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{bill ? formatDate(bill.updatedAt) : '–'}</td>
                    <td className="px-5 py-3 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setEditing(customer)}
                            className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700"
                          >
                            {bill ? 'Edit' : 'Set up'}
                          </button>
                          {bill && (
                            <button
                              type="button"
                              onClick={() => handleDelete(customer)}
                              className="text-sm font-medium text-red-500 transition-colors hover:text-red-700"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">View only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} total={rows.length} pageSize={PAGE_SIZE} onChange={setPage} />
      </Card>

      <MonthlyBillFormModal open={!!editing} onClose={() => setEditing(null)} customer={editing} />
      <GenerateMonthlyBillModal open={generateOpen} onClose={() => setGenerateOpen(false)} />
    </div>
  );
}
