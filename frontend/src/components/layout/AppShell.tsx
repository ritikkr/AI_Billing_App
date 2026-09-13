import { Link, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { CompanySwitcher } from './CompanySwitcher';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';
import { useState } from 'react';

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white">₹</div>
            <span className="text-base font-semibold text-slate-900">BillGST</span>
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <CompanySwitcher />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white"
              >
                {user ? initials(user.name) : '?'}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-20 mt-2 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    <div className="border-b border-slate-100 px-3 py-2">
                      <p className="truncate text-sm font-medium text-slate-900">{user?.name}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <Link to="/profile" onClick={() => setMenuOpen(false)} className="block px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50">
                      My Profile
                    </Link>
                    <button onClick={logout} className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-50">
                      Sign out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
