import { useMemo, useState } from 'react';
import clsx from 'clsx';

export interface SearchableOption {
  value: string;
  label: string;
  searchText?: string;
  hint?: string;
  isCreate?: boolean;
}

interface SearchableSelectProps {
  label?: string;
  required?: boolean;
  hint?: string;
  error?: string;
  placeholder?: string;
  emptyMessage?: string;
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  className?: string;
  freeText?: boolean;
}

export function SearchableSelect({
  label,
  required,
  hint,
  error,
  placeholder = 'Search…',
  emptyMessage = 'No results found',
  value,
  onChange,
  options,
  className,
  freeText = false,
}: SearchableSelectProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const selected = options.find((o) => o.value === value);
  // When closed, free-text mode shows the resolved label if the selected value
  // matches an option (otherwise the raw typed string). Non free-text shows
  // nothing and relies on a placeholder label.
  const displayValue = freeText ? (selected ? selected.label : value) : '';
  const inputValue = open ? query : displayValue;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        (o.searchText || '').toLowerCase().includes(q)
    );
  }, [options, query]);

  // In free-text mode, offer to create a new value when the typed text doesn't
  // exactly match an existing option.
  const showCreate =
    freeText &&
    query.trim().length > 0 &&
    !options.some((o) => o.value.toLowerCase() === query.trim().toLowerCase());

  const list = useMemo(() => {
    if (!showCreate) return filtered;
    return [{ value: query.trim(), label: `Add "${query.trim()}"`, isCreate: true as const }, ...filtered];
  }, [showCreate, query, filtered]);

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
        <span className="mb-1.5 block text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      <div className="relative">
        <div
          className={clsx(
            'flex items-center rounded-lg border border-slate-200 bg-white px-3 py-2 transition duration-150 hover:border-slate-300 focus-within:border-indigo-500 focus-within:outline-none focus-within:ring-4 focus-within:ring-indigo-500/15',
            error && 'border-red-400'
          )}
        >
          <input
            type="text"
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            aria-controls={open ? 'searchable-select-list' : undefined}
            aria-activedescendant={open ? `searchable-select-option-${highlighted}` : undefined}
            autoComplete="off"
            inputMode="text"
            enterKeyHint="done"
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            placeholder={!freeText && selected && !open ? selected.label : placeholder}
            value={inputValue}
            onFocus={() => {
              setQuery(freeText ? (selected ? selected.label : value) : '');
              setOpen(true);
              setHighlighted(0);
            }}
            onBlur={() => setOpen(false)}
            onChange={(e) => {
              const text = e.target.value;
              setQuery(text);
              setOpen(true);
              setHighlighted(0);
              if (freeText) onChange(text);
            }}
            onKeyDown={(e) => {
              if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
                setOpen(true);
                setHighlighted(0);
                return;
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setHighlighted((h) => Math.min(h + 1, list.length - 1));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setHighlighted((h) => Math.max(h - 1, 0));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                const opt = list[Math.min(highlighted, list.length - 1)];
                if (opt) select(opt);
                else setOpen(false);
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
        {open && list.length > 0 && (
          <ul id="searchable-select-list" role="listbox" className="absolute z-10 mt-1.5 max-h-60 w-full animate-scale-in overflow-auto rounded-xl border border-slate-200/70 bg-white py-1 shadow-dropdown">
            {list.map((option, idx) => (
              <li
                key={`${option.value}-${idx}`}
                id={`searchable-select-option-${idx}`}
                role="option"
                aria-selected={idx === highlighted}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(option)}
                onMouseEnter={() => setHighlighted(idx)}
                className={clsx('cursor-pointer px-3 py-2 text-sm', idx === highlighted ? 'bg-indigo-50/70' : '')}
              >
                {option.isCreate ? (
                  <div className="font-medium text-indigo-600">+ {option.label}</div>
                ) : (
                  <>
                    <div className="font-medium text-slate-900">{option.label}</div>
                    {option.hint && <div className="text-xs text-slate-500">{option.hint}</div>}
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {open && list.length === 0 && (
          <div className="absolute z-10 mt-1.5 w-full animate-scale-in rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-sm text-slate-400 shadow-dropdown">
            {emptyMessage}
          </div>
        )}
      </div>
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </div>
  );
}