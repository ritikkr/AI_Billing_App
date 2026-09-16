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

/* -------------------------------------------------------------------------- */
/*  PDF Import                                                                */
/* -------------------------------------------------------------------------- */

export interface PdfImportPreviewResult {
  totalPages: number;
  invoices: Array<{
    page: number;
    invoiceNo: string;
    invoiceDate: string;
    supplierName: string;
    customer: { name: string; gstin: string | null; billingAddress: string; email: string | null; phone: string | null };
    lineItems: Array<{ description: string; hsnSacCode: string | null; qty: number; rate: number; gstRate: number }>;
    parsed: { subtotal: number; tax: number; roundOff: number; grandTotal: number };
  }>;
  customers: Array<{ name: string; gstin: string | null; billingAddress: string; email: string | null; isNew: boolean }>;
}

export interface PdfImportResult {
  totalPages: number;
  customers: { created: number; updated: number };
  invoices: { created: number; updated: number; skipped: number };
  created: Array<{ page: number; invoiceNo: string; customerName: string; invoiceId: string; grandTotal: number }>;
  updated: Array<{ page: number; invoiceNo: string; customerName: string; invoiceId: string; grandTotal: number }>;
  skipped: Array<{ page: number; invoiceNo: string; reason: string }>;
  failed: Array<{ page: number; invoiceNo: string; reason: string }>;
}

export async function previewPdfImport(companyId: string, file: File): Promise<PdfImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<PdfImportPreviewResult>(
    `/companies/${companyId}/pdf-import`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' }, params: { mode: 'preview' } }
  );
  return data;
}

export async function importPdf(
  companyId: string,
  file: File,
  opts: { mode?: 'import' | 'customers_only'; status?: 'draft' | 'sent' } = {}
): Promise<PdfImportResult> {
  const formData = new FormData();
  formData.append('file', file);
  const { data } = await apiClient.post<PdfImportResult>(
    `/companies/${companyId}/pdf-import`,
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      params: { mode: opts.mode || 'import', status: opts.status || 'sent' },
    }
  );
  return data;
}
