import { useState, type FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { useCompany } from '../../context/CompanyContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiErrorMessage } from '../../api/client';
import { getCompany, updateCompany, listCompanyUsers, addCompanyUser, updateCompanyUserRole, removeCompanyUser } from '../../api/companies';
import { CompanyForm } from '../../components/CompanyForm';
import { Card, CardBody, CardHeader } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { PageLoader } from '../../components/ui/Spinner';
import { PrintDownloadTab } from './PrintDownloadTab';
import type { Role } from '../../types';

const TABS = [
  { key: 'profile', label: 'Company Profile' },
  { key: 'users', label: 'Users & Roles' },
  { key: 'preferences', label: 'Print & Download' },
] as const;

export default function CompanySettings() {
  const { tab: tabParam } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useCompany();
  const tab = tabParam === 'users' ? 'users' : tabParam === 'preferences' ? 'preferences' : 'profile';

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your company profile and team access</p>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100/90 p-1 shadow-xs ring-1 ring-slate-200/60" style={{ width: 'fit-content' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => navigate(`/settings/${t.key}`)}
            className={clsx('rounded-lg px-3 py-1.5 text-sm font-medium transition duration-150', tab === t.key ? 'bg-white text-indigo-700 shadow-card' : 'text-slate-600 hover:text-slate-900')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' ? <ProfileTab readOnly={!isAdmin} /> : tab === 'preferences' ? <PrintDownloadTab /> : <UsersTab />}
    </div>
  );
}

function ProfileTab({ readOnly }: { readOnly: boolean }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const { refreshMemberships } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState('');

  const { data: company, isLoading } = useQuery({ queryKey: ['company', companyId], queryFn: () => getCompany(companyId!), enabled: !!companyId });

  const mutation = useMutation({
    mutationFn: (payload: any) => updateCompany(companyId!, payload),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ['company', companyId] });
      await refreshMemberships();
      notify('Company profile updated');
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not update company')),
  });

  if (isLoading || !company) return <PageLoader />;

  return (
    <Card>
      <CardBody>
        {readOnly && (
          <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">Only company admins can edit these details. You have read-only access.</div>
        )}
        {error && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <fieldset disabled={readOnly}>
          <CompanyForm
            initial={company}
            onSubmit={async (payload) => {
              await mutation.mutateAsync(payload);
            }}
            submitLabel="Save changes"
            loading={mutation.isPending}
          />
        </fieldset>
      </CardBody>
    </Card>
  );
}

function UsersTab() {
  const { companyId, isAdmin } = useCompany();
  const { user: currentUser } = useAuth();
  const { notify } = useToast();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);

  const { data: users, isLoading } = useQuery({ queryKey: ['company-users', companyId], queryFn: () => listCompanyUsers(companyId!), enabled: !!companyId });

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) => updateCompanyUserRole(companyId!, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      notify('Role updated');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not update role'), 'error'),
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => removeCompanyUser(companyId!, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      notify('User removed');
    },
    onError: (err) => notify(apiErrorMessage(err, 'Could not remove user'), 'error'),
  });

  return (
    <Card>
      <CardHeader title="Team members" subtitle="Control who can access this company and what they can do" action={isAdmin && <Button onClick={() => setModalOpen(true)}>+ Add user</Button>} />
      {isLoading ? (
        <PageLoader />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(users || []).map((u) => (
                <tr key={u.id} className="border-b border-slate-100/70 last:border-0">
                  <td className="px-5 py-3 font-medium text-slate-900">
                    {u.name} {u.id === currentUser?.id && <Badge className="ml-1">You</Badge>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{u.email}</td>
                  <td className="px-5 py-3">
                    {isAdmin ? (
                      <Select
                        value={u.role}
                        onChange={(e) => roleMutation.mutate({ userId: u.id, role: e.target.value as Role })}
                        disabled={u.id === currentUser?.id}
                        className="w-36"
                      >
                        <option value="admin">Admin</option>
                        <option value="accountant">Accountant</option>
                        <option value="viewer">Viewer</option>
                      </Select>
                    ) : (
                      <Badge>{u.role}</Badge>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin && u.id !== currentUser?.id && (
                      <button
                        onClick={() => confirm(`Remove ${u.name} from this company?`) && removeMutation.mutate(u.id)}
                        className="text-sm font-medium text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {modalOpen && <AddUserModal onClose={() => setModalOpen(false)} />}
    </Card>
  );
}

function AddUserModal({ onClose }: { onClose: () => void }) {
  const { companyId } = useCompany();
  const { notify } = useToast();
  const queryClient = useQueryClient();

  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>('accountant');
  const [error, setError] = useState('');

  const mutation = useMutation({
    mutationFn: () => addCompanyUser(companyId!, { email, name: name || undefined, password: password || undefined, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-users', companyId] });
      notify('User added');
      onClose();
    },
    onError: (err) => setError(apiErrorMessage(err, 'Could not add user')),
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    mutation.mutate();
  }

  return (
    <Modal open onClose={onClose} title="Add a user">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} hint="If they already have an account, we'll just grant access" />
        <Input label="Full name" value={name} onChange={(e) => setName(e.target.value)} hint="Only needed for a brand-new user" />
        <Input label="Temporary password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} hint="Only needed for a brand-new user (min. 6 characters)" />
        <Select label="Role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
          <option value="admin">Admin — full access, manages users & settings</option>
          <option value="accountant">Accountant — can create & edit records</option>
          <option value="viewer">Viewer — read-only access</option>
        </Select>
        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={mutation.isPending}>
            Add user
          </Button>
        </div>
      </form>
    </Modal>
  );
}
