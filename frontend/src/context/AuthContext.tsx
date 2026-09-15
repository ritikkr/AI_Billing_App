import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchMe, login as apiLogin, loginWithOtp as apiLoginWithOtp, register as apiRegister } from '../api/auth';
import type { Membership, User } from '../types';

interface AuthContextValue {
  user: User | null;
  memberships: Membership[];
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithOtp: (email: string, verificationToken: string) => Promise<void>;
  register: (name: string, email: string, password: string, verificationToken: string) => Promise<void>;
  logout: () => void;
  refreshMemberships: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe();
      setUser(data.user);
      setMemberships(data.memberships);
    } catch {
      localStorage.removeItem('token');
      setUser(null);
      setMemberships([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const me = await fetchMe();
    setMemberships(me.memberships);
  }, []);

  const loginWithOtp = useCallback(async (email: string, verificationToken: string) => {
    const data = await apiLoginWithOtp(email, verificationToken);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    const me = await fetchMe();
    setMemberships(me.memberships);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string, verificationToken: string) => {
    const data = await apiRegister(name, email, password, verificationToken);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    setMemberships([]);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('activeCompanyId');
    setUser(null);
    setMemberships([]);
    window.location.href = '/login';
  }, []);

  const value = useMemo(
    () => ({ user, memberships, loading, login, loginWithOtp, register, logout, refreshMemberships: loadMe }),
    [user, memberships, loading, login, loginWithOtp, register, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
