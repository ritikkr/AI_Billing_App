import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import { recordPayment } from '../../api/payments';
import { fetchMeta } from '../../api/meta';
import { useCompany } from '../../context/CompanyContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { formatCurrency, todayIso } from '../../utils/format';
import type { InvoiceDetail } from '../../types';

export function RecordPaymentModal({ open, onClose, invoice }: { open: boolean; onClose: () => void; invoice: InvoiceDetail }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const { data: meta } = useQuery({ queryKey: ['meta'], queryFn: fetchMeta });

  const [amount, setAmount] = useState(String(invoice.balanceDue));
  const [paymentDate, setPaymentDate] = useState(todayIso());
  const [paymentMode, setPaymentMode] = useState('bank_transfer');
  const [referenceNo, setReferenceNo] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      recordPayment(companyId!, {
        invoiceId: invoice.id,
        paymentDate,
        amount: Number(amount),
        paymentMode,
        referenceNo: referenceNo || null,
        notes: notes || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoice', companyId, invoice.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices', companyId] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', companyId] });
      notify('Payment recorded');
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not record payment')),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!amount || Number(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    mutation.mutate();
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <p className="text-sm text-slate-500">
          Balance due: <span className="font-semibold text-slate-900">{formatCurrency(invoice.balanceDue)}</span>
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Amount (₹)" type="number" min="0.01" step="0.01" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <Input label="Payment date" type="date" required value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select label="Mode" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
            {(meta?.paymentModes || ['cash', 'bank_transfer', 'cheque', 'upi', 'card', 'other']).map((m) => (
              <option key={m} value={m}>
                {m.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </Select>
          <Input label="Reference / UTR no." value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
        </div>
        <Textarea label="Notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Record payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
