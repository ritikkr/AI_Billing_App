import { apiClient } from './client';
import type { InvoiceLineItem, Quotation, QuotationDetail, QuotationSummary } from '../types';

export interface QuotationPayload {
  customerId: string;
  quotationDate: string;
  validUntil?: string | null;
  placeOfSupplyStateCode?: string;
  notes?: string | null;
  terms?: string | null;
  lineItems: InvoiceLineItem[];
}

export interface QuotationFilters {
  status?: string;
  customerId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function listQuotations(companyId: string, filters: QuotationFilters = {}) {
  const { data } = await apiClient.get<Quotation[]>(`/companies/${companyId}/quotations`, { params: filters });
  return data;
}

export async function getQuotation(companyId: string, id: string) {
  const { data } = await apiClient.get<QuotationDetail>(`/companies/${companyId}/quotations/${id}`);
  return data;
}

export async function createQuotation(companyId: string, payload: QuotationPayload) {
  const { data } = await apiClient.post<Quotation>(`/companies/${companyId}/quotations`, payload);
  return data;
}

export async function updateQuotation(companyId: string, id: string, payload: Partial<QuotationPayload>) {
  const { data } = await apiClient.patch<Quotation>(`/companies/${companyId}/quotations/${id}`, payload);
  return data;
}

export async function deleteQuotation(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/quotations/${id}`);
}

export async function sendQuotation(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/quotations/${id}/send`);
  return data;
}

export async function acceptQuotation(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/quotations/${id}/accept`);
  return data;
}

export async function rejectQuotation(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/quotations/${id}/reject`);
  return data;
}

export async function convertQuotation(companyId: string, id: string) {
  const { data } = await apiClient.post<{
    quotation: Quotation;
    invoice: { id: string; invoiceNumber: string; status: string };
  }>(`/companies/${companyId}/quotations/${id}/convert`);
  return data;
}

export async function cancelQuotation(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/quotations/${id}/cancel`);
  return data;
}

export async function getQuotationSummary(companyId: string) {
  const { data } = await apiClient.get<QuotationSummary>(`/companies/${companyId}/quotations/summary`);
  return data;
}

export async function getNextQuotationNumber(companyId: string, date?: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/quotations/next-number`, { params: { date } });
  return data as { quotationNumber: string; financialYear: string; quotationDate: string };
}