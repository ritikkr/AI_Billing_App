import { apiClient } from './client';
import type { Customer, CustomerDetail } from '../types';

export async function listCustomers(companyId: string, search = '', group = '') {
  const { data } = await apiClient.get<Customer[]>(`/companies/${companyId}/customers`, {
    params: { search: search || undefined, group: group || undefined },
  });
  return data;
}

export async function listCustomerGroups(companyId: string) {
  const { data } = await apiClient.get<string[]>(`/companies/${companyId}/customers/groups`);
  return data;
}

export async function getCustomer(companyId: string, id: string) {
  const { data } = await apiClient.get<CustomerDetail>(`/companies/${companyId}/customers/${id}`);
  return data;
}

export async function createCustomer(companyId: string, payload: Partial<Customer>) {
  const { data } = await apiClient.post<Customer>(`/companies/${companyId}/customers`, payload);
  return data;
}

export async function updateCustomer(companyId: string, id: string, payload: Partial<Customer>) {
  const { data } = await apiClient.patch<Customer>(`/companies/${companyId}/customers/${id}`, payload);
  return data;
}

export async function deleteCustomer(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/customers/${id}`);
}

export interface ImportCustomersResult {
  total: number;
  created: number;
  updated: number;
  failed: number;
  createdRows: Array<{ row: number; name: string }>;
  updatedRows: Array<{ row: number; id: string; name: string }>;
  errors: Array<{ row: number; name: string; reason: string }>;
}

export async function importCustomers(companyId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<ImportCustomersResult>(`/companies/${companyId}/customers/import`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}
