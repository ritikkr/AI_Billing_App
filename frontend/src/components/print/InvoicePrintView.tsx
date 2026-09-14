import type { InvoiceDetail, DocumentDesign } from '../../types';
import { amountInWords } from '../../utils/gst';
import { formatCurrency, formatDate } from '../../utils/format';

export function InvoicePrintView({ invoice, design = 'classic' }: { invoice: InvoiceDetail; design?: DocumentDesign }) {
  if (design === 'modern') return <ModernInvoice invoice={invoice} />;
  if (design === 'minimal') return <MinimalInvoice invoice={invoice} />;
  if (design === 'vyapar') return <VyaparInvoice invoice={invoice} />;
  return <ClassicInvoice invoice={invoice} />;
}

function companyAddress(company: any) {
  return [company.address_line1, company.address_line2, company.city, company.state, company.pincode].filter(Boolean).join(', ');
}

function billTo(customer: any) {
  return [customer.billing_address, customer.billing_city, customer.billing_state, customer.billing_pincode].filter(Boolean).join(', ');
}

function shipTo(customer: any) {
  return [
    customer.shipping_address || customer.billing_address,
    customer.shipping_city || customer.billing_city,
    customer.shipping_state || customer.billing_state,
  ]
    .filter(Boolean)
    .join(', ');
}

function lineTax(item: { cgstAmount?: number; sgstAmount?: number; igstAmount?: number }) {
  return (item.cgstAmount || 0) + (item.sgstAmount || 0) + (item.igstAmount || 0);
}

function stateTag(code?: string | null, name?: string | null) {
  return [code, name].filter(Boolean).join('-') || '-';
}

function effectiveGstRate(invoice: InvoiceDetail) {
  const tax = invoice.isInterstate ? invoice.totalIgst : (invoice.totalCgst || 0) + (invoice.totalSgst || 0);
  if (!tax || !invoice.taxableValue) return null;
  return Math.round((tax / invoice.taxableValue) * 100);
}

