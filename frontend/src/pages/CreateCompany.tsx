import { useNavigate } from 'react-router-dom';
import { CompanyForm } from '../components/CompanyForm';
import { createCompany } from '../api/companies';
import { useAuth } from '../context/AuthContext';
import { useCompany } from '../context/CompanyContext';
import { useToast } from '../context/ToastContext';
import { apiErrorMessage } from '../api/client';
import { useState } from 'react';

export default function CreateCompany() {
  const navigate = useNavigate();
  const { refreshMemberships, memberships } = useAuth();
  const { setCompanyId } = useCompany();
  const { notify } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(payload: any) {
    setLoading(true);
    setError('');
    try {
      const company = await createCompany(payload);
      await refreshMemberships();
      setCompanyId(company.id);
      notify(`${company.name} is ready to go`);
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create company'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">
          {memberships.length === 0 ? 'Set up your company' : 'Add another company'}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          These details appear on every GST invoice, credit note and report — you can change them anytime in Settings.
        </p>
      </div>
      {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <CompanyForm onSubmit={handleSubmit} submitLabel="Create company" loading={loading} />
      </div>
    </div>
  );
}
