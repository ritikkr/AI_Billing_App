import clsx from 'clsx';

const markSizes = {
  sm: 'h-7 w-7 rounded-lg text-xs',
  md: 'h-9 w-9 rounded-xl text-sm',
  lg: 'h-12 w-12 rounded-2xl text-lg',
} as const;

const textSizes = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
} as const;

export function Logo({
  size = 'md',
  withText = true,
  className,
}: {
  size?: keyof typeof markSizes;
  withText?: boolean;
  className?: string;
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2.5 select-none', className)}>
      <span
        className={clsx(
          'relative inline-flex items-center justify-center bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 font-bold text-white shadow-glow',
          markSizes[size]
        )}
        aria-hidden
      >
        <span className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
        <span className="relative translate-y-[0.5px]">₹</span>
      </span>
      {withText && (
        <span className={clsx('font-semibold tracking-tight text-slate-900', textSizes[size])}>
          Bill<span className="text-indigo-600">GST</span>
        </span>
      )}
    </span>
  );
}