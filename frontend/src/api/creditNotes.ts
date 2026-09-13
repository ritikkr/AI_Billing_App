import { apiClient } from './client';
import type { CreditNote, CreditNoteDetail, InvoiceLineItem, NoteType } from '../types';

export interface CreditNotePayload {
  noteType: NoteType;
  customerId: string;
  invoiceId?: string | null;
  noteDate: string;
  reason?: string | null;
  placeOfSupplyStateCode?: string;
  notes?: string | null;
  lineItems: InvoiceLineItem[];
}

export async function listCreditNotes(companyId: string, filters: { noteType?: string; customerId?: string } = {}) {
  const { data } = await apiClient.get<CreditNote[]>(`/companies/${companyId}/credit-notes`, { params: filters });
  return data;
}

export async function getCreditNote(companyId: string, id: string) {
  const { data } = await apiClient.get<CreditNoteDetail>(`/companies/${companyId}/credit-notes/${id}`);
  return data;
}

export async function createCreditNote(companyId: string, payload: CreditNotePayload) {
  const { data } = await apiClient.post<CreditNote>(`/companies/${companyId}/credit-notes`, payload);
  return data;
}

export async function cancelCreditNote(companyId: string, id: string) {
  const { data } = await apiClient.post(`/companies/${companyId}/credit-notes/${id}/cancel`);
  return data;
}
