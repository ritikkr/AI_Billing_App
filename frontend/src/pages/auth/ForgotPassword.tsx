import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Logo } from '../../components/ui/Logo';
import { apiErrorMessage } from '../../api/client';
import { sendOtp as apiSendOtp, verifyOtp as apiVerifyOtp, resetPassword as apiResetPassword } from '../../api/auth';

export default function ForgotPassword() {
  const { user } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function sendCode(): Promise<boolean> {
    setError('');
    setLoading(true);
    try {
      await apiSendOtp(email, 'reset');
      setInfo(`We sent a 6-digit code to ${email.toLowerCase()}`);
      return true;
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not send verification code'));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function handleEmailSubmit(e: FormEvent) {
    e.preventDefault();
    if (await sendCode()) setStep('code');
  }

  async function handleCodeSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { verificationToken } = await apiVerifyOtp(email, otp, 'reset');
      await apiResetPassword(email, password, verificationToken);
      setDone(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not reset password'));
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
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Reset your password</h1>
          <p className="mt-1 text-sm text-slate-500">We'll email you a code to verify it's you</p>
        </div>

        {done ? (
          <div className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7">
            <div role="status" className="animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">
              Your password was updated. You can now sign in.
            </div>
            <Link to="/login" className="block">
              <Button type="button" className="w-full">Go to sign in</Button>
            </Link>
          </div>
        ) : step === 'email' ? (
          <form
            onSubmit={handleEmailSubmit}
            className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7"
          >
            {error && <div role="alert" className="animate-fade-in rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
            {info && <div role="status" className="animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">{info}</div>}
            <Input label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" autoComplete="email" name="email" spellCheck={false} />
            <Button type="submit" className="w-full" loading={loading}>
              Send code
            </Button>
          </form>
        ) : (
          <form
            onSubmit={handleCodeSubmit}
            className="space-y-4 rounded-2xl border border-white/60 bg-white/90 p-6 shadow-modal ring-1 ring-slate-200/60 backdrop-blur-xl sm:p-7"
          >
            {error && <div role="alert" className="animate-fade-in rounded-xl border border-red-100 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700">{error}</div>}
            {info && <div role="status" className="animate-fade-in rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2.5 text-sm font-medium text-emerald-700">{info}</div>}
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
              hint={`Sent to ${email.toLowerCase()} · expires in 10 minutes`}
            />
            <Input
              label="New password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
              autoComplete="new-password"
              name="password"
            />
            <Button type="submit" className="w-full" loading={loading} disabled={otp.length !== 6 || password.length < 6}>
              Reset password
            </Button>
            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="font-medium text-indigo-600 transition-colors hover:text-indigo-700 disabled:opacity-60"
              >
                Resend code
              </button>
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setInfo('');
                  setStep('email');
                }}
                className="font-medium text-slate-500 transition-colors hover:text-slate-700"
              >
                Change email
              </button>
            </div>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-slate-500">
          <Link to="/login" className="font-semibold text-indigo-600 transition-colors hover:text-indigo-700">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}