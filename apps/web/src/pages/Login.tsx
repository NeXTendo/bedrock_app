import { useState, useEffect, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Eye,
  EyeOff,
  AlertCircle,
  Lock,
  Mail,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

const TEST_ACCOUNTS = [
  { code: 'ROADS', label: 'Roads Admin', role: 'admin' },
  { code: 'ROADS', label: 'Roads Staff', role: 'staff' },
  { code: 'WATER', label: 'Water Admin', role: 'admin' },
  { code: 'WATER', label: 'Water Staff', role: 'staff' },
  { code: 'WASTE', label: 'Waste Admin', role: 'admin' },
  { code: 'HEALTH', label: 'Health Admin', role: 'admin' },
  { code: 'ZONING', label: 'Zoning Admin', role: 'admin' },
] as const;

export default function Login() {
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [selectedDept, setSelectedDept]   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);

  const navigate = useNavigate();
  const { session, profile, isLoading } = useAuth();

  // Fetch departments on mount
  useEffect(() => {
    supabase
      .from('departments')
      .select('id, name, code')
      .order('name')
      .then(({ data }) => {
        if (data) setDepartments(data);
      });
  }, []);

  // Auto-redirect if already authenticated
  useEffect(() => {
    if (!isLoading && session && profile?.department_id) {
      supabase
        .from('departments')
        .select('code')
        .eq('id', profile.department_id)
        .single()
        .then(({ data }) => {
          if (data?.code) navigate(`/dept/${data.code.toLowerCase()}/dashboard`);
        });
    }
  }, [isLoading, session, profile, navigate]);

  const selectedDeptObj = departments.find(d => d.id === selectedDept);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedDept) {
      setError('Please select your assigned department before signing in.');
      return;
    }

    setLoading(true);

    // Step 1: Sign in with Supabase
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    // Step 2: Fetch the signed-in user's profile
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Authentication failed. Please try again.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('department_id, role')
      .eq('id', user.id)
      .single();

    if (profileError || !profileData) {
      setError('Could not load your departmental credentials. Please contact your system administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Step 3: Block citizens (no department assigned)
    if (!profileData.department_id) {
      await supabase.auth.signOut();
      setError(
        'This workspace is for department staff. Citizen reports are submitted through the Bedrock mobile application.'
      );
      setLoading(false);
      return;
    }

    // Step 4: Verify the user belongs to the selected department
    if (profileData.department_id !== selectedDept) {
      await supabase.auth.signOut();
      setError(
        `Department mismatch. Your credentials are not assigned to the ${selectedDeptObj?.name ?? 'selected'} department.`
      );
      setLoading(false);
      return;
    }

    navigate(`/dept/${selectedDeptObj!.code.toLowerCase()}/dashboard`);
  };

  // Quick fill helper for developers/testers
  const handleQuickFill = (deptCode: string, userType: 'admin' | 'staff') => {
    const dept = departments.find(d => d.code === deptCode);
    if (dept) {
      setSelectedDept(dept.id);
      setEmail(`${deptCode.toLowerCase()}.${userType}@lusakacity.gov.zm`);
      setPassword('Test@12345');
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f7f2] text-slate-900">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.05fr)_minmax(460px,.95fr)]">
        <section className="hidden flex-col justify-between bg-[#07382d] px-10 py-10 text-white lg:flex xl:px-16">
          <div>
            <div className="inline-flex h-[72px] items-center rounded-xl bg-[#fbfaf4] px-3">
              <img src="/bedrock-logo.png" alt="Bedrock" className="h-16 w-36 object-cover" />
            </div>

            <div className="mt-16 max-w-xl">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#f7b45d]">
                <span className="h-px w-6 bg-[#f58208]" />
                Community reporting · Operations
              </p>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.12] tracking-tight xl:text-5xl">
                Reports matter.
                <span className="mt-1 block text-[#f5a43a]">So does what happens next.</span>
              </h1>
              <p className="mt-5 max-w-lg text-sm leading-7 text-white/75">
                Bedrock gives department teams one place to review community reports, coordinate a response, and follow each issue through.
              </p>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-white/15 border-y border-white/15 py-5">
              {[
                ['01', 'Review', 'Incoming reports'],
                ['02', 'Coordinate', 'Team response'],
                ['03', 'Follow through', 'Resolution updates'],
              ].map(([step, title, detail]) => (
                <div key={step} className="px-4 first:pl-0 last:pr-0">
                  <span className="text-[10px] font-semibold tracking-widest text-[#f7b45d]">{step}</span>
                  <p className="mt-2 text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-white/60">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-white/60">
            <span>A better community, together.</span>
            <span className="flex items-center gap-2">
              <span>Report</span>
              <span className="text-[#f58208]">·</span>
              <span>Track</span>
              <span className="text-[#f58208]">·</span>
              <span>Improve</span>
            </span>
          </div>
        </section>

        <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-[430px]">
            <div className="mb-10 flex items-center gap-4 lg:hidden">
              <div className="inline-flex h-14 items-center rounded-lg bg-white px-2 shadow-sm">
                <img src="/bedrock-logo.png" alt="Bedrock" className="h-12 w-28 object-cover" />
              </div>
              <span className="text-xs font-medium tracking-wide text-slate-500">Department workspace</span>
            </div>

            <div className="mb-8">
              <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0b4b3b]">
                <span className="h-px w-5 bg-[#f58208]" />
                Workspace access
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#15352b]">Welcome back</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
                Select your department and sign in with your work credentials.
              </p>
            </div>

            {error && (
              <div className="mb-6 flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                <AlertCircle size={17} className="mt-0.5 shrink-0 text-red-600" />
                <div className="leading-6">{error}</div>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="department" className="block text-sm font-medium text-slate-700">
                  Department
                </label>
                <div className="relative">
                  <select
                    id="department"
                    value={selectedDept}
                    onChange={e => setSelectedDept(e.target.value)}
                    className="h-12 w-full appearance-none rounded-md border border-[#d6ded5] bg-white px-3.5 pr-10 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#0b4b3b] focus:ring-2 focus:ring-[#0b4b3b]/15"
                  >
                    <option value="">Choose your department</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                  Work email
                </label>
                <div className="relative">
                  <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@organization.com"
                    className="h-12 w-full rounded-md border border-[#d6ded5] bg-white pl-10 pr-3.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b4b3b] focus:ring-2 focus:ring-[#0b4b3b]/15"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-slate-700">
                  Password
                </label>
                <div className="relative">
                  <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-md border border-[#d6ded5] bg-white pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[#0b4b3b] focus:ring-2 focus:ring-[#0b4b3b]/15"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 transition hover:text-[#0b4b3b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4b3b]"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#0b4b3b] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#07382d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4b3b] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    <span>Signing in…</span>
                  </>
                ) : (
                  <>
                    <span>Continue to workspace</span>
                    <ArrowRight size={16} className="text-[#f7b45d]" />
                  </>
                )}
              </button>
            </form>

            <p className="mt-5 flex items-center gap-2 text-xs leading-5 text-slate-500">
              <ShieldCheck size={15} className="shrink-0 text-[#0b4b3b]" />
              Access is limited to staff assigned to a department workspace.
            </p>

            {import.meta.env.DEV && (
              <div className="mt-8 border-t border-[#e1e5dc] pt-5">
                <details className="group text-xs">
                  <summary className="flex cursor-pointer list-none items-center justify-between py-1 font-medium text-slate-500 transition hover:text-[#0b4b3b]">
                    <span>Developer test accounts</span>
                    <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="mt-3 space-y-3 rounded-lg border border-[#e1e5dc] bg-white/70 p-3">
                    <p className="text-[11px] leading-5 text-slate-500">
                      Select a test account to fill the sign-in form. Password:{' '}
                      <code className="rounded bg-[#f0f3ed] px-1.5 py-0.5 font-mono text-slate-700">Test@12345</code>
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TEST_ACCOUNTS.map(account => (
                        <button
                          key={`${account.code}-${account.role}`}
                          type="button"
                          onClick={() => handleQuickFill(account.code, account.role)}
                          className="truncate rounded border border-[#e1e5dc] bg-white px-2.5 py-2 text-left text-[11px] font-medium text-slate-600 transition hover:border-[#b8ccbc] hover:text-[#0b4b3b]"
                        >
                          {account.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </details>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