function ClassicInvoice({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
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
          <h2 className="text-2xl font-bold text-indigo-600">TAX INVOICE</h2>
          <p className="mt-1 text-xs text-slate-500">Invoice #: {invoice.invoiceNumber}</p>
          <p className="text-xs text-slate-500">Date: {formatDate(invoice.invoiceDate)}</p>
          {invoice.dueDate && <p className="text-xs text-slate-500">Due: {formatDate(invoice.dueDate)}</p>}
          {invoice.reverseCharge && <p className="text-xs text-slate-500">Reverse Charge: Yes</p>}
        </div>
      </div>

      <hr className="my-5 border-slate-200" />

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bill To</p>
          <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 text-xs text-slate-500">{billTo(customer)}</p>
          {customer.gstin && <p className="text-xs text-slate-500">GSTIN: {customer.gstin}</p>}
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Ship To</p>
          <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
          <p className="mt-1 text-xs text-slate-500">{shipTo(customer)}</p>
          <p className="mt-1 text-xs text-slate-500">
            Place of Supply: {invoice.placeOfSupplyStateCode} ({invoice.isInterstate ? 'Inter-state' : 'Intra-state'})
          </p>
        </div>
      </div>

      <LineItemsTable invoice={invoice} tableClass="classic" />
      <TotalsBlock invoice={invoice} totalsClass="classic" />

      <p className="mt-3 text-xs text-slate-600">Amount in words: {amountInWords(invoice.grandTotal)}</p>

      {(company.bank_name || company.bank_account_no) && (
        <div className="mt-4 rounded-md border border-slate-100 bg-slate-50 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bank Details</p>
          <p className="mt-1 text-xs text-slate-600">Bank: {company.bank_name}</p>
          <p className="text-xs text-slate-600">Account No: {company.bank_account_no}</p>
          <p className="text-xs text-slate-600">IFSC: {company.bank_ifsc}</p>
          {company.bank_branch && <p className="text-xs text-slate-600">Branch: {company.bank_branch}</p>}
        </div>
      )}

      {(invoice.notes || invoice.terms) && (
        <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
          {invoice.notes && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Terms & Conditions</p>
              <p>{invoice.terms}</p>
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

function ModernInvoice({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  return (
    <div className="text-[13px] leading-snug text-slate-800">
      <div className="rounded-t-xl bg-indigo-700 px-8 py-6 text-white">
        <div className="flex items-start justify-between">
          <div>
            {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mb-2 h-12 w-auto max-w-[150px] rounded object-contain" />}
            <h1 className="text-xl font-bold">{company.name}</h1>
            <p className="mt-1 text-xs leading-relaxed text-indigo-100">{companyAddress(company)}</p>
            {company.gstin && <p className="text-xs text-indigo-100">GSTIN: {company.gstin}</p>}
            {company.phone && <p className="text-xs text-indigo-100">Phone: {company.phone}</p>}
            {company.email && <p className="text-xs text-indigo-100">Email: {company.email}</p>}
          </div>
          <div className="text-right">
            <h2 className="rounded-md bg-indigo-600 px-3 py-1 text-2xl font-bold">TAX INVOICE</h2>
            <p className="mt-1 text-xs text-indigo-100">Invoice #: {invoice.invoiceNumber}</p>
            <p className="text-xs text-indigo-100">Date: {formatDate(invoice.invoiceDate)}</p>
            {invoice.dueDate && <p className="text-xs text-indigo-100">Due: {formatDate(invoice.dueDate)}</p>}
            {invoice.reverseCharge && <p className="text-xs text-indigo-100">Reverse Charge: Yes</p>}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Bill To</p>
            <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
            <p className="mt-1 text-xs text-slate-500">{billTo(customer)}</p>
            {customer.gstin && <p className="text-xs text-slate-500">GSTIN: {customer.gstin}</p>}
          </div>
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Ship To</p>
            <p className="mt-1 font-semibold text-slate-900">{customer.name}</p>
            <p className="mt-1 text-xs text-slate-500">{shipTo(customer)}</p>
            <p className="mt-1 text-xs text-slate-500">
              Place of Supply: {invoice.placeOfSupplyStateCode} ({invoice.isInterstate ? 'Inter-state' : 'Intra-state'})
            </p>
          </div>
        </div>

        <LineItemsTable invoice={invoice} tableClass="modern" />
        <TotalsBlock invoice={invoice} totalsClass="modern" />

        <p className="mt-3 text-xs text-slate-600">Amount in words: {amountInWords(invoice.grandTotal)}</p>

        {(company.bank_name || company.bank_account_no) && (
          <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50/50 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">Bank Details</p>
            <p className="mt-1 text-xs text-slate-600">Bank: {company.bank_name}</p>
            <p className="text-xs text-slate-600">Account No: {company.bank_account_no}</p>
            <p className="text-xs text-slate-600">IFSC: {company.bank_ifsc}</p>
            {company.bank_branch && <p className="text-xs text-slate-600">Branch: {company.bank_branch}</p>}
          </div>
        )}

        {(invoice.notes || invoice.terms) && (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4 text-xs text-slate-600">
            {invoice.notes && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Notes</p>
                <p>{invoice.notes}</p>
              </div>
            )}
            {invoice.terms && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Terms & Conditions</p>
                <p>{invoice.terms}</p>
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

function MinimalInvoice({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
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
          <h2 className="text-lg font-bold tracking-widest uppercase">Tax Invoice</h2>
        </div>
      </div>

      <div className="mt-6 flex justify-between border-b border-slate-300 pb-3 text-xs text-slate-500">
        <div>
          <p>Invoice #: <span className="font-semibold text-slate-900">{invoice.invoiceNumber}</span></p>
          <p>Date: {formatDate(invoice.invoiceDate)}</p>
          {invoice.dueDate && <p>Due: {formatDate(invoice.dueDate)}</p>}
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-900">{customer.name}</p>
          <p>{billTo(customer)}</p>
          {customer.gstin && <p>GSTIN: {customer.gstin}</p>}
          <p className="mt-1">Place of Supply: {invoice.placeOfSupplyStateCode}</p>
        </div>
      </div>

      <LineItemsTable invoice={invoice} tableClass="minimal" />
      <TotalsBlock invoice={invoice} totalsClass="minimal" />

      <p className="mt-4 text-xs text-slate-600">Amount in words: {amountInWords(invoice.grandTotal)}</p>

      {(company.bank_name || company.bank_account_no) && (
        <div className="mt-6 border-t border-slate-300 pt-3 text-xs text-slate-600">
          <p><span className="font-medium">Bank:</span> {company.bank_name}</p>
          <p><span className="font-medium">Account No:</span> {company.bank_account_no}</p>
          <p><span className="font-medium">IFSC:</span> {company.bank_ifsc}</p>
          {company.bank_branch && <p><span className="font-medium">Branch:</span> {company.bank_branch}</p>}
        </div>
      )}

      {(invoice.notes || invoice.terms) && (
        <div className="mt-6 space-y-3 border-t border-slate-300 pt-3 text-xs text-slate-600">
          {invoice.notes && (
            <div>
              <p className="font-medium uppercase tracking-wider text-slate-400">Notes</p>
              <p>{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div>
              <p className="font-medium uppercase tracking-wider text-slate-400">Terms & Conditions</p>
              <p>{invoice.terms}</p>
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

function VyaparInvoice({ invoice }: { invoice: InvoiceDetail }) {
  const company = invoice.company || {};
  const customer = invoice.customer || {};
  const gstRate = effectiveGstRate(invoice);
  const qtySum = invoice.lineItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const cell = 'border border-slate-500 px-1.5 py-1 align-top';
  const cellRight = 'border border-slate-500 px-1.5 py-1 text-right align-top';

  return (
    <div className="px-8 pb-8 pt-6 text-[13px] leading-snug text-slate-900">
      <p className="text-center text-[15px] font-bold tracking-wide">Tax Invoice</p>

      <div className="mt-2 border border-slate-500">
        <div className="flex">
          <div className="min-w-0 flex-1 border-r border-slate-500 px-3 py-2">
            {company.logo_url && <img src={company.logo_url} alt="Company logo" className="mb-1 h-10 w-auto max-w-[150px] rounded object-contain" />}
            <h1 className="text-base font-bold">{company.name}</h1>
            <p className="mt-0.5 text-xs leading-relaxed">{companyAddress(company)}</p>
            <p className="text-xs">Phone no.: {company.phone}</p>
            {company.email && <p className="text-xs">Email: {company.email}</p>}
            {company.gstin && <p className="text-xs">GSTIN: {company.gstin}</p>}
            <p className="text-xs">State: {stateTag(company.stateCode, company.state)}</p>
          </div>
          <div className="w-[300px] shrink-0 text-xs">
            <div className="grid grid-cols-2 border-b border-slate-500">
              <div className="px-3 py-1.5">
                <p className="text-[10px] text-slate-600">Invoice No.</p>
                <p className="text-[13px] font-bold">{invoice.invoiceNumber}</p>
              </div>
              <div className="border-l border-slate-500 px-3 py-1.5">
                <p className="text-[10px] text-slate-600">Date</p>
                <p className="text-[13px] font-bold">{formatDate(invoice.invoiceDate)}</p>
              </div>
            </div>
            <div className="px-3 py-1.5">
              <p className="text-[10px] text-slate-600">Place of supply</p>
              <p className="text-[13px] font-bold">{stateTag(invoice.placeOfSupplyStateCode, customer.billing_state)}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3 border border-slate-500">
        <p className="border-b border-slate-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wide">Bill To</p>
        <div className="px-3 py-2">
          <p className="font-bold">{customer.name}</p>
          <p className="text-xs">{billTo(customer)}</p>
          {customer.gstin && <p className="text-xs">GSTIN : {customer.gstin}</p>}
          <p className="text-xs">State: {customer.billing_state || stateTag(company.stateCode, company.state)}</p>
        </div>
      </div>

      <table className="mt-3 w-full table-fixed border-collapse text-xs">
        <thead>
          <tr>
            <th className={`${cell} w-[30px] text-left font-bold`}>#</th>
            <th className={`${cell} text-left font-bold`}>Item name</th>
            <th className={`${cell} w-[80px] text-left font-bold`}>HSN/ SAC</th>
            <th className={`${cell} w-[70px] text-right font-bold`}>Quantity</th>
            <th className={`${cell} w-[85px] text-right font-bold`}>Price/ Unit</th>
            <th className={`${cell} w-[95px] text-right font-bold`}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, idx) => (
            <tr key={item.id || idx}>
              <td className={cell}>{idx + 1}</td>
              <td className={cell}>{item.description}</td>
              <td className={cell}>{item.hsnSacCode || '-'}</td>
              <td className={cellRight}>
                {item.qty} {item.unit}
              </td>
              <td className={cellRight}>{formatCurrency(item.rate)}</td>
              <td className={cellRight}>{formatCurrency(item.lineTotal)}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={2} className={cell}>
              <p className="font-bold">Total</p>
            </td>
            <td className={cell} />
            <td className={`${cellRight} font-bold`}>{qtySum}</td>
            <td className={cell} />
            <td className={`${cellRight} font-bold`}>{formatCurrency(invoice.subtotal)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 flex border border-slate-500">
        <div className="min-w-0 flex-1 border-r border-slate-500 px-3 py-2">
          <p className="text-[10px] text-slate-600">Invoice Amount in Words</p>
          <p className="mt-0.5 text-xs font-bold">{amountInWords(invoice.grandTotal)}</p>
        </div>
        <div className="w-[230px] shrink-0 text-xs">
          <p className="px-3 py-1.5 font-bold">Amounts</p>
          <div className="flex justify-between border-t border-slate-500 px-3 py-1">
            <span>Sub Total</span>
            <span>{formatCurrency(invoice.subtotal)}</span>
          </div>
          {invoice.totalDiscount > 0 && (
            <div className="flex justify-between border-t border-slate-500 px-3 py-1">
              <span>Discount</span>
              <span>-{formatCurrency(invoice.totalDiscount)}</span>
            </div>
          )}
          {gstRate != null && invoice.taxableValue > 0 && (
            <div className="flex justify-between border-t border-slate-500 px-3 py-1">
              <span>Tax ({gstRate}%)</span>
              <span>{formatCurrency(invoice.isInterstate ? invoice.totalIgst : invoice.totalCgst + invoice.totalSgst)}</span>
            </div>
          )}
          {invoice.roundOff !== 0 && (
            <div className="flex justify-between border-t border-slate-500 px-3 py-1">
              <span>Round off</span>
              <span>{formatCurrency(invoice.roundOff)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-500 px-3 py-1.5 font-bold">
            <span>Total</span>
            <span>{formatCurrency(invoice.grandTotal)}</span>
          </div>
        </div>
      </div>

      <table className="mt-3 w-full table-fixed border-collapse text-xs">
        <thead>
          <tr className="font-bold">
            <th rowSpan={2} className={`${cell} w-[14%] text-left`}>
              HSN/ SAC
            </th>
            <th rowSpan={2} className={`${cell} text-right`}>
              Taxable amount
            </th>
            {!invoice.isInterstate ? (
              <>
                <th colSpan={2} className={cell}>
                  CGST
                </th>
                <th colSpan={2} className={cell}>
                  SGST
                </th>
              </>
            ) : (
              <th colSpan={2} className={cell}>
                IGST
              </th>
            )}
            <th rowSpan={2} className={`${cell} text-right`}>
              Total Tax Amount
            </th>
          </tr>
          <tr className="font-bold">
            <th className={cell}>Rate</th>
            <th className={cellRight}>Amount</th>
            {!invoice.isInterstate && (
              <>
                <th className={cell}>Rate</th>
                <th className={cellRight}>Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems.map((item, idx) => (
            <tr key={item.id || idx}>
              <td className={cell}>{item.hsnSacCode || '-'}</td>
              <td className={cellRight}>{formatCurrency(item.taxableValue)}</td>
              {!invoice.isInterstate ? (
                <>
                  <td className={cell}>{item.gstRate}%</td>
                  <td className={cellRight}>{formatCurrency(item.cgstAmount || 0)}</td>
                  <td className={cell}>{item.gstRate}%</td>
                  <td className={cellRight}>{formatCurrency(item.sgstAmount || 0)}</td>
                </>
              ) : (
                <>
                  <td className={cell}>{item.gstRate}%</td>
                  <td className={cellRight}>{formatCurrency(item.igstAmount || 0)}</td>
                </>
              )}
              <td className={cellRight}>{formatCurrency(lineTax(item))}</td>
            </tr>
          ))}
          <tr className="font-bold">
            <td className={cell}>Total</td>
            <td className={cellRight}>{formatCurrency(invoice.taxableValue)}</td>
            {!invoice.isInterstate ? (
              <>
                <td className={cell} />
                <td className={cellRight}>{formatCurrency(invoice.totalCgst)}</td>
                <td className={cell} />
                <td className={cellRight}>{formatCurrency(invoice.totalSgst)}</td>
              </>
            ) : (
              <>
                <td className={cell} />
                <td className={cellRight}>{formatCurrency(invoice.totalIgst)}</td>
              </>
            )}
            <td className={cellRight}>
              {formatCurrency(invoice.isInterstate ? invoice.totalIgst : invoice.totalCgst + invoice.totalSgst)}
            </td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 grid grid-cols-3 border border-slate-500">
        {(company.bank_name || company.bank_account_no) && (
          <div className="border-r border-slate-500 px-3 py-2 text-xs">
            <p className="font-bold">Bank Details</p>
            {company.bank_name && <p className="mt-0.5">Name : {company.bank_name}</p>}
            {company.bank_account_no && <p>Account No. : {company.bank_account_no}</p>}
            {company.bank_ifsc && <p>IFSC code : {company.bank_ifsc}</p>}
            {company.bank_branch && <p>Branch : {company.bank_branch}</p>}
          </div>
        )}
        <div className="border-r border-slate-500 px-3 py-2 text-xs">
          {invoice.notes && (
            <div>
              <p className="font-bold">Notes</p>
              <p className="mt-0.5">{invoice.notes}</p>
            </div>
          )}
          {invoice.terms && (
            <div className={invoice.notes ? 'mt-2' : ''}>
              <p className="font-bold">Terms and conditions</p>
              <p className="mt-0.5">{invoice.terms}</p>
            </div>
          )}
        </div>
        <div className="px-3 py-2 text-right text-xs">
          <p>For : {company.name}</p>
          {company.signature_url && <img src={company.signature_url} alt="Authorized signatory signature" className="ml-auto mt-2 h-9 w-auto max-w-[130px] object-contain" />}
          <p className={`font-bold ${company.signature_url ? 'mt-1' : 'mt-10'}`}>Authorized Signatory</p>
        </div>
      </div>
    </div>
  );
}

function LineItemsTable({ invoice, tableClass }: { invoice: InvoiceDetail; tableClass: 'classic' | 'modern' | 'minimal' }) {
  const headClass =
    tableClass === 'minimal'
      ? 'border-y border-slate-300 bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500'
      : tableClass === 'modern'
        ? 'bg-indigo-50 text-[10px] font-semibold uppercase tracking-wider text-indigo-700'
        : 'bg-indigo-50 text-[10px] font-semibold uppercase tracking-wider text-indigo-800';
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
        {invoice.lineItems.map((item, idx) => (
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

function TotalsBlock({ invoice, totalsClass }: { invoice: InvoiceDetail; totalsClass: 'classic' | 'modern' | 'minimal' }) {
  const rows: Array<{ label: string; value: number; bold?: boolean }> = [
    { label: 'Subtotal', value: invoice.subtotal },
    ...(invoice.totalDiscount > 0 ? [{ label: 'Discount', value: -invoice.totalDiscount }] : []),
    { label: 'Taxable Value', value: invoice.taxableValue },
    ...(invoice.isInterstate
      ? [{ label: 'IGST', value: invoice.totalIgst }]
      : [
          { label: 'CGST', value: invoice.totalCgst },
          { label: 'SGST', value: invoice.totalSgst },
        ]),
    ...(invoice.roundOff !== 0 ? [{ label: 'Round Off', value: invoice.roundOff }] : []),
    { label: 'Grand Total', value: invoice.grandTotal, bold: true },
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
              totalsClass === 'modern' ? 'rounded-md bg-indigo-700 text-white' : totalsClass === 'minimal' ? 'text-slate-900' : 'text-slate-900'
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