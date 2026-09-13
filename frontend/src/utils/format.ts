export function formatCurrency(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(amount: number | null | undefined): string {
  const value = amount ?? 0;
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  sent: 'Sent',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
  issued: 'Issued',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] || status;
}

export function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}
