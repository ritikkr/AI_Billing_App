import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCompany } from '../../context/CompanyContext';
import { fetchSalesRegister, fetchGstSummary, fetchHsnSummary, fetchAging } from '../../api/reports';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatCurrency, formatDate, todayIso, addDaysIso } from '../../utils/format';

const TABS = [
  { key: 'sales', label: 'Sales Register' },
  { key: 'gst', label: 'GST Summary' },
  { key: 'hsn', label: 'HSN Summary' },
  { key: 'aging', label: 'Receivables Aging' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Reports() {
  const [tab, setTab] = useState<TabKey>('sales');
  const [from, setFrom] = useState(addDaysIso(-90));
  const [to, setTo] = useState(todayIso());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Reports</h1>
        <p className="text-sm text-slate-500">GST-ready reports for filing and reconciliation</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1 shadow-xs ring-1 ring-slate-200/60">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150', tab === t.key ? 'bg-white text-indigo-700 shadow-card' : 'text-slate-600 hover:text-slate-900')}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'aging' && (
          <div className="flex items-center gap-2">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-auto" />
            <span className="text-slate-400">to</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-auto" />
          </div>
        )}
      </div>

      {tab === 'sales' && <SalesRegister from={from} to={to} />}
      {tab === 'gst' && <GstSummary from={from} to={to} />}
      {tab === 'hsn' && <HsnSummary from={from} to={to} />}
      {tab === 'aging' && <Aging />}
    </div>
  );
}

