import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

let activeCompanyId: string | null = localStorage.getItem('activeCompanyId');

export function setActiveCompanyId(companyId: string | null) {
  activeCompanyId = companyId;
  if (companyId) localStorage.setItem('activeCompanyId', companyId);
  else localStorage.removeItem('activeCompanyId');
}

export function getActiveCompanyId() {
  return activeCompanyId;
}

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (activeCompanyId) {
    config.headers['X-Company-Id'] = activeCompanyId;
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as any;
    if (data?.error) return data.error;
    if (data?.details?.formErrors?.length) return data.details.formErrors.join(', ');
  }
  return fallback;
}
