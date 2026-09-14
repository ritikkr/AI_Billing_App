import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import { Logo } from '../ui/Logo';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/invoices', label: 'Invoices', icon: InvoiceIcon },
  { to: '/customers', label: 'Customers', icon: CustomerIcon },
  { to: '/items', label: 'Items', icon: ItemIcon },
  { to: '/credit-notes', label: 'Credit / Debit Notes', icon: NoteIcon },
  { to: '/reports', label: 'Reports', icon: ReportIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/70 bg-white/70 backdrop-blur-xl md:flex">
      <div className="flex h-16 items-center px-5">
        <Logo size="sm" />
      </div>
      <NavContent />
      <div className="px-5 py-4 text-xs text-slate-400">India GST-compliant billing</div>
    </aside>
  );
}

export function MobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Navigation menu">
      <div className="absolute inset-0 overscroll-contain bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden />
      <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-modal">
        <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
          <Logo size="sm" />
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close navigation menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-2" onClick={onClose}>
          <NavContent />
        </div>
      </div>
    </div>
  );
}

function NavContent() {
  return (
    <nav className="flex-1 space-y-1 px-3 py-2">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            clsx(
              'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition duration-150',
              isActive
                ? 'bg-white text-indigo-700 shadow-card ring-1 ring-slate-200/70'
                : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={clsx(
                  'absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-gradient-to-b from-indigo-500 to-violet-600 opacity-0 transition-opacity',
                  isActive && 'opacity-100'
                )}
              />
              <item.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function DashboardIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
    </svg>
  );
}
function InvoiceIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V4a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}
function CustomerIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m9-3.13a4 4 0 10-8 0 4 4 0 008 0zm6 3.13V17a4 4 0 00-3-3.87m0-4.13a4 4 0 010 7.75" />
    </svg>
  );
}
function ItemIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  );
}
function NoteIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 8h10M7 12h10M7 16h6M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
    </svg>
  );
}
function ReportIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
    </svg>
  );
}
function SettingsIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}