import { apiClient } from './client';
import type { Invoice, InvoiceDetail, InvoiceLineItem } from '../types';

export interface InvoicePayload {
  customerId: string;
  invoiceDate: string;
  dueDate?: string | null;
  placeOfSupplyStateCode?: string;
  reverseCharge?: boolean;
  status?: 'draft' | 'sent';
  notes?: string | null;
  terms?: string | null;
  lineItems: InvoiceLineItem[];
}

export interface InvoiceFilters {
  status?: string;
  customerId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function listInvoices(companyId: string, filters: InvoiceFilters = {}) {
  const { data } = await apiClient.get<Invoice[]>(`/companies/${companyId}/invoices`, { params: filters });
  return data;
}

export async function getInvoice(companyId: string, id: string) {
  const { data } = await apiClient.get<InvoiceDetail>(`/companies/${companyId}/invoices/${id}`);
  return data;
}

export async function createInvoice(companyId: string, payload: InvoicePayload) {
  const { data } = await apiClient.post<Invoice>(`/companies/${companyId}/invoices`, payload);
  return data;
}

export async function updateInvoice(companyId: string, id: string, payload: InvoicePayload) {
  const { data } = await apiClient.patch<Invoice>(`/companies/${companyId}/invoices/${id}`, payload);
  return data;
}

export async function previewInvoice(companyId: string, payload: Partial<InvoicePayload>) {
  const { data } = await apiClient.post(`/companies/${companyId}/invoices/preview`, payload);
  return data;
}

export async function cancelInvoice(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/invoices/${id}/cancel`);
  return data;
}

export async function deleteInvoice(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/invoices/${id}`);
}

export interface InvoiceSummary {
  counts: {
    total: number;
    draft: number;
    sent: number;
    partiallyPaid: number;
    paid: number;
    overdue: number;
    cancelled: number;
  };
  totalInvoiced: number;
  totalCollected: number;
  totalOutstanding: number;
  overdueInvoices: number;
  overdueAmount: number;
}

export async function getInvoiceSummary(companyId: string) {
  const { data } = await apiClient.get<InvoiceSummary>(`/companies/${companyId}/invoices/summary`);
  return data;
}

export interface NextInvoiceNumber {
  invoiceNumber: string;
  financialYear: string;
  invoiceDate: string;
}

export async function getNextInvoiceNumber(companyId: string, date?: string) {
  const { data } = await apiClient.get<NextInvoiceNumber>(`/companies/${companyId}/invoices/next-number`, {
    params: { date },
  });
  return data;
}

export interface OverdueInvoice extends Invoice {
  customerName: string;
  daysOverdue: number;
  overdueBucket: '0-30' | '31-60' | '61-90' | '90+';
}

export async function listOverdueInvoices(companyId: string) {
  const { data } = await apiClient.get<{
    totalOutstanding: number;
    byBucket: Record<string, number>;
    invoices: OverdueInvoice[];
  }>(`/companies/${companyId}/invoices/overdue`);
  return data;
}

export async function markInvoiceSent(companyId: string, id: string) {
  const { data } = await apiClient.post<Invoice>(`/companies/${companyId}/invoices/${id}/mark-sent`);
  return data;
}

export async function duplicateInvoice(companyId: string, id: string) {
  const { data } = await apiClient.post<Invoice>(`/companies/${companyId}/invoices/${id}/duplicate`);
  return data;
}

export async function bulkDeleteInvoices(companyId: string, ids: string[]) {
  const { data } = await apiClient.delete<{
    deleted: string[];
    deletedCount: number;
    skipped: Array<{ id: string; reason: string }>;
    skippedCount: number;
    notFound: string[];
  }>(`/companies/${companyId}/invoices/bulk`, { data: { ids } });
  return data;
}
