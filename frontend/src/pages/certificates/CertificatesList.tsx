import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { listCertificates } from '../../api/certificates';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge } from '../../components/ui/Badge';
import { formatDate } from '../../utils/format';

const STATUS_OPTIONS = ['', 'draft', 'issued', 'cancelled'];

export default function CertificatesList() {
  const { companyId, canEdit } = useCompany();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['certificates', companyId, search, status],
    queryFn: () => listCertificates(companyId!, { search: search || undefined, status: status || undefined }),
    enabled: !!companyId,
  });

  const issued = data?.filter((c) => c.status === 'issued').length ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Certificates</h1>
          <p className="text-sm text-slate-500">
            {data ? `${data.length} certificates · ${issued} issued` : 'Service certificates for customers and outlets'}
          </p>
        </div>
        {canEdit && (
          <Link to="/certificates/new">
            <Button>+ New Certificate</Button>
          </Link>
        )}
      </div>

      <Card>
        <div className="flex flex-wrap gap-3 border-b border-slate-100 bg-slate-50/40 p-4">
          <Input type="search" name="certificate-search" autoComplete="off" enterKeyHint="search" placeholder="Search certificate #, outlet, service…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="max-w-[180px]">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s ? s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'All statuses'}
              </option>
            ))}
          </Select>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState title="No certificates yet" description="Issue your first service / completion certificate." action={canEdit && (
            <Link to="/certificates/new">
              <Button>+ New Certificate</Button>
            </Link>
          )} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-5 py-3 font-medium">Certificate #</th>
                  <th className="px-5 py-3 font-medium">Customer / Outlet</th>
                  <th className="px-5 py-3 font-medium">Service</th>
                  <th className="px-5 py-3 font-medium">Service date</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((cert) => (
                  <tr key={cert.id} className="border-b border-slate-100/70 transition-colors last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <Link to={`/certificates/${cert.id}`} className="font-medium text-indigo-600 transition-colors hover:text-indigo-700">
                        {cert.certificateNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-slate-700">
                      {cert.outletName || cert.customerName || '-'}
                    </td>
                    <td className="px-5 py-3 text-slate-500">{cert.serviceType || '-'}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(cert.serviceDate)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={cert.status} />
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