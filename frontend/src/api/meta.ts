import { apiClient } from './client';
import type { Meta } from '../types';

export async function fetchMeta() {
  const { data } = await apiClient.get<Meta>('/meta');
  return data;
}
