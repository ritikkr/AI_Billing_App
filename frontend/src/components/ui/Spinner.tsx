export function Spinner({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={`animate-spin text-indigo-600 ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function PageLoader() {
  return (
    <div className="flex h-64 w-full items-center justify-center" role="status" aria-label="Loading">
      <Spinner className="h-8 w-8" />
    </div>
  );
}
