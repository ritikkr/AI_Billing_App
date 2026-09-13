import { apiClient } from './client';
import type { Company, CompanyUser, Role } from '../types';

export async function listCompanies() {
  const { data } = await apiClient.get<Company[]>('/companies');
  return data;
}

export async function getCompany(companyId: string) {
  const { data } = await apiClient.get<Company>(`/companies/${companyId}`);
  return data;
}

export async function createCompany(payload: Partial<Company>) {
  const { data } = await apiClient.post<Company>('/companies', payload);
  return data;
}

export async function updateCompany(companyId: string, payload: Partial<Company>) {
  const { data } = await apiClient.patch<Company>(`/companies/${companyId}`, payload);
  return data;
}

export async function listCompanyUsers(companyId: string) {
  const { data } = await apiClient.get<CompanyUser[]>(`/companies/${companyId}/users`);
  return data;
}

export async function addCompanyUser(
  companyId: string,
  payload: { email: string; name?: string; password?: string; role: Role }
) {
  const { data } = await apiClient.post<CompanyUser>(`/companies/${companyId}/users`, payload);
  return data;
}

export async function updateCompanyUserRole(companyId: string, userId: string, role: Role) {
  const { data } = await apiClient.patch(`/companies/${companyId}/users/${userId}`, { role });
  return data;
}

export async function removeCompanyUser(companyId: string, userId: string) {
  await apiClient.delete(`/companies/${companyId}/users/${userId}`);
}
