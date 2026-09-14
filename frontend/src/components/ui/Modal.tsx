import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  icon,
  headerActions,
  children,
  widthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  headerActions?: ReactNode;
  children: ReactNode;
  widthClass?: string;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-900/40 p-4 pt-12 backdrop-blur-[2px] sm:pt-20">
      <div className="absolute inset-0" onClick={onClose} aria-hidden tabIndex={-1} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${widthClass} animate-scale-in overflow-hidden rounded-2xl bg-white shadow-modal`}
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {icon && (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                {icon}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="truncate text-base font-semibold tracking-tight text-slate-900">{title}</h3>
              {subtitle && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-2">
            {headerActions && <div className="flex flex-wrap items-center justify-end gap-2">{headerActions}</div>}
            <button
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close dialog"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="max-h-[75vh] touch-pan-y overscroll-contain overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>,
    document.body
  );
}