import clsx from 'clsx';
import { statusLabel } from '../../utils/format';

const STATUS_STYLES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  sent: 'bg-blue-50 text-blue-700',
  partially_paid: 'bg-amber-50 text-amber-700',
  paid: 'bg-emerald-50 text-emerald-700',
  overdue: 'bg-red-50 text-red-700',
  cancelled: 'bg-slate-100 text-slate-400 line-through',
  issued: 'bg-emerald-50 text-emerald-700',
  admin: 'bg-indigo-50 text-indigo-700',
  accountant: 'bg-blue-50 text-blue-700',
  viewer: 'bg-slate-100 text-slate-600',
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize', STATUS_STYLES[status] || 'bg-slate-100 text-slate-600')}>
      {statusLabel(status)}
    </span>
  );
}

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={clsx('inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700', className)}>
      {children}
    </span>
  );
}
