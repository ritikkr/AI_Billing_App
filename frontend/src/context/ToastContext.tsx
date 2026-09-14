import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import clsx from 'clsx';

interface Toast {
  id: number;
  message: string;
  variant: 'success' | 'error' | 'info';
}

interface ToastContextValue {
  notify: (message: string, variant?: Toast['variant']) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

let idCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, variant: Toast['variant'] = 'success') => {
    const id = ++idCounter;
    setToasts((t) => [...t, { id, message, variant }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="alert"
            className={clsx(
              'pointer-events-auto min-w-[260px] max-w-sm animate-slide-in rounded-xl px-4 py-3 text-sm font-medium shadow-modal ring-1 ring-white/10',
              t.variant === 'success' && 'bg-emerald-600 text-white',
              t.variant === 'error' && 'bg-red-600 text-white',
              t.variant === 'info' && 'bg-slate-800 text-white'
            )}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
