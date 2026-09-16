import { useRef } from 'react';
import { Textarea } from '../ui/Input';

export const CERTIFICATE_PLACEHOLDERS: Array<{ key: string; label: string }> = [
  { key: 'company_name', label: 'Company name' },
  { key: 'outlet_name', label: 'Outlet / establishment name' },
  { key: 'outlet_address', label: 'Outlet / establishment address' },
  { key: 'service_date', label: 'Service performed date' },
  { key: 'service_type', label: 'Service type (e.g. Pest Control)' },
  { key: 'valid_from', label: 'Validity start' },
  { key: 'valid_until', label: 'Validity end' },
  { key: 'certificate_date', label: 'Certificate issue date' },
  { key: 'certificate_number', label: 'Certificate number' },
  { key: 'customer_name', label: 'Customer name' },
];

/** Resolves a template body with placeholder values. Missing placeholders stay as-is. */
export function resolveTemplate(body: string, values: Record<string, string | null | undefined>): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const v = values[key];
    return v != null && v !== '' ? v : match;
  });
}

interface TemplateEditorProps {
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  previewValues?: Record<string, string>;
  showPreview?: boolean;
}

export function TemplateEditor({
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  previewValues = {},
  showPreview = false,
}: TemplateEditorProps) {
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  function insertPlaceholder(key: string) {
    const el = bodyRef.current;
    const placeholder = `{{${key}}}`;
    if (!el) {
      onBodyChange(body ? `${body}\n${placeholder}` : placeholder);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = body.slice(0, start) + placeholder + body.slice(end);
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + placeholder.length;
      el.setSelectionRange(pos, pos);
    });
  }

  const previewText = showPreview ? resolveTemplate(body, previewValues) : '';

  return (
    <div className="space-y-4">
      <div>
        <span className="mb-1.5 block text-xs font-medium text-slate-700">Available placeholders</span>
        <div className="flex flex-wrap gap-1.5">
          {CERTIFICATE_PLACEHOLDERS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => insertPlaceholder(p.key)}
              title={p.label}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
            >
              {'{{' + p.key + '}'}
            </button>
          ))}
        </div>
      </div>

      <Textarea label="Subject" rows={1} value={subject} onChange={(e) => onSubjectChange(e.target.value)} placeholder="e.g. Service Completion Certificate" />

      <div>
        <Textarea
          label="Body"
          rows={8}
          value={body}
          onChange={(e) => onBodyChange(e.target.value)}
          placeholder="Write the certificate text. Use the placeholders above to insert dynamic values."
          ref={bodyRef}
        />
        <p className="mt-1 text-xs text-slate-400">
          Placeholders like {'{{outlet_name}}'} are replaced with the actual value when the certificate is generated. Leave them in to make the certificate fill automatically.
        </p>
      </div>

      {showPreview && (
        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">Preview</p>
          <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{previewText}</div>
        </div>
      )}
    </div>
  );
}