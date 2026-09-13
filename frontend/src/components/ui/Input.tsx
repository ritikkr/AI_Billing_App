import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
}

const fieldBase =
  'block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500';

function Wrapper({ label, error, hint, required, children }: FieldWrapperProps & { children: React.ReactNode }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-xs font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & FieldWrapperProps;

export const Input = forwardRef<HTMLInputElement, InputProps>(({ label, error, hint, required, className, ...rest }, ref) => (
  <Wrapper label={label} error={error} hint={hint} required={required}>
    <input ref={ref} className={clsx(fieldBase, error && 'border-red-400 focus:border-red-500 focus:ring-red-500', className)} {...rest} />
  </Wrapper>
));
Input.displayName = 'Input';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldWrapperProps;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ label, error, hint, required, className, ...rest }, ref) => (
  <Wrapper label={label} error={error} hint={hint} required={required}>
    <textarea ref={ref} className={clsx(fieldBase, error && 'border-red-400', className)} {...rest} />
  </Wrapper>
));
Textarea.displayName = 'Textarea';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & FieldWrapperProps;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(({ label, error, hint, required, className, children, ...rest }, ref) => (
  <Wrapper label={label} error={error} hint={hint} required={required}>
    <select ref={ref} className={clsx(fieldBase, 'pr-8', error && 'border-red-400', className)} {...rest}>
      {children}
    </select>
  </Wrapper>
));
Select.displayName = 'Select';
