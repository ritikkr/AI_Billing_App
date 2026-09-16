import type { QuotationDetail, DocumentDesign } from '../../types';
import { amountInWords } from '../../utils/gst';
import { formatCurrency, formatDate } from '../../utils/format';

export function QuotationPrintView({ quotation, design = 'classic' }: { quotation: QuotationDetail; design?: DocumentDesign }) {
  if (design === 'modern') return <ModernQuotation quotation={quotation} />;
  if (design === 'minimal') return <MinimalQuotation quotation={quotation} />;
  return <ClassicQuotation quotation={quotation} />;
}

function companyAddress(company: any) {
  return [company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ');
}

function customerAddress(customer: any) {
  return [customer.billing_address, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ');
}

function lineTax(item: { cgstAmount?: number; sgstAmount?: number; igstAmount?: number }) {
  return (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0);
}

function ClassicQuotation({ quotation }: { quotation: QuotationDetail }) {
  const company = quotation.company || {};
  const customer = quotation.customer || {};
  return (
    <div className="px-8 pb-8 pt-10 text-[13px] leading-snug text-slate-800">
      <div className="flex items-start justify-between">
        <div className="max-w-[55%]">
          {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mb-2 h-12 w-auto max-w-[150px] rounded object-contain" />}
          <h1 className="text-xl font-bold text-slate-900">{company.name}</h1>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{companyAddress(company)}</p>
          {company.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
          {company.phone && <p className="text-xs text-slate-500">Phone: {company.phone}</p>}
          {company.email && <p className="text-xs text-slate-500">Email: {company.email}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-teal-700">QUOTATION</h2>
          <p className="mt-1 text-xs text-slate-500">Quotation #: {quotation.quotationNumber}</p>
          <p className="text-xs text-slate-500">Date: {formatDate(quotation.quotationDate)}</p>
          {quotation.validUntil && <p className="text-xs text-slate-500">Valid Until: {formatDate(quotation.validUntil)}</p>}
        </div>
      </div>

      <hr className="my-5 border-slate-200" />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Prepared For</p>
          <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 text-xs text-slate-500">{customerAddress(customer)}</p>
          {customer.gstin && <p className="text-xs text-slate-500">GSTIN: {customer.gstin}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Place of Supply</p>
          <p className="mt-1 text-xs text-slate-500">
            {quotation.placeOfSupplyStateCode} ({quotation.isInterstate ? 'Inter-state' : 'Intra-state'})
          </p>
        </div>
      </div>

      <LineItemsTable quotation={quotation} tableClass="classic" />
      <TotalsBlock quotation={quotation} totalsClass="classic" />

      <p className="mt-3 text-xs text-slate-600">Amount in words: {amountInWords(quotation.grandTotal)}</p>

      {(quotation.notes || quotation.terms) && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          {quotation.notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
              <p>{quotation.notes}</p>
            </div>
          )}
          {quotation.terms && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Terms & Conditions</p>
              <p>{quotation.terms}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-10 text-right">
        <p className="text-xs text-slate-500">For {company.name}</p>
        {company.signature_url && <img src={company.signature_url} alt="Authorized signatory signature" className="ml-auto mt-3 h-11 w-auto max-w-[140px] object-contain" />}
        <p className={`text-xs text-slate-500 ${company.signature_url ? 'mt-2' : 'mt-8'}`}>Authorized Signatory</p>
      </div>
    </div>
  );
}

function ModernQuotation({ quotation }: { quotation: QuotationDetail }) {
  const company = quotation.company || {};
  const customer = quotation.customer || {};
  return (
    <div className="text-[13px] leading-snug text-slate-800">
      <div className="rounded-t-xl bg-teal-700 px-8 py-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mb-2 h-12 w-auto max-w-[150px] rounded object-contain" />}
            <h1 className="text-xl font-bold">{company.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-teal-100">{companyAddress(company)}</p>
            {company.gstin && <p className="text-xs text-teal-100">GSTIN: {company.gstin}</p>}
            {company.phone && <p className="text-xs text-teal-100">Phone: {company.phone}</p>}
            {company.email && <p className="text-xs text-teal-100">Email: {company.email}</p>}
          </div>
          <div className="text-right">
            <h2 className="rounded-md bg-teal-600 px-3 py-1 text-2xl font-bold">QUOTATION</h2>
            <p className="mt-1 text-xs text-teal-100">Quotation #: {quotation.quotationNumber}</p>
            <p className="text-xs text-teal-100">Date: {formatDate(quotation.quotationDate)}</p>
            {quotation.validUntil && <p className="text-xs text-teal-100">Valid Until: {formatDate(quotation.validUntil)}</p>}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Prepared For</p>
            <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
            <p className="mt-1 text-xs text-slate-500">{customerAddress(customer)}</p>
            {customer.gstin && <p className="text-xs text-slate-500">GSTIN: {customer.gstin}</p>}
          </div>
          <div className="rounded-lg border border-teal-100 bg-teal-50/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Place of Supply</p>
            <p className="mt-1 text-xs text-slate-500">
              {quotation.placeOfSupplyStateCode} ({quotation.isInterstate ? 'Inter-state' : 'Intra-state'})
            </p>
          </div>
        </div>

        <LineItemsTable quotation={quotation} tableClass="modern" />
        <TotalsBlock quotation={quotation} totalsClass="modern" />

        <p className="mt-3 text-xs text-slate-600">Amount in words: {amountInWords(quotation.grandTotal)}</p>

        {(quotation.notes || quotation.terms) && (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
            {quotation.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Notes</p>
                <p>{quotation.notes}</p>
              </div>
            )}
            {quotation.terms && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-teal-600">Terms & Conditions</p>
                <p>{quotation.terms}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-10 text-right">
          <p className="text-xs text-slate-500">For {company.name}</p>
          {company.signature_url && <img src={company.signature_url} alt="Authorized signatory signature" className="ml-auto mt-3 h-11 w-auto max-w-[140px] object-contain" />}
          <p className={`text-xs text-slate-500 ${company.signature_url ? 'mt-2' : 'mt-8'}`}>Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

function MinimalQuotation({ quotation }: { quotation: QuotationDetail }) {
  const company = quotation.company || {};
  const customer = quotation.customer || {};
  return (
    <div className="px-10 pb-8 pt-12 text-[13px] leading-snug text-slate-900">
      <div className="text-center">
        {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mx-auto mb-2 h-12 w-auto max-w-[160px] rounded object-contain" />}
        <h1 className="text-xl font-bold tracking-tight uppercase">{company.name}</h1>
        <p className="mt-1 text-xs text-slate-500">{companyAddress(company)}</p>
        {company.gstin && <p className="text-xs text-slate-500">GSTIN: {company.gstin}</p>}
        {company.phone && <p className="text-xs text-slate-500">Phone: {company.phone}</p>}
        {company.email && <p className="text-xs text-slate-500">Email: {company.email}</p>}
        <div className="mx-auto mt-4 border-t border-slate-300 pt-3">
          <h2 className="text-lg font-bold tracking-widest uppercase">Quotation</h2>
        </div>
      </div>

      <div className="mt-6 flex justify-between border-b border-slate-300 pb-3 text-xs text-slate-500">
        <div>
          <p>Quotation #: <span className="font-semibold text-slate-900">{quotation.quotationNumber}</span></p>
          <p>Date: {formatDate(quotation.quotationDate)}</p>
          {quotation.validUntil && <p>Valid Until: {formatDate(quotation.validUntil)}</p>}
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-900">{customer.name}</p>
          <p>{customerAddress(customer)}</p>
          {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
          <p className="mt-1">Place of Supply: {quotation.placeOfSupplyStateCode}</p>
        </div>
      </div>

      <LineItemsTable quotation={quotation} tableClass="minimal" />
      <TotalsBlock quotation={quotation} totalsClass="minimal" />

      <p className="mt-4 text-xs text-slate-600">Amount in words: {amountInWords(quotation.grandTotal)}</p>

      {(quotation.notes || quotation.terms) && (
        <div className="mt-6 space-y-3 border-t border-slate-300 pt-3 text-xs text-slate-600">
          {quotation.notes && (
            <div>
              <p className="font-medium uppercase tracking-wider text-slate-400">Notes</p>
              <p>{quotation.notes}</p>
            </div>
          )}
          {quotation.terms && (
            <div>
              <p className="font-medium uppercase tracking-wider text-slate-400">Terms & Conditions</p>
              <p>{quotation.terms}</p>
            </div>
          )}
        </div>
      )}

      <div className="mt-12 text-center">
        <p className="text-xs text-slate-500">For {company.name}</p>
        {company.signature_url && <img src={company.signature_url} alt="Authorized signatory signature" className="mx-auto mt-3 h-11 w-auto max-w-[140px] object-contain" />}
        <p className={`text-xs text-slate-500 ${company.signature_url ? 'mt-2' : 'mt-10'}`}>Authorized Signatory</p>
      </div>
    </div>
  );
}

function LineItemsTable({ quotation, tableClass }: { quotation: QuotationDetail; tableClass: 'classic' | 'modern' | 'minimal' }) {
  const headClass =
    tableClass === 'minimal'
      ? 'border-y border-slate-300 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500'
      : tableClass === 'modern'
        ? 'bg-teal-50 text-[10px] font-semibold uppercase tracking-wider text-teal-700'
        : 'bg-teal-50 text-[10px] font-semibold uppercase tracking-wider text-teal-800';
  const rowClass = tableClass === 'minimal' ? 'border-b border-slate-200' : 'border-b border-slate-100';

  return (
    <table className="mt-6 w-full text-left">
      <thead>
        <tr className={headClass}>
          <th className="px-2 py-2">#</th>
          <th className="px-2 py-2">Description</th>
          <th className="px-2 py-2">HSN/SAC</th>
          <th className="px-2 py-2 text-right">Qty</th>
          <th className="px-2 py-2 text-right">Rate</th>
          <th className="px-2 py-2 text-right">Taxable</th>
          <th className="px-2 py-2 text-right">Tax</th>
          <th className="px-2 py-2 text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {quotation.lineItems.map((item, idx) => (
          <tr key={item.id || idx} className={rowClass}>
            <td className="px-2 py-2 text-slate-500">{idx + 1}</td>
            <td className="px-2 py-2 font-medium text-slate-800">{item.description}</td>
            <td className="px-2 py-2 text-slate-500">{item.hsnSacCode || '-'}</td>
            <td className="px-2 py-2 text-right text-slate-600">
              {item.qty} {item.unit}
            </td>
            <td className="px-2 py-2 text-right text-slate-600">{formatCurrency(item.rate)}</td>
            <td className="px-2 py-2 text-right text-slate-600">{formatCurrency(item.taxableValue)}</td>
            <td className="px-2 py-2 text-right text-slate-600">
              {formatCurrency(lineTax(item))}
              <span className="ml-1 text-xs text-slate-400">({item.gstRate}%)</span>
            </td>
            <td className="px-2 py-2 text-right font-medium text-slate-900">{formatCurrency(item.lineTotal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TotalsBlock({ quotation, totalsClass }: { quotation: QuotationDetail; totalsClass: 'classic' | 'modern' | 'minimal' }) {
  const rows: Array<{ label: string; value: number; bold?: boolean }> = [
    { label: 'Subtotal', value: quotation.subtotal },
    ...(quotation.totalDiscount > 0 ? [{ label: 'Discount', value: -quotation.totalDiscount }] : []),
    { label: 'Taxable Value', value: quotation.taxableValue },
    ...(quotation.isInterstate
      ? [{ label: 'IGST', value: quotation.totalIgst }]
      : [
          { label: 'CGST', value: quotation.totalCgst },
          { label: 'SGST', value: quotation.totalSgst },
        ]),
    ...(quotation.roundOff !== 0 ? [{ label: 'Round Off', value: quotation.roundOff }] : []),
    { label: 'Grand Total', value: quotation.grandTotal, bold: true },
  ];

  const wrapClass =
    totalsClass === 'minimal'
      ? 'ml-auto mt-5 w-64 border-t border-slate-300'
      : totalsClass === 'modern'
        ? 'ml-auto mt-5 w-64'
        : 'ml-auto mt-5 w-64 border-t border-slate-200';

  return (
    <div className={wrapClass}>
      {rows.map((row) =>
        row.bold ? (
          <div
            key={row.label}
            className={`mt-1 flex justify-between px-2 py-2 font-bold ${
              totalsClass === 'modern' ? 'rounded-md bg-teal-700 text-white' : 'text-slate-900'
            }`}
          >
            <span>{row.label}</span>
            <span>{formatCurrency(row.value)}</span>
          </div>
        ) : (
          <div
            key={row.label}
            className={`flex justify-between py-1 text-slate-600 ${totalsClass === 'minimal' ? 'border-b border-slate-100' : ''}`}
          >
            <span>{row.label}</span>
            <span>{formatCurrency(row.value)}</span>
          </div>
        )
      )}
    </div>
  );
}