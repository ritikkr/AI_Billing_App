import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { listCustomers, listCustomerGroups, deleteCustomer } from '../../api/customers';
import { apiErrorMessage } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { Pagination } from '../../components/ui/Pagination';
import { formatCurrency } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { CustomerFormModal } from './CustomerFormModal';
import { ImportCustomersModal } from './ImportCustomersModal';

const PAGE_SIZE = 10;

export default function CustomersList() {
  const { companyId, canEdit, isAdmin } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['customers', companyId, search, group],
    queryFn: () => listCustomers(companyId!, search, group),
    enabled: !!companyId,
  });

  const { data: groups } = useQuery({
    queryKey: ['customerGroups', companyId],
    queryFn: () => listCustomerGroups(companyId!),
    enabled: !!companyId,
  });

  // Clear selection and go back to first page when search or data changes
  useEffect(() => {
    setSelected(new Set());
    setPage(1);
  }, [search, group, data?.length]);

  const pageCount = Math.max(1, Math.ceil((data?.length || 0) / PAGE_SIZE));
  const paged = useMemo(() => {
    if (!data) return [];
    const start = (page - 1) * PAGE_SIZE;
    return data.slice(start, start + PAGE_SIZE);
  }, [data, page]);

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        await deleteCustomer(companyId!, id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers', companyId] });
      queryClient.invalidateQueries({ queryKey: ['customerGroups', companyId] });
      notify('Customer(s) deleted');
      setSelected(new Set());
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not delete customer(s)'), 'error'),
  });

  function handleSelectAll() {
    if (selected.size === paged.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paged.map((c) => c.id)));
    }
  }

  function handleSelectOne(id: string) {
    const newSelected = new Set(selected);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelected(newSelected);
  }

  function handleDelete(ids: string[]) {
    if (!confirm(`Delete ${ids.length} customer(s)? This action cannot be undone.`)) return;
    deleteMutation.mutate(ids);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Customers</h1>
          <p className="text-sm text-slate-500">Manage the businesses and people you bill</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-600">{selected.size} selected</span>
              <Button variant="outline" size="sm" onClick={() => handleDelete(Array.from(selected))} loading={deleteMutation.isPending}>
                Delete
              </Button>
            </div>
          )}
          <Button variant="outline" size="sm" onClick={() => exportCsv(
            (data ?? []).map((customer) => ({
              name: customer.name,
              group: customer.group ?? '',
              gstin: customer.gstin ?? '',
              email: customer.email ?? '',
              phone: customer.phone ?? '',
              address: customer.billingAddress ?? '',
              status: customer.isActive ? 'Active' : 'Archived',
              creditLimit: customer.creditLimit,
              openingBalance: customer.openingBalance,
              receivableBalance: customer.receivableBalance,
              payableBalance: customer.payableBalance,
            })),
            'customers-export.csv'
          )} disabled={!data?.length}>
            Export CSV
          </Button>
          {canEdit && (
            <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
              Import
            </Button>
          )}
          {canEdit && <Button onClick={() => setModalOpen(true)}>+ New Customer</Button>}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-100 bg-slate-50/40 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="search" name="customer-search" autoComplete="off" enterKeyHint="search" placeholder="Search by name, GSTIN or email…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
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
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No customers yet" description="Add your first customer to start invoicing." action={canEdit && <Button onClick={() => setModalOpen(true)}>+ New Customer</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="w-10 px-3 py-3 font-medium">
                    <input
                      ref={(el) => {
                        if (el) el.indeterminate = selected.size > 0 && selected.size < paged.length;
                      }}
                      type="checkbox"
                      checked={selected.size > 0 && selected.size === paged.length}
                      onChange={handleSelectAll}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Group</th>
                  <th className="px-5 py-3 font-medium">GSTIN</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  {isAdmin && <th className="w-10 px-5 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody>
                {paged.map((c) => (
                  <tr key={c.id} className={`border-b border-slate-100/70 transition-colors last:border-0 ${selected.has(c.id) ? 'bg-indigo-50/70' : 'hover:bg-slate-50/60'}`}>
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => handleSelectOne(c.id)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Link to={`/customers/${c.id}`} className="font-medium text-indigo-600 transition-colors hover:text-indigo-700">
                        {c.name}
                      </Link>
                      {c.openingBalance !== 0 && (
                        <div className="text-xs text-slate-400">Opening bal. {formatCurrency(c.openingBalance)}</div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-slate-600">{c.group || <span className="text-slate-300">–</span>}</td>
                    <td className="px-5 py-3 text-slate-600">{c.gstin || <Badge>B2C</Badge>}</td>
                    <td className="px-5 py-3 text-slate-600">
                      <div>{c.phone || '-'}</div>
                      <div className="text-xs text-slate-400">{c.email}</div>
                    </td>
                    <td className="px-5 py-3">
                      {c.isActive ? <Badge className="bg-emerald-50 text-emerald-700">Active</Badge> : <Badge>Archived</Badge>}
                    </td>
                    {isAdmin && (
                      <td className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => handleDelete([c.id])}
                          disabled={deleteMutation.isPending}
                          className="text-red-500 hover:text-red-700 disabled:opacity-40"
                          title="Delete customer"
                          aria-label={`Delete ${c.name}`}
                        >
                          🗑
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} pageCount={pageCount} total={data?.length || 0} pageSize={PAGE_SIZE} onChange={setPage} />
      </Card>

      <CustomerFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
      <ImportCustomersModal open={importOpen} onClose={() => setImportOpen(false)} />
    </div>
  );
}
