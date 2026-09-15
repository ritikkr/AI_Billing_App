import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { apiErrorMessage } from '../../api/client';
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp } from '../../api/auth';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function requestCode(): Promise<boolean> {
    setError('');
    setLoading(true);
    try {
      await apiSendOtp(email);
      setInfo(`We sent a 6-digit code to ${email.toLowerCase()}`);
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send verification code'));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleDetailsSubmit(e: FormEvent) {
    e.preventDefault();
    if (await requestCode()) setStep('otp');
  }

  async function handleOtpSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { verificationToken } = await apiVerifyOtp(email, otp);
      await register(name, email, password, verificationToken);
      navigate('/companies/new', { replace: true });
    } catch (err) {
      setError(apiErrorMessage(err, 'Verification failed'));
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
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">
            {step === 'details' ? 'Create your account' : 'Verify your email'}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {step === 'details' ? 'Start billing in minutes' : `Enter the code sent to ${email.toLowerCase()}`}
          </p>
        </div>

        {step === 'details' ? (
          <form
            onSubmit={handleDetailsSubmit}
            className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7"
          >
            {error && (
              <div role="alert" className="animate-fade-in rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
            <Input
              label="Full name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ankit Ojha"
              autoComplete="name"
              name="name"
            />
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              name="email"
              spellCheck={false}
            />
            <Input
              label="Password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              name="password"
            />
            <p className="text-xs text-slate-400">
              We'll send a verification code to this email before your account is created.
            </p>
            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleOtpSubmit}
            className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7"
          >
            {error && (
              <div role="alert" className="animate-fade-in rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">
                {error}
              </div>
            )}
            {info && (
              <div role="status" className="animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
                {info}
              </div>
            )}
            <Input
              label="Verification code"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              name="otp"
              hint="The code expires in 10 minutes"
            />
            <Button type="submit" className="w-full" loading={loading} disabled={otp.length !== 6}>
              Verify &amp; create account
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep('details');
                  setError('');
                  setInfo('');
                }}
                className="font-medium text-indigo-600 transition-colors hover:text-indigo-700"
              >
                Change email
              </button>
              <button
                type="button"
                onClick={requestCode}
                disabled={loading}
                className="font-medium text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}