import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { apiErrorMessage } from '../../api/client';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to={(location.state as any)?.from || '/'} replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Invalid email or password'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(42rem 30rem at 20% -10%, rgb(99 102 241 / 0.14), transparent 60%), radial-gradient(36rem 26rem at 95% 15%, rgb(16 185 129 / 0.1), transparent 60%), radial-gradient(40rem 34rem at 50% 115%, rgb(251 146 60 / 0.09), transparent 60%)',
        }}
        aria-hidden
      />
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center">
          <Logo size="lg" withText={false} />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-500">Sign in to your GST billing dashboard</p>
        </div>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7"
        >
          {error && <div role="alert" className="animate-fade-in rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" name="email" spellCheck={false} />
          <Input label="Password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" name="password" />
          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          New here?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}