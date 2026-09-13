import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCompany } from '../../context/CompanyContext';
import { listCreditNotes } from '../../api/creditNotes';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Input';
import { PageLoader } from '../../components/ui/Spinner';
import { EmptyState } from '../../components/ui/EmptyState';
import { StatusBadge, Badge } from '../../components/ui/Badge';
import { formatCurrency, formatDate } from '../../utils/format';

export default function CreditNotesList() {
  const { companyId, canEdit } = useCompany();
  const [noteType, setNoteType] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['credit-notes', companyId, noteType],
    queryFn: () => listCreditNotes(companyId!, { noteType: noteType || undefined }),
    enabled: !!companyId,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Credit & Debit Notes</h1>
          <p className="text-sm text-slate-500">Adjustments and returns against issued invoices</p>
        </div>
        {canEdit && (
          <Link to="/credit-notes/new">
            <Button>+ New Note</Button>
          </Link>
        )}
      </div>

      <Card>
        <div className="border-b border-slate-100 p-4">
          <Select value={noteType} onChange={(e) => setNoteType(e.target.value)} className="max-w-[180px]">
            <option value="">All types</option>
            <option value="credit">Credit notes</option>
            <option value="debit">Debit notes</option>
          </Select>
        </div>
        {isLoading ? (
          <PageLoader />
        ) : !data || data.length === 0 ? (
          <EmptyState
            title="No notes yet"
            description="Issue a credit note for returns or a debit note for additional charges."
            action={canEdit && (
              <Link to="/credit-notes/new">
                <Button>+ New Note</Button>
              </Link>
            )}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-5 py-2.5 font-medium">Note #</th>
                  <th className="px-5 py-2.5 font-medium">Type</th>
                  <th className="px-5 py-2.5 font-medium">Customer</th>
                  <th className="px-5 py-2.5 font-medium">Date</th>
                  <th className="px-5 py-2.5 font-medium">Amount</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((n) => (
                  <tr key={n.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                    <td className="px-5 py-3">
                      <Link to={`/credit-notes/${n.id}`} className="font-medium text-indigo-600 hover:underline">
                        {n.noteNumber}
                      </Link>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={n.noteType === 'credit' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}>
                        {n.noteType === 'credit' ? 'Credit Note' : 'Debit Note'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-slate-700">{n.customerName}</td>
                    <td className="px-5 py-3 text-slate-500">{formatDate(n.noteDate)}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{formatCurrency(n.grandTotal)}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={n.status} />
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
