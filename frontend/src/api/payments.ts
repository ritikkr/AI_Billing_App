import { apiClient } from './client';
import type { Payment } from '../types';

export interface PaymentPayload {
  invoiceId: string;
  paymentDate: string;
  amount: number;
  paymentMode: string;
  referenceNo?: string | null;
  notes?: string | null;
}

export async function listPayments(companyId: string, filters: { invoiceId?: string; from?: string; to?: string } = {}) {
  const { data } = await apiClient.get<Payment[]>(`/companies/${companyId}/payments`, { params: filters });
  return data;
}

export async function recordPayment(companyId: string, payload: PaymentPayload) {
  const { data } = await apiClient.post<Payment>(`/companies/${companyId}/payments`, payload);
  return data;
}

export async function deletePayment(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/payments/${id}`);
}
