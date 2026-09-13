import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getActiveCompanyId, setActiveCompanyId } from '../api/client';
import { useAuth } from './AuthContext';
import type { Role } from '../types';

interface CompanyContextValue {
  companyId: string | null;
  companyName: string | null;
  role: Role | null;
  setCompanyId: (id: string) => void;
  isAdmin: boolean;
  canEdit: boolean; // admin or accountant
}

const CompanyContext = createContext<CompanyContextValue | undefined>(undefined);

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { memberships } = useAuth();
  const [companyId, setCompanyIdState] = useState<string | null>(getActiveCompanyId());

  useEffect(() => {
    if (memberships.length === 0) return;
    const stillValid = memberships.some((m) => m.companyId === companyId);
    if (!companyId || !stillValid) {
      const first = memberships[0].companyId;
      setActiveCompanyId(first);
      setCompanyIdState(first);
    }
  }, [memberships, companyId]);

  const setCompanyId = useCallback((id: string) => {
    setActiveCompanyId(id);
    setCompanyIdState(id);
  }, []);

  const membership = memberships.find((m) => m.companyId === companyId);

  const value = useMemo<CompanyContextValue>(
    () => ({
      companyId,
      companyName: membership?.companyName || null,
      role: membership?.role || null,
      setCompanyId,
      isAdmin: membership?.role === 'admin',
      canEdit: membership?.role === 'admin' || membership?.role === 'accountant',
    }),
    [companyId, membership, setCompanyId]
  );

  return <CompanyContext.Provider value={value}>{children}</CompanyContext.Provider>;
}

export function useCompany() {
  const ctx = useContext(CompanyContext);
  if (!ctx) throw new Error('useCompany must be used within CompanyProvider');
  return ctx;
}
