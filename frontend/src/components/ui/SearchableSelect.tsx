import { useMemo, useState } from 'react';
import clsx from 'clsx';

export interface SearchableOption {
  value: string;
  label: string;
  searchText?: string;
  hint?: string;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  className?: string;
}

export function SearchableSelect({
  label,
  required,
  hint,
  error,
  placeholder = 'Search…',
  value,
  onChange,
  options,
  className,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.searchText || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  function select(option: SearchableOption) {
    onChange(option.value);
    setQuery('');
    setOpen(false);
  }

  function clear() {
    onChange('');
    setQuery('');
    setOpen(false);
  }

  return (
    <div className={clsx('block', className)}>
      {label && (
        <span className="mb-1 block text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      <div className="relative">
        <div
          className={clsx(
            'flex items-center rounded-lg border border-slate-300 bg-white px-3 py-2 focus-within:border-indigo-500 focus-within:outline-none focus-within:ring-1 focus-within:ring-indigo-500',
            error && 'border-red-400'
          )}
        >
          <input
            type="text"
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={selected && !open ? selected.label : placeholder}
            value={open ? query : ''}
            onFocus={() => {
              setQuery('');
              setOpen(true);
              setHighlighted(0);
            }}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setHighlighted(0);
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                setOpen(true);
                setHighlighted(0);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlighted((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const opt = filtered[Math.min(highlighted, filtered.length - 1)];
                if (opt) select(opt);
              } else if (e.key === 'Escape') {
                setOpen(false);
              }
            }}
          />
          {value ? (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={clear}
              className="ml-2 text-slate-400 hover:text-slate-600"
              aria-label="Clear selection"
            >
              ✕
            </button>
          ) : (
            <span className="ml-2 text-slate-400" aria-hidden>
              ⌄
            </span>
          )}
        </div>
        {open && (
          <ul
            className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
          >
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-slate-400">No customers found</li>
            )}
            {filtered.map((option, idx) => (
              <li
                key={option.value}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(option)}
                onMouseEnter={() => setHighlighted(idx)}
                className={clsx(
                  'cursor-pointer px-3 py-2 text-sm',
                  idx === highlighted ? 'bg-indigo-50' : ''
                )}
              >
                <div className="font-medium text-slate-900">{option.label}</div>
                {option.hint && <div className="text-xs text-slate-500">{option.hint}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}