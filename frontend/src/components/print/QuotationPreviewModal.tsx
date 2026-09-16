import { useEffect, useMemo, useRef, useState } from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import clsx from 'clsx';
import type { QuotationDetail, DocumentDesign } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { DesignThumbnail } from '../ui/DesignThumbnail';
import { QuotationPrintView } from './QuotationPrintView';
import { QuotationPdf } from '../../pdf/QuotationPdf';
import { QUOTATION_DESIGNS, designLabel } from '../../utils/designs';
import { formatCurrency, formatDate } from '../../utils/format';

const PDF_PAGE_WIDTH = 794;

const ZOOM_OPTIONS = [
  { value: 'fit', label: 'Fit width' },
  { value: 0.5, label: '50%' },
  { value: 0.75, label: '75%' },
  { value: 1, label: '100%' },
  { value: 1.25, label: '125%' },
  { value: 1.5, label: '150%' },
];

const PDF_BUTTON_CLASSES = clsx(
  'no-underline inline-flex items-center justify-center gap-1.5 rounded-lg font-medium',
  'bg-white text-slate-700 border border-slate-200 shadow-xs hover:bg-slate-50 hover:border-slate-300',
  'transition duration-150 ease-out active:scale-[0.98]',
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-70',
  'px-3.5 py-2 text-sm'
);

export function QuotationPreviewModal({
  open,
  onClose,
  quotation,
  defaultDesign = 'classic',
}: {
  open: boolean;
  onClose: () => void;
  quotation: QuotationDetail;
  defaultDesign?: DocumentDesign;
}) {
  const [design, setDesign] = useState<DocumentDesign>(defaultDesign === 'vyapar' ? 'classic' : defaultDesign);
  const [fitScale, setFitScale] = useState(1);
  const [sheetHeight, setSheetHeight] = useState(PDF_PAGE_WIDTH * 1.4);
  const [zoom, setZoom] = useState<string | number>('fit');
  const stageRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const scale = zoom === 'fit' ? fitScale : (zoom as number);

  useEffect(() => {
    if (!open) return;
    const stage = stageRef.current;
    if (!stage) return;

    const update = () => {
      setFitScale(Math.min(1, stage.clientWidth / PDF_PAGE_WIDTH));
      if (sheetRef.current) setSheetHeight(sheetRef.current.scrollHeight);
    };

    update();
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [open, design]);

  const fileBase = useMemo(() => quotation.quotationNumber.replace(/\//g, '-'), [quotation.quotationNumber]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      widthClass="max-w-5xl"
      title="Print & download"
      subtitle={`${quotation.quotationNumber} · ${quotation.customer?.name ?? 'Customer'} · ${formatCurrency(quotation.grandTotal)}`}
      icon={
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
          />
        </svg>
      }
    >
      <div className="flex flex-col">
        <div className="sticky top-0 z-10 -mx-5 -mt-5 border-b border-slate-100 bg-white/95 px-5 pb-3 pt-4 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1">
              {QUOTATION_DESIGNS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  aria-pressed={design === d.value}
                  onClick={() => setDesign(d.value)}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition duration-150',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0',
                    design === d.value
                      ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80'
                      : 'text-slate-600 hover:text-slate-900'
                  )}
                >
                  <span className="hidden sm:inline-flex">
                    <DesignThumbnail design={d.value} />
                  </span>
                  <span>{d.label}</span>
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                <span className="sr-only">Preview zoom</span>
                <select
                  value={String(zoom)}
                  onChange={(e) => setZoom(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                >
                  {ZOOM_OPTIONS.map((z) => (
                    <option key={String(z.value)} value={String(z.value)}>
                      {z.label}
                    </option>
                  ))}
                </select>
              </label>
              <PDFDownloadLink
                document={<QuotationPdf quotation={quotation} design={design} />}
                fileName={`${fileBase}.pdf`}
                className={PDF_BUTTON_CLASSES}
              >
                {({ loading }) =>
                  loading ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                      Preparing…
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download PDF
                    </span>
                  )
                }
              </PDFDownloadLink>
              <Button
                size="md"
                onClick={() => window.open(`/serve/quotation/${quotation.id}?design=${design}&auto=1`, '_blank', 'noopener')}
                title={`Print ${designLabel(design)} design`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4H7v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
                  />
                </svg>
                Print
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400" aria-live="polite">
            {designLabel(design)} layout · {formatDate(quotation.quotationDate)} — Print opens the full-page view in a new tab.
          </p>
        </div>

        <div className="-mx-5 -mb-5 overflow-hidden bg-slate-200/60 px-5 py-6">
          <div ref={stageRef} className="flex justify-center overflow-x-auto">
            <div className="relative" style={{ width: PDF_PAGE_WIDTH * scale, height: sheetHeight * scale + 24 }}>
              <div
                ref={sheetRef}
                style={{ width: PDF_PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                className="absolute left-0 top-0 overflow-hidden rounded-md bg-white shadow-xl shadow-slate-400/20"
              >
                <QuotationPrintView quotation={quotation} design={design} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}