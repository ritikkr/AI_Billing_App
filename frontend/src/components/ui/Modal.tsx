import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  widthClass?: string;
}) {
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16 sm:pt-24">
      <div className={`w-full ${widthClass} rounded-xl bg-white shadow-xl`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
