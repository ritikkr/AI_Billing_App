import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCompany } from '../../context/CompanyContext';
import { initials } from '../../utils/format';
import clsx from 'clsx';

export function CompanySwitcher() {
  const { memberships } = useAuth();
  const { companyId, companyName, setCompanyId } = useCompany();
  const [open, setOpen] = useState(false);

  if (memberships.length === 0) {
    return (
      <Link to="/companies/new" className="text-sm font-medium text-indigo-600 transition-colors hover:text-indigo-700">
        + Create your company
      </Link>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-xs transition duration-150 hover:border-slate-300 hover:bg-slate-50"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-semibold text-white">
          {companyName ? initials(companyName) : '?'}
        </span>
        <span className="max-w-[160px] truncate">{companyName || 'Select company'}</span>
        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.293l3.71-4.06a.75.75 0 111.08 1.04l-4.25 4.65a.75.75 0 01-1.08 0l-4.25-4.65a.75.75 0 01.02-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} aria-hidden />
          <div role="listbox" aria-label="Switch company" className="absolute right-0 z-20 mt-2 w-64 animate-scale-in overflow-hidden rounded-xl border border-slate-200/70 bg-white/95 py-1 shadow-dropdown ring-1 ring-slate-200/50 backdrop-blur-xl">
            {memberships.map((m) => (
              <button
                key={m.companyId}
                onClick={() => {
                  setCompanyId(m.companyId);
                  setOpen(false);
                  window.location.href = '/';
                }}
                className={clsx(
                  'flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors hover:bg-slate-100',
                  m.companyId === companyId ? 'bg-indigo-50/80 text-indigo-700' : 'text-slate-700'
                )}
              >
                <span className="truncate">{m.companyName}</span>
                <span className="ml-2 shrink-0 text-xs capitalize text-slate-400">{m.role}</span>
              </button>
            ))}
            <div className="mt-1 border-t border-slate-100 p-1">
              <Link to="/companies/new" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-indigo-600 transition-colors hover:bg-indigo-50">
                + Add another company
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}