import { useEffect } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PDFDownloadLink } from '@react-pdf/renderer';
import clsx from 'clsx';
import { getInvoice } from '../../api/invoices';
import { getQuotation } from '../../api/quotations';
import { getCertificate } from '../../api/certificates';
import { getPreferences } from '../../api/preferences';
import { getActiveCompanyId } from '../../api/client';
import { InvoicePrintView } from '../../components/print/InvoicePrintView';
import { InvoicePdf } from '../../pdf/InvoicePdf';
import { QuotationPrintView } from '../../components/print/QuotationPrintView';
import { QuotationPdf } from '../../pdf/QuotationPdf';
import { CertificatePrintView } from '../../components/print/CertificatePrintView';
import { CertificatePdf } from '../../pdf/CertificatePdf';
import { PageLoader } from '../../components/ui/Spinner';
import { Button } from '../../components/ui/Button';
import { DOCUMENT_DESIGNS, designLabel } from '../../utils/designs';
import type { DocumentDesign } from '../../types';

const isDesign = (v: string | null): v is DocumentDesign =>
  v === 'classic' || v === 'modern' || v === 'minimal';

export default function ServeDocument() {
  const { doc, id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const companyId = getActiveCompanyId();

  const { data: invoice, isLoading: invoiceLoading } = useQuery({
    queryKey: ['invoice', companyId, id],
    queryFn: () => getInvoice(companyId!, id!),
    enabled: !!companyId && !!id && doc === 'invoice',
  });

  const { data: quotation, isLoading: quotationLoading } = useQuery({
    queryKey: ['quotation', companyId, id],
    queryFn: () => getQuotation(companyId!, id!),
    enabled: !!companyId && !!id && doc === 'quotation',
  });

  const { data: certificate, isLoading: certificateLoading } = useQuery({
    queryKey: ['certificate', companyId, id],
    queryFn: () => getCertificate(companyId!, id!),
    enabled: !!companyId && !!id && doc === 'certificate',
  });

  const { data: preferences } = useQuery({
    queryKey: ['preferences', companyId],
    queryFn: () => getPreferences(companyId!),
    enabled: !!companyId,
  });

  const urlDesign = searchParams.get('design');
  const design: DocumentDesign = isDesign(urlDesign)
    ? urlDesign
    : (preferences?.printDesign ?? 'classic');

  useEffect(() => {
    if (searchParams.get('auto') === '1') {
      const timer = window.setTimeout(() => window.print(), 300);
      return () => window.clearTimeout(timer);
    }
  }, [searchParams]);

  if (doc !== 'invoice' && doc !== 'quotation' && doc !== 'certificate') {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Unknown document type. <Link to="/invoices" className="font-medium text-indigo-600">Back to invoices</Link>
      </div>
    );
  }

  const loading = invoiceLoading || quotationLoading || certificateLoading;
  if (loading || (!invoice && !quotation && !certificate)) return <PageLoader />;

  const setDesign = (d: DocumentDesign) => {
    const next = new URLSearchParams(searchParams);
    next.set('design', d);
    next.delete('auto');
    setSearchParams(next, { replace: true });
  };

  const header = (() => {
    if (doc === 'invoice' && invoice) {
      const fileBase = invoice.invoiceNumber.replace(/\//g, '-');
      return (
        <>
          <span className="truncate text-sm text-slate-700">
            {invoice.invoiceNumber} · <span className="text-slate-400">Print: {designLabel(design)}</span>
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {DOCUMENT_DESIGNS.map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={design === d.value}
                onClick={() => setDesign(d.value)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition duration-150',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0',
                  design === d.value
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <PDFDownloadLink
            document={<InvoicePdf invoice={invoice} design={design} />}
            fileName={`${fileBase}.pdf`}
            className="no-underline inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Preparing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </span>
              )
            }
          </PDFDownloadLink>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </>
      );
    }
    if (doc === 'quotation' && quotation) {
      const fileBase = quotation.quotationNumber.replace(/\//g, '-');
      return (
        <>
          <span className="truncate text-sm text-slate-700">
            {quotation.quotationNumber} · <span className="text-slate-400">Print: {designLabel(design)}</span>
          </span>
          <div className="flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5">
            {DOCUMENT_DESIGNS.filter((d) => d.value !== 'vyapar').map((d) => (
              <button
                key={d.value}
                type="button"
                aria-pressed={design === d.value}
                onClick={() => setDesign(d.value)}
                className={clsx(
                  'rounded-md px-2.5 py-1 text-xs font-medium transition duration-150',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0',
                  design === d.value
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-slate-200/80'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
          <PDFDownloadLink
            document={<QuotationPdf quotation={quotation} design={design} />}
            fileName={`${fileBase}.pdf`}
            className="no-underline inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Preparing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </span>
              )
            }
          </PDFDownloadLink>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </>
      );
    }
    if (doc === 'certificate' && certificate) {
      const fileBase = certificate.certificateNumber.replace(/\//g, '-');
      return (
        <>
          <span className="truncate text-sm text-slate-700">
            {certificate.certificateNumber} · <span className="text-slate-400">Print</span>
          </span>
          <PDFDownloadLink
            document={<CertificatePdf certificate={certificate} />}
            fileName={`${fileBase}.pdf`}
            className="no-underline inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 shadow-xs transition duration-150 ease-out hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {({ loading: pdfLoading }) =>
              pdfLoading ? (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                  </svg>
                  Preparing…
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download PDF
                </span>
              )
            }
          </PDFDownloadLink>
          <Button size="sm" onClick={() => window.print()}>
            Print
          </Button>
        </>
      );
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-slate-200/70 print:bg-white">
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white/90 px-4 py-3 shadow-sm backdrop-blur print:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to={doc === 'invoice' ? `/invoices/${invoice?.id}` : doc === 'quotation' ? `/quotations/${quotation?.id}` : `/certificates/${certificate?.id}`}
            className="shrink-0 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            ← Back
          </Link>
          <span className="hidden text-sm text-slate-300 sm:inline">|</span>
          {header}
        </div>
      </div>

      <div className="flex justify-center p-4 print:p-0">
        <div className="w-full max-w-[210mm] overflow-hidden rounded-lg bg-white shadow-xl print:max-w-none print:rounded-none print:shadow-none">
          {doc === 'invoice' && invoice && <InvoicePrintView invoice={invoice} design={design} />}
          {doc === 'quotation' && quotation && <QuotationPrintView quotation={quotation} design={design} />}
          {doc === 'certificate' && certificate && <CertificatePrintView certificate={certificate} />}
        </div>
      </div>
    </div>
  );
}