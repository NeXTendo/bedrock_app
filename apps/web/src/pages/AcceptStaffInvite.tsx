import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function AcceptStaffInvite() {
  const navigate = useNavigate();
  const { session, profile, isLoading } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2]">
        <p className="text-sm text-slate-600">Verifying your invitation…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Invitation unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            This invitation link may have expired or already been used. Ask your department administrator to send a new invitation.
          </p>
          <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-[#0b4b3b] hover:underline">
            Return to staff sign in
          </Link>
        </section>
      </main>
    );
  }

  if (
    !profile
    || !profile.department_id
    || profile.is_suspended
    || !['admin', 'staff'].includes(profile.role)
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
        <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Staff access not ready</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Your invitation is authenticated, but no active department staff profile was found. Contact your department administrator.
          </p>
          <Link to="/login" className="mt-6 inline-flex text-sm font-semibold text-[#0b4b3b] hover:underline">
            Return to staff sign in
          </Link>
        </section>
      </main>
    );
  }

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
      setError(`Your password could not be set: ${passwordError.message}`);
      setSaving(false);
      return;
    }

    const { data: department, error: departmentError } = await supabase
      .from('departments')
      .select('code')
      .eq('id', profile.department_id)
      .single();

    if (departmentError || !department) {
      console.error('Password was set, but the staff department could not be loaded:', departmentError);
      setError('Your password was set, but your department workspace could not be opened. Please sign in or contact your administrator.');
      setSaving(false);
      return;
    }

    navigate(`/dept/${department.code.toLowerCase()}/dashboard`, { replace: true });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f7f2] px-5 py-10">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-[#0b4b3b]/10 text-[#0b4b3b]">
          <KeyRound size={22} />
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b4b3b]">
          Department workspace
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Set your password</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Create a password for {session.user.email || 'your staff account'} to finish accepting your invitation.
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
              Confirm password
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
            Use at least 12 characters. Bedrock staff will never ask you to share your password.
          </p>

          <button
            type="submit"
            disabled={saving}
            className="flex h-11 w-full items-center justify-center rounded-md bg-[#0b4b3b] px-4 text-sm font-semibold text-white transition hover:bg-[#07382d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving password…' : 'Set password and continue'}
          </button>
        </form>

        <p className="mt-6 flex items-start gap-2 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">
          <ShieldCheck size={15} className="mt-0.5 shrink-0 text-[#0b4b3b]" />
          Your password is private. Department administrators cannot view it.
        </p>
      </section>
    </main>
  );
}
