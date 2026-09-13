import clsx from 'clsx';

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onChange: (page: number) => void;
}

function pageList(current: number, count: number): (number | '…')[] {
  if (count <= 7) {
    return Array.from({ length: count }, (_, i) => i + 1);
  }
  const pages: (number | '…')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(count - 1, current + 1);
  if (start > 2) pages.push('…');
  for (let p = start; p <= end; p++) pages.push(p);
  if (end < count - 1) pages.push('…');
  pages.push(count);
  return pages;
}

export function Pagination({ page, pageCount, total, pageSize, onChange }: PaginationProps) {
  if (pageCount <= 1) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
      <p className="text-sm text-slate-500">
        Showing <span className="font-medium text-slate-700">{from}</span>–<span className="font-medium text-slate-700">{to}</span> of{' '}
        <span className="font-medium text-slate-700">{total}</span>
      </p>
      <nav className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ‹ Prev
        </button>
        {pageList(page, pageCount).map((p, idx) =>
          p === '…' ? (
            <span key={`e${idx}`} className="px-1.5 text-sm text-slate-400">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={clsx(
                'rounded-md px-2.5 py-1.5 text-sm',
                p === page ? 'bg-indigo-600 font-medium text-white' : 'text-slate-600 hover:bg-slate-50'
              )}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onChange(page + 1)}
          className="rounded-md border border-slate-200 px-2.5 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next ›
        </button>
      </nav>
    </div>
  );
}