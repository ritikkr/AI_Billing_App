import { Link, Outlet, useLocation } from 'react-router-dom';
import { Sidebar, MobileNav } from './Sidebar';
import { CompanySwitcher } from './CompanySwitcher';
import { Logo } from '../ui/Logo';
import { useAuth } from '../../context/AuthContext';
import { initials } from '../../utils/format';
import { useEffect, useState } from 'react';

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNavOpen(false);
        setMenuOpen(false);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <MobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200/70 bg-white/80 px-4 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-2 md:hidden">
            <button
              onClick={() => setNavOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              aria-label="Open navigation menu"
              aria-expanded={navOpen}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Logo size="sm" withText={false} />
          </div>
          <div className="flex flex-1 items-center justify-end gap-3">
            <CompanySwitcher />
            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white shadow-sm shadow-indigo-600/20 ring-2 ring-white transition-shadow hover:ring-indigo-500/20"
                aria-label="User menu"
                aria-expanded={menuOpen}
              >
                {user ? initials(user.name) : '?'}
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} aria-hidden />
                  <div className="absolute right-0 z-20 mt-2 w-52 animate-scale-in overflow-hidden rounded-xl border border-slate-200/70 bg-white/95 py-1 shadow-dropdown ring-1 ring-slate-200/50 backdrop-blur-xl">
                    <div className="border-b border-slate-100 px-3.5 py-2.5">
                      <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
                      <p className="truncate text-xs text-slate-500">{user?.email}</p>
                    </div>
                    <div className="p-1">
                      <Link
                        to="/profile"
                        onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-100"
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
                      >
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <main id="main-content" className="flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}