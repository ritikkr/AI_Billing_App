import { apiClient } from './client';
import type { Certificate, CertificateDetail, CertificateTemplate } from '../types';

export interface CertificatePayload {
  templateId?: string | null;
  certificateDate: string;
  customerId?: string | null;
  outletName?: string | null;
  outletAddress?: string | null;
  serviceDate?: string | null;
  serviceType?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  customFields?: Record<string, string>;
  notes?: string | null;
  issuedBy?: string | null;
}

export interface CertificateFilters {
  status?: string;
  customerId?: string;
  search?: string;
  from?: string;
  to?: string;
}

export async function listCertificates(companyId: string, filters: CertificateFilters = {}) {
  const { data } = await apiClient.get<Certificate[]>(`/companies/${companyId}/certificates`, { params: filters });
  return data;
}

export async function getCertificate(companyId: string, id: string) {
  const { data } = await apiClient.get<CertificateDetail>(`/companies/${companyId}/certificates/${id}`);
  return data;
}

export async function createCertificate(companyId: string, payload: CertificatePayload) {
  const { data } = await apiClient.post<Certificate>(`/companies/${companyId}/certificates`, payload);
  return data;
}

export async function updateCertificate(companyId: string, id: string, payload: Partial<CertificatePayload>) {
  const { data } = await apiClient.patch<Certificate>(`/companies/${companyId}/certificates/${id}`, payload);
  return data;
}

export async function deleteCertificate(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/certificates/${id}`);
}

export async function issueCertificate(companyId: string, id: string) {
  const { data } = await apiClient.post<Certificate>(`/companies/${companyId}/certificates/${id}/issue`);
  return data;
}

export async function cancelCertificate(companyId: string, id: string) {
  const { data } = await apiClient.post<Certificate>(`/companies/${companyId}/certificates/${id}/cancel`);
  return data;
}

export async function getNextCertificateNumber(companyId: string, date?: string) {
  const { data } = await apiClient.get(`/companies/${companyId}/certificates/next-number`, { params: { date } });
  return data as { certificateNumber: string; financialYear: string; certificateDate: string };
}

export async function listCertificateTemplates(companyId: string) {
  const { data } = await apiClient.get<CertificateTemplate[]>(`/companies/${companyId}/certificate-templates`);
  return data;
}

export async function createCertificateTemplate(companyId: string, payload: { name: string; subject: string; body: string }) {
  const { data } = await apiClient.post<CertificateTemplate>(`/companies/${companyId}/certificate-templates`, payload);
  return data;
}

export async function updateCertificateTemplate(companyId: string, id: string, payload: Partial<{ name: string; subject: string; body: string }>) {
  const { data } = await apiClient.patch<CertificateTemplate>(`/companies/${companyId}/certificate-templates/${id}`, payload);
  return data;
}

export async function deleteCertificateTemplate(companyId: string, id: string) {
  await apiClient.delete(`/companies/${companyId}/certificate-templates/${id}`);
}