import { apiClient } from './client';
import type { Preferences } from '../types';

export async function getPreferences(companyId: string) {
  const { data } = await apiClient.get<Preferences>(`/companies/${companyId}/preferences`);
  return data;
}

export async function updatePreferences(companyId: string, payload: Pick<Preferences, 'printDesign' | 'downloadDesign'>) {
  const { data } = await apiClient.put<Preferences>(`/companies/${companyId}/preferences`, payload);
  return data;
}
