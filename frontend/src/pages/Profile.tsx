import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { API_BASE_URL } from '../api/client';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { initials } from '../utils/format';

function decodeJwtExpiry(token: string): Date | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (typeof payload.exp !== 'number') return null;
    return new Date(payload.exp * 1000);
  } catch {
    return null;
  }
}

function formatExpiry(date: Date | null): string {
  if (!date) return 'Unknown';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function Profile() {
  const { user, memberships } = useAuth();
  const { notify } = useToast();
  const [copied, setCopied] = useState(false);

  const token = useMemo(() => localStorage.getItem('token') || '', []);
  const expiry = useMemo(() => decodeJwtExpiry(token), [token]);

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      notify('Auth token copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify('Could not copy token — copy it manually from the field below', 'error');
    }
  }

  const curlExample = `curl -H "Authorization: Bearer <TOKEN>" ${API_BASE_URL}/auth/me`;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
        <p className="text-sm text-slate-500">Your account details and API access token</p>
      </div>

      <Card>
        <CardHeader title="Account" subtitle="Your personal login details" />
        <CardBody className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-semibold text-white">
            {user ? initials(user.name) : '?'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
            <p className="truncate text-sm text-slate-500">{user?.email}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader title="Companies" subtitle="Companies you can access" />
          <CardBody className="space-y-2">
            {memberships.length === 0 ? (
              <p className="text-sm text-slate-500">You are not part of any company yet.</p>
            ) : (
              memberships.map((m) => (
                <div key={m.companyId} className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium text-slate-900">{m.companyName}</span>
                  <Badge>{m.role}</Badge>
                </div>
              ))
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Session" subtitle="Token details" />
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Expires</span>
              <span className="font-medium text-slate-900">{formatExpiry(expiry)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">User</span>
              <span className="font-medium text-slate-900">{user?.email || '-'}</span>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="API Access Token"
          subtitle="Use this token for backend authorization (Authorization: Bearer <token>)"
          action={
            <Button size="sm" onClick={copyToken}>
              {copied ? 'Copied' : 'Copy token'}
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Treat this like a password — anyone with this token can access your account. Never share it or commit it to a public repository.
          </div>
          {token ? (
            <>
              <Input value={token} readOnly onFocus={(e) => e.target.select()} />
              <div className="rounded-lg bg-slate-900 px-4 py-3">
                <p className="mb-1 font-mono text-[11px] uppercase tracking-wide text-slate-400">Example — get your profile</p>
                <pre className="overflow-x-auto text-xs text-emerald-300">{curlExample}</pre>
              </div>
              <p className="text-xs text-slate-500">
                The app already sends this header automatically on every request. Copy it here to use the same token with Postman, curl, or another backend client.
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">No token found. Sign in again to get a new one.</p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}