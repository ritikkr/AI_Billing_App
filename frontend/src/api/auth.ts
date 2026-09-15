import { apiClient } from './client';
import type { Membership, User } from '../types';

export async function login(email: string, password: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login', { email, password });
  return data;
}

export async function sendOtp(email: string, purpose: 'register' | 'login' | 'reset' = 'register') {
  const { data } = await apiClient.post<{ message: string }>('/auth/send-otp', { email, purpose });
  return data;
}

export async function verifyOtp(email: string, otp: string, purpose: 'register' | 'login' | 'reset' = 'register') {
  const { data } = await apiClient.post<{ verificationToken: string }>('/auth/verify-otp', { email, otp, purpose });
  return data;
}

export async function loginWithOtp(email: string, verificationToken: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/login-otp', { email, verificationToken });
  return data;
}

export async function resetPassword(email: string, newPassword: string, verificationToken: string) {
  const { data } = await apiClient.post<{ message: string }>('/auth/reset-password', { email, newPassword, verificationToken });
  return data;
}

export async function register(name: string, email: string, password: string, verificationToken: string) {
  const { data } = await apiClient.post<{ token: string; user: User }>('/auth/register', {
    name,
    email,
    password,
    verificationToken,
  });
  return data;
}

export async function fetchMe() {
  const { data } = await apiClient.get<{ user: User; memberships: Membership[] }>('/auth/me');
  return data;
}
