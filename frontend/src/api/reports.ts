import { apiClient } from './client';
import type { DashboardStats } from '../types';

export async function fetchDashboard(companyId: string) {
  const { data } = await apiClient.get<DashboardStats>(`/companies/${companyId}/reports/dashboard`);
  return data;
}

export async function fetchSalesRegister(companyId: string, from?: string, to?: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/reports/sales-register`, { params: { from, to } });
  return data;
}

export async function fetchGstSummary(companyId: string, from?: string, to?: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/reports/gst-summary`, { params: { from, to } });
  return data;
}

export async function fetchHsnSummary(companyId: string, from?: string, to?: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/reports/hsn-summary`, { params: { from, to } });
  return data;
}

export async function fetchAging(companyId: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/reports/aging`);
  return data;
}
