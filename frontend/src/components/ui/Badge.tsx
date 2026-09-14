import clsx from 'clsx';
import { statusLabel } from '../../utils/format';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100/80 text-slate-600 ring-slate-500/10',
  sent: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  partially_paid: 'bg-amber-50 text-amber-700 ring-amber-600/10',
  paid: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  overdue: 'bg-red-50 text-red-700 ring-red-600/10',
  cancelled: 'bg-slate-100/80 text-slate-400 ring-slate-400/10 line-through',
  issued: 'bg-emerald-50 text-emerald-700 ring-emerald-600/10',
  admin: 'bg-indigo-50 text-indigo-700 ring-indigo-600/10',
  accountant: 'bg-blue-50 text-blue-700 ring-blue-600/10',
  viewer: 'bg-slate-100/80 text-slate-600 ring-slate-500/10',
};

const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset';

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx(base, 'capitalize', STATUS_STYLES[status] || 'bg-slate-100/80 text-slate-600 ring-slate-500/10')}>
      {statusLabel(status)}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx(base, 'bg-slate-100/80 text-slate-700 ring-slate-500/10', className)}>
      {children}
    </span>
  );
}