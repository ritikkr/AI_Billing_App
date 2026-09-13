import { apiClient } from './client';
import type { Item } from '../types';

export async function listItems(companyId: string, search = '') {
  const { data } = await apiClient.get<Item[]>(`/companies/${companyId}/items`, { params: { search } });
  return data;
}

export async function getItem(companyId: string, id: string) {
  const { data } = await apiClient.get<Item>(`/companies/${companyId}/items/${id}`);
  return data;
}

export async function createItem(companyId: string, payload: Partial<Item>) {
  const { data } = await apiClient.post<Item>(`/companies/${companyId}/items`, payload);
  return data;
}

export async function updateItem(companyId: string, id: string, payload: Partial<Item>) {
  const { data } = await apiClient.patch<Item>(`/companies/${companyId}/items/${id}`, payload);
  return data;
}

export async function deleteItem(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/items/${id}`);
}

export interface ItemSummary {
  totalItems: number;
  activeItems: number;
  inactiveItems: number;
  goodsCount: number;
  serviceCount: number;
  stockUnits: number;
  stockValue: number;
  saleStockValue: number;
  lowStockCount: number;
  lowStockThreshold: number;
}

export async function getItemSummary(companyId: string, lowStockThreshold = 10) {
  const { data } = await apiClient.get<ItemSummary>(`/companies/${companyId}/items/summary`, {
    params: { lowStockThreshold },
  });
  return data;
}

export async function bulkCreateItems(companyId: string, payload: Array<Partial<Item>>) {
  const { data } = await apiClient.post<Item[]>(`/companies/${companyId}/items/bulk`, { items: payload });
  return data;
}

export async function bulkUpdateItems(companyId: string, ids: string[], payload: Partial<Item>) {
  const { data } = await apiClient.patch<{ updated: number; items: Item[] }>(
    `/companies/${companyId}/items/bulk`,
    { ids, data: payload }
  );
  return data;
}

export async function bulkDeleteItems(companyId: string, ids: string[]) {
  const { data } = await apiClient.delete<{
    deleted: string[];
    archived: string[];
    archivedCount: number;
    deletedCount: number;
    notFound: string[];
  }>(`/companies/${companyId}/items/bulk`, { data: { ids } });
  return data;
}

export type StockAdjustmentMode = 'set' | 'increase' | 'decrease';

export async function adjustItemStock(
  companyId: string,
  id: string,
  stockQty: number,
  mode: StockAdjustmentMode = 'set',
  reason?: string
) {
  const { data } = await apiClient.patch<Item & { previousStockQty: number }>(
    `/companies/${companyId}/items/${id}/stock`,
    { stockQty, mode, reason }
  );
  return data;
}

export async function duplicateItem(companyId: string, id: string) {
  const { data } = await apiClient.post<Item>(`/companies/${companyId}/items/${id}/duplicate`);
  return data;
}
