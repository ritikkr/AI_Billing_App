import { apiClient } from './client';
import type {
  CustomerMonthlyBillResponse,
  MonthlyBillCopySources,
  MonthlyBillGeneratePayload,
  MonthlyBillGenerateResult,
  MonthlyBillItem,
  MonthlyBillSummary,
} from '../types';

export async function listMonthlyBills(companyId: string, group = '', includeItems = false) {
  const { data } = await apiClient.get<MonthlyBillSummary[]>(`/companies/${companyId}/monthly-bills`, {
    params: { group: group || undefined, includeItems: includeItems || undefined },
  });
  return data;
}

export async function getCustomerMonthlyBill(companyId: string, customerId: string) {
  const { data } = await apiClient.get<CustomerMonthlyBillResponse>(
    `/companies/${companyId}/monthly-bills/customer/${customerId}`
  );
  return data;
}

export async function saveCustomerMonthlyBill(
  companyId: string,
  customerId: string,
  payload: { notes?: string | null; items: MonthlyBillItem[] }
) {
  const { data } = await apiClient.put<CustomerMonthlyBillResponse>(
    `/companies/${companyId}/monthly-bills/customer/${customerId}`,
    payload
  );
  return data;
}

export async function deleteCustomerMonthlyBill(companyId: string, customerId: string) {
  await apiClient.delete(`/companies/${companyId}/monthly-bills/customer/${customerId}`);
}

export async function getMonthlyBillCopySources(companyId: string, customerId: string) {
  const { data } = await apiClient.get<MonthlyBillCopySources>(
    `/companies/${companyId}/monthly-bills/copy-sources/${customerId}`
  );
  return data;
}

export async function copyMonthlyBill(companyId: string, customerId: string, fromCustomerId: string) {
  const { data } = await apiClient.post<CustomerMonthlyBillResponse>(
    `/companies/${companyId}/monthly-bills/customer/${customerId}/copy`,
    { fromCustomerId }
  );
  return data;
}

export async function generateMonthlyBills(companyId: string, payload: MonthlyBillGeneratePayload) {
  const { data } = await apiClient.post<MonthlyBillGenerateResult>(`/companies/${companyId}/monthly-bills/generate`, payload);
  return data;
}
