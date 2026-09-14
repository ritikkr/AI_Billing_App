import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { useCompany } from '../context/CompanyContext';
import { fetchDashboard } from '../api/reports';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/format';

function StatCard({
  label,
  value,
  sub,
  tone = 'default',
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'default' | 'warning' | 'success';
  icon: ReactNode;
}) {
  return (
    <Card className="group relative overflow-hidden transition-shadow duration-200 hover:shadow-card-hover">
      <CardBody className="relative">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
            <p className={`mt-2 text-2xl font-semibold tracking-tight ${tone === 'warning' ? 'text-amber-600' : tone === 'success' ? 'text-emerald-600' : 'text-slate-900'}`}>
              {value}
            </p>
            {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-400 transition-colors group-hover:bg-indigo-50 group-hover:text-indigo-600">
            {icon}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

export default function Dashboard() {
  const { companyId, companyName, role } = useCompany();
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard', companyId],
    queryFn: () => fetchDashboard(companyId!),
    enabled: !!companyId,
  });

  if (isLoading || !data) return <PageLoader />;

  const chartData = data.revenueTrend.map((r) => ({
    ...r,
    label: r.month.slice(5) + '/' + r.month.slice(2, 4),
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{companyName}</h1>
          <p className="text-sm text-slate-500">Here's how your business is doing</p>
        </div>
        {role !== 'viewer' && (
          <Link to="/invoices/new">
            <Button>+ New Invoice</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatCurrency(data.totalRevenue)}
          sub={`${data.invoiceCount} invoices`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Outstanding"
          value={formatCurrency(data.outstanding)}
          tone={data.outstanding > 0 ? 'warning' : 'default'}
          sub="Awaiting payment"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Tax Collected"
          value={formatCurrency(data.taxCollected)}
          tone="success"
          sub="CGST + SGST + IGST"
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
          }
        />
        <StatCard
          label="This Month"
          value={formatCurrency(data.thisMonthRevenue)}
          sub={`${data.customerCount} customers · ${data.itemCount} items`}
          icon={
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Revenue trend" subtitle="Last 12 months" />
          <CardBody>
            {chartData.length === 0 ? (
              <EmptyState title="No revenue yet" description="Create your first invoice to see trends here." />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ left: 0, right: 8, top: 8 }}>
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366f1" stopOpacity={0.22} />
                      <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgb(15 23 42 / 0.06)' }}
                  />
                  <Area type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2.5} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Top customers" />
          <CardBody>
            {data.topCustomers.length === 0 ? (
              <EmptyState title="No customers yet" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.topCustomers} layout="vertical" margin={{ left: 0, right: 16 }}>
                  <XAxis type="number" hide />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={90}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    contentStyle={{ fontSize: 12, borderRadius: 12, border: '1px solid #e5e7eb', boxShadow: '0 4px 12px rgb(15 23 42 / 0.06)' }}
                  />
                  <Bar dataKey="total" fill="#6366f1" radius={[0, 6, 6, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Recent invoices"
          action={
            <Link to="/invoices" className="text-sm font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
              View all
            </Link>
          }
        />
        {data.recentInvoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Your recent invoices will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Invoice #</th>
                  <th className="px-5 py-3 font-medium">Customer</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 transition-colors hover:text-indigo-700">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{inv.customerName}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-3 font-medium tabular-nums text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}