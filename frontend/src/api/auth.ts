import { apiClient } from './client';
import type { Membership, User } from '../types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', { email, password });
  return data;
}

export async function register(name: string, email: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/register', { name, email, password });
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ user: User; memberships: Membership[] }>('/auth/me');
  return data;
}