function SalesRegister({ from, to }: { from: string; to: string }) {
  const { companyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ['report-sales', companyId, from, to],
    queryFn: () => fetchSalesRegister(companyId!, from, to),
    enabled: !!companyId,
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState title="No sales in this period" />;

  const totalTaxable = data.reduce((s: number, r: any) => s + r.taxableValue, 0);
  const totalGrand = data.reduce((s: number, r: any) => s + r.grandTotal, 0);

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5 font-medium">Invoice #</th>
              <th className="px-5 py-2.5 font-medium">Date</th>
              <th className="px-5 py-2.5 font-medium">Customer</th>
              <th className="px-5 py-2.5 font-medium">GSTIN</th>
              <th className="px-5 py-2.5 font-medium">Place of Supply</th>
              <th className="px-5 py-2.5 text-right font-medium">Taxable</th>
              <th className="px-5 py-2.5 text-right font-medium">CGST</th>
              <th className="px-5 py-2.5 text-right font-medium">SGST</th>
              <th className="px-5 py-2.5 text-right font-medium">IGST</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.invoiceNumber} className="border-b border-slate-100/70 transition-colors last:border-0">
                <td className="px-5 py-2.5 font-medium text-indigo-700">{r.invoiceNumber}</td>
                <td className="px-5 py-2.5 text-slate-500">{formatDate(r.invoiceDate)}</td>
                <td className="px-5 py-2.5 text-slate-700">{r.customerName}</td>
                <td className="px-5 py-2.5 text-slate-500">{r.gstin || 'B2C'}</td>
                <td className="px-5 py-2.5 text-slate-500">{r.placeOfSupply}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.taxableValue)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.cgst)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.sgst)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.igst)}</td>
                <td className="px-5 py-2.5 text-right font-medium text-slate-900">{formatCurrency(r.grandTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-slate-200 font-semibold text-slate-900">
              <td className="px-5 py-3" colSpan={5}>
                Total
              </td>
              <td className="px-5 py-3 text-right">{formatCurrency(totalTaxable)}</td>
              <td colSpan={3}></td>
              <td className="px-5 py-3 text-right">{formatCurrency(totalGrand)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function GstSummary({ from, to }: { from: string; to: string }) {
  const { companyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ['report-gst', companyId, from, to],
    queryFn: () => fetchGstSummary(companyId!, from, to),
    enabled: !!companyId,
  });

  if (isLoading) return <PageLoader />;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">Tax collected by GST rate</div>
        {data.byRate.length === 0 ? (
          <EmptyState title="No tax data" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 font-medium">Rate</th>
                <th className="px-5 py-2.5 text-right font-medium">Taxable</th>
                <th className="px-5 py-2.5 text-right font-medium">CGST</th>
                <th className="px-5 py-2.5 text-right font-medium">SGST</th>
                <th className="px-5 py-2.5 text-right font-medium">IGST</th>
              </tr>
            </thead>
            <tbody>
              {data.byRate.map((r: any) => (
                <tr key={r.gstRate} className="border-b border-slate-100/70 transition-colors last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-900">{r.gstRate}%</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.taxableValue)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.cgst)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.sgst)}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.igst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card>
        <div className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900">B2B vs B2C split</div>
        {data.b2bVsB2c.length === 0 ? (
          <EmptyState title="No invoice data" />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-2.5 font-medium">Segment</th>
                <th className="px-5 py-2.5 text-right font-medium">Invoices</th>
                <th className="px-5 py-2.5 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.b2bVsB2c.map((r: any) => (
                <tr key={r.segment} className="border-b border-slate-100/70 transition-colors last:border-0">
                  <td className="px-5 py-2.5 font-medium text-slate-900">{r.segment}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{r.invoiceCount}</td>
                  <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

function HsnSummary({ from, to }: { from: string; to: string }) {
  const { companyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ['report-hsn', companyId, from, to],
    queryFn: () => fetchHsnSummary(companyId!, from, to),
    enabled: !!companyId,
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState title="No HSN/SAC data in this period" />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5 font-medium">HSN/SAC</th>
              <th className="px-5 py-2.5 font-medium">Unit</th>
              <th className="px-5 py-2.5 text-right font-medium">Qty</th>
              <th className="px-5 py-2.5 text-right font-medium">Taxable</th>
              <th className="px-5 py-2.5 text-right font-medium">CGST</th>
              <th className="px-5 py-2.5 text-right font-medium">SGST</th>
              <th className="px-5 py-2.5 text-right font-medium">IGST</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.hsnSacCode + r.unit} className="border-b border-slate-100/70 transition-colors last:border-0">
                <td className="px-5 py-2.5 font-medium text-slate-900">{r.hsnSacCode}</td>
                <td className="px-5 py-2.5 text-slate-500">{r.unit}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{r.totalQty}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.taxableValue)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.cgst)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.sgst)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.igst)}</td>
                <td className="px-5 py-2.5 text-right font-medium text-slate-900">{formatCurrency(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Aging() {
  const { companyId } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ['report-aging', companyId],
    queryFn: () => fetchAging(companyId!),
    enabled: !!companyId,
  });

  if (isLoading) return <PageLoader />;
  if (!data || data.length === 0) return <EmptyState title="No outstanding receivables" description="All invoices are settled." />;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-5 py-2.5 font-medium">Customer</th>
              <th className="px-5 py-2.5 text-right font-medium">Current</th>
              <th className="px-5 py-2.5 text-right font-medium">1-30 days</th>
              <th className="px-5 py-2.5 text-right font-medium">31-60 days</th>
              <th className="px-5 py-2.5 text-right font-medium">61-90 days</th>
              <th className="px-5 py-2.5 text-right font-medium">90+ days</th>
              <th className="px-5 py-2.5 text-right font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r: any) => (
              <tr key={r.customerId} className="border-b border-slate-100/70 transition-colors last:border-0">
                <td className="px-5 py-2.5 font-medium text-slate-900">{r.customerName}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.current)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.d30)}</td>
                <td className="px-5 py-2.5 text-right text-slate-700">{formatCurrency(r.d60)}</td>
                <td className="px-5 py-2.5 text-right text-amber-600">{formatCurrency(r.d90)}</td>
                <td className="px-5 py-2.5 text-right font-medium text-red-600">{formatCurrency(r.over90)}</td>
                <td className="px-5 py-2.5 text-right font-semibold text-slate-900">{formatCurrency(r.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
