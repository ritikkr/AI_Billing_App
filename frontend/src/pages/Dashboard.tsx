import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from 'recharts';
import { useCompany } from '../context/CompanyContext';
import { fetchDashboard } from '../api/reports';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { StatusBadge } from '../components/ui/Badge';
import { PageLoader } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { formatCurrency, formatDate } from '../utils/format';

function StatCard({ label, value, sub, tone = 'default' }: { label: string; value: string; sub?: string; tone?: 'default' | 'warning' }) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <p className={`mt-2 text-2xl font-semibold ${tone === 'warning' ? 'text-amber-600' : 'text-slate-900'}`}>{value}</p>
        {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
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

  const chartData = data.revenueTrend.map((r) => ({ ...r, label: r.month.slice(5) + '/' + r.month.slice(2, 4) }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{companyName}</h1>
          <p className="text-sm text-slate-500">Here's how your business is doing</p>
        </div>
        {role !== 'viewer' && (
          <Link to="/invoices/new">
            <Button>+ New Invoice</Button>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Revenue" value={formatCurrency(data.totalRevenue)} sub={`${data.invoiceCount} invoices`} />
        <StatCard label="Outstanding" value={formatCurrency(data.outstanding)} tone={data.outstanding > 0 ? 'warning' : 'default'} sub="Awaiting payment" />
        <StatCard label="Tax Collected" value={formatCurrency(data.taxCollected)} sub="CGST + SGST + IGST" />
        <StatCard label="This Month" value={formatCurrency(data.thisMonthRevenue)} sub={`${data.customerCount} customers · ${data.itemCount} items`} />
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
                      <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 12, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => (v >= 1000 ? `${v / 1000}k` : v)}
                    width={40}
                  />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Area type="monotone" dataKey="total" stroke="#4f46e5" strokeWidth={2} fill="url(#revenueFill)" />
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
                    tick={{ fontSize: 11, fill: '#64748b' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: string) => (v.length > 12 ? v.slice(0, 12) + '…' : v)}
                  />
                  <Tooltip formatter={(v) => formatCurrency(Number(v))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="total" fill="#4f46e5" radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recent invoices" action={<Link to="/invoices" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">View all</Link>} />
        {data.recentInvoices.length === 0 ? (
          <EmptyState title="No invoices yet" description="Your recent invoices will show up here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Invoice #</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentInvoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-2.5">
                      <Link to={`/invoices/${inv.id}`} className="font-medium text-indigo-600 hover:underline">
                        {inv.invoiceNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-2.5 text-slate-700">{inv.customerName}</td>
                    <td className="px-5 py-2.5 text-slate-500">{formatDate(inv.invoiceDate)}</td>
                    <td className="px-5 py-2.5 font-medium text-slate-900">{formatCurrency(inv.grandTotal)}</td>
                    <td className="px-5 py-2.5">
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
