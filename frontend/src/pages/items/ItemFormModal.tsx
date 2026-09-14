import { useEffect, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { createItem, updateItem } from '../../api/items';
import { fetchMeta } from '../../api/meta';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import type { Item } from '../../types';

export function ItemFormModal({ open, onClose, item }: { open: boolean; onClose: () => void; item?: Item | null }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });

  const [form, setForm] = useState(() => toValues(item));
  const [error, setError] = useState('');

  useEffect(() => {
    setForm(toValues(item));
    setError('');
  }, [item?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        hsnSacCode: form.hsnSacCode || null,
        itemType: form.itemType as 'goods' | 'service',
        unit: form.unit,
        salePrice: Number(form.salePrice) || 0,
        purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : null,
        gstRate: Number(form.gstRate),
        trackInventory: form.trackInventory,
        stockQty: form.trackInventory ? Number(form.stockQty) || 0 : null,
      };
      if (item) return updateItem(companyId!, item.id, payload);
      return createItem(companyId!, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items', companyId] });
      notify(item ? 'Item updated' : 'Item created');
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not save item')),
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updateString<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value as (typeof form)[K] }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit item' : 'New item'}
      subtitle={item ? `ID ${item.id.slice(0, 8)}` : 'Add a product or service you sell'}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      }
      headerActions={
        <>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" size="sm" loading={mutation.isPending}>
            {item ? 'Save changes' : 'Create item'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Input label="Item / Service name" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        <Textarea label="Description" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Select label="Type" value={form.itemType} onChange={(e) => updateString('itemType', e.target.value)}>
            <option value="goods">Goods</option>
            <option value="service">Service</option>
          </Select>
          <Input
            label={form.itemType === 'goods' ? 'HSN code' : 'SAC code'}
            value={form.hsnSacCode}
            onChange={(e) => update('hsnSacCode', e.target.value)}
            hint="Required for GST returns"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input label="Sale price (₹)" type="number" min="0" step="0.01" required value={form.salePrice} onChange={(e) => update('salePrice', e.target.value)} />
          <Input label="Purchase price (₹)" type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => update('purchasePrice', e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select label="Unit" value={form.unit} onChange={(e) => update('unit', e.target.value)}>
            {(meta?.units || ['NOS']).map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
          <Select label="GST rate" required value={form.gstRate} onChange={(e) => update('gstRate', e.target.value)}>
            {(meta?.gstRateSlabs || [0, 5, 12, 18, 28]).map((r) => (
              <option key={r} value={r}>
                {r}%
              </option>
            ))}
          </Select>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.trackInventory}
            onChange={(e) => update('trackInventory', e.target.checked)}
            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
          />
          Track stock quantity
        </label>
        {form.trackInventory && (
          <Input label="Current stock quantity" type="number" value={form.stockQty} onChange={(e) => update('stockQty', e.target.value)} />
        )}
      </form>
    </Modal>
  );
}

function toValues(item?: Item | null) {
  return {
    name: item?.name || '',
    description: item?.description || '',
    hsnSacCode: item?.hsnSacCode || '',
    itemType: item?.itemType || 'goods',
    unit: item?.unit || 'NOS',
    salePrice: String(item?.salePrice ?? ''),
    purchasePrice: item?.purchasePrice != null ? String(item.purchasePrice) : '',
    gstRate: String(item?.gstRate ?? 18),
    trackInventory: item?.trackInventory || false,
    stockQty: item?.stockQty != null ? String(item.stockQty) : '0',
  };
}
