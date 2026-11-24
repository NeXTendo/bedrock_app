import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function ResetPassword() {
  const { session, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [completed, setCompleted] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password.length < 12) {
      setError('Use a password with at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setSaving(true);
    const { error: passwordError } = await supabase.auth.updateUser({ password });
    if (passwordError) {
      setError(`Your password could not be changed: ${passwordError.message}`);
      setSaving(false);
      return;
    }

    const { error: signOutError } = await supabase.auth.signOut({ scope: 'global' });
    if (signOutError) {
      console.error('Password changed, but all sessions could not be invalidated:', signOutError);
      const { error: localSignOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (localSignOutError) {
        console.error('Could not sign out the password recovery session:', localSignOutError);
      }
      setSessionWarning(true);
    }

    setCompleted(true);
    setSaving(false);
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2]">
        <p className="text-sm text-slate-600">Verifying your recovery link…</p>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b4b3b]/10 text-[#0b4b3b]">
            <ShieldCheck size={22} />
          </div>
          <h1 className="text-2xl font-semibold text-slate-900">Password updated</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your password has been changed. Sign in again with your new password.
          </p>
          {sessionWarning && (
            <p role="alert" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
              We could not invalidate every existing session. This device has been signed out; contact your department administrator to secure your account.
            </p>
          )}
          <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-[#0b4b3b] hover:underline">
            Continue to sign in
          </Link>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Recovery link unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This password recovery link may have expired or already been used. Ask your department administrator to send another link.
          </p>
          <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-[#0b4b3b] hover:underline">
            Return to staff sign in
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b4b3b]/10 text-[#0b4b3b]">
          <KeyRound size={22} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b4b3b]">
          Account security
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Set a new password for {session.user.email || 'your account'}. Your other sessions will be signed out after the change.
        </p>

        {error && (
          <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm leading-5 text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="new-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              New password
            </label>
            <input
              id="new-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={12}
              required
              value={password}
              onChange={event => setPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0b4b3b] focus:ring-2 focus:ring-[#0b4b3b]/15"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password"
              minLength={12}
              required
              value={confirmPassword}
              onChange={event => setConfirmPassword(event.target.value)}
              className="h-11 w-full rounded-md border border-slate-300 px-3 text-sm outline-none focus:border-[#0b4b3b] focus:ring-2 focus:ring-[#0b4b3b]/15"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowPasswords(current => !current)}
            className="inline-flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-[#0b4b3b]"
            aria-pressed={showPasswords}
          >
            {showPasswords ? <EyeOff size={15} /> : <Eye size={15} />}
            {showPasswords ? 'Hide passwords' : 'Show passwords'}
          </button>

          <p className="text-xs leading-5 text-slate-500">
            Use at least 12 characters. Administrators cannot view your password.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#0b4b3b] px-4 text-sm font-semibold text-white transition hover:bg-[#07382d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Updating password…' : 'Update password'}
          </button>
        </form>
      </section>
    </main>
  );
}
