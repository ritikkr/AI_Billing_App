import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { apiErrorMessage } from '../../api/client';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
      navigate('/companies/new', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not create account'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-bold text-white">₹</div>
          <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>
          <p className="mt-1 text-sm text-slate-500">Start billing in minutes</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          <Input label="Full name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ankit Ojha" />
          <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          <Input
            label="Password"
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
