import type { DocumentDesign } from '../types';

export interface DesignMeta {
  value: DocumentDesign;
  label: string;
  description: string;
}

export const DOCUMENT_DESIGNS: DesignMeta[] = [
  { value: 'classic', label: 'Classic', description: 'Traditional GST tax-invoice layout with a balanced two-column header.' },
  { value: 'modern', label: 'Modern', description: 'Bold indigo header band and an accent-callout grand total.' },
  { value: 'minimal', label: 'Minimal', description: 'Clean, monochrome, lightweight layout with plenty of whitespace.' },
  { value: 'vyapar', label: 'Vyapar', description: 'Boxed, monochrome Optima-style layout with a compact items & tax table.' },
];

export function designLabel(value: DocumentDesign | undefined) {
  return DOCUMENT_DESIGNS.find((d) => d.value === value)?.label ?? 'Classic';
}