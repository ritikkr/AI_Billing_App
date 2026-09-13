import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useCompany } from '../../context/CompanyContext';
import { listItems } from '../../api/items';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';
import { formatCurrency } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { ItemFormModal } from './ItemFormModal';
import type { Item } from '../../types';

export default function ItemsList() {
  const { companyId, canEdit } = useCompany();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['items', companyId, search],
    queryFn: () => listItems(companyId!, search),
    enabled: !!companyId,
  });

  function openEdit(item: Item) {
    setEditing(item);
    setModalOpen(true);
  }
  function openNew() {
    setEditing(null);
    setModalOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Items & Services</h1>
          <p className="text-sm text-slate-500">Your product and service catalog with HSN/SAC codes and GST rates</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportCsv(
            (data ?? []).map((item) => ({
              name: item.name,
              type: item.itemType,
              hsnSacCode: item.hsnSacCode ?? '',
              unit: item.unit,
              salePrice: item.salePrice,
              gstRate: item.gstRate,
              stockQty: item.trackInventory ? item.stockQty ?? 0 : '',
            })),
            'items-export.csv'
          )} disabled={!data?.length}>
            Export CSV
          </Button>
          {canEdit && <Button onClick={openNew}>+ New Item</Button>}
        </div>
      </div>

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Input placeholder="Search by name or HSN/SAC…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No items yet" description="Add products or services to bill against them quickly." action={canEdit && <Button onClick={openNew}>+ New Item</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Name</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">HSN/SAC</th>
                  <th className="px-5 py-2.5 font-medium">Price</th>
                  <th className="px-5 py-2.5 font-medium">GST</th>
                  <th className="px-5 py-2.5 font-medium">Stock</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {data.map((item) => (
                  <tr key={item.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <div className="font-medium text-slate-900">{item.name}</div>
                      {item.description && <div className="max-w-xs truncate text-xs text-slate-400">{item.description}</div>}
                    </td>
                    <td className="px-5 py-3 text-slate-600 capitalize">{item.itemType}</td>
                    <td className="px-5 py-3 text-slate-600">{item.hsnSacCode || '-'}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">
                      {formatCurrency(item.salePrice)}
                      <span className="text-xs font-normal text-slate-400"> / {item.unit}</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge>{item.gstRate}%</Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{item.trackInventory ? item.stockQty : '—'}</td>
                    <td className="px-5 py-3 text-right">
                      {canEdit && (
                        <button onClick={() => openEdit(item)} className="text-sm font-medium text-indigo-600 hover:underline">
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <ItemFormModal open={modalOpen} onClose={() => setModalOpen(false)} item={editing} />
    </div>
  );
}
