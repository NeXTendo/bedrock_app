import { useState, useEffect, useRef, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Shield,
  Eye,
  EyeOff,
  LogIn,
  AlertCircle,
  Building2,
  ChevronDown,
  Lock,
} from 'lucide-react';

interface Department {
  id: string;
  name: string;
  code: string;
}

const DEPT_ICONS: Record<string, string> = {
  ROADS:  '🚧',
  WATER:  '💧',
  WASTE:  '♻️',
  HEALTH: '🏥',
  ZONING: '🏙️',
};

export default function Login() {
  const [departments, setDepartments]     = useState<Department[]>([]);
  const [selectedDept, setSelectedDept]   = useState('');
  const [email, setEmail]                 = useState('');
  const [password, setPassword]           = useState('');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [deptOpen, setDeptOpen]           = useState(false);
  const dropdownRef                       = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();
  const { session, profile, isLoading } = useAuth();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDeptOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
      setError('Please select your department before signing in.');
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
      setError('Could not load your profile. Please contact your administrator.');
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Step 3: Block citizens (no department assigned)
    if (!profileData.department_id) {
      await supabase.auth.signOut();
      setError(
        'Access denied. This portal is for authorised department staff only. ' +
        'Citizens cannot sign in here.'
      );
      setLoading(false);
      return;
    }

    // Step 4: Verify the user belongs to the selected department
    if (profileData.department_id !== selectedDept) {
      await supabase.auth.signOut();
      setError(
        `Access denied. You are not a member of the ${selectedDeptObj?.name ?? 'selected'} department.`
      );
      setLoading(false);
      return;
    }

    // All checks passed — navigate to the department dashboard
    navigate(`/dept/${selectedDeptObj!.code.toLowerCase()}/dashboard`);
  };

  return (
    <div className="min-h-screen flex bg-slate-50 relative overflow-hidden">
      {/* Decorative background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-400 rounded-full opacity-10 blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] bg-indigo-500 rounded-full opacity-10 blur-3xl" />
      </div>

      {/* ─── Left branding panel ─── */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 p-16 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white relative overflow-hidden">
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage:
              'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
              <Shield size={22} />
            </div>
            <span className="text-2xl font-extrabold tracking-tight">Bedrock Platform</span>
          </div>
          <p className="text-slate-400 text-sm">City Management System</p>
        </div>

        {/* Quote + Stats */}
        <div className="relative z-10 space-y-8">
          <blockquote className="text-2xl font-bold leading-relaxed text-white/90">
            "Empowering city departments to resolve citizen reports faster, smarter, and together."
          </blockquote>

          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Departments',     value: '5'    },
              { label: 'Avg. Resolution', value: '3.2d' },
              { label: 'Reports Resolved',value: '12k+' },
            ].map(stat => (
              <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-2xl font-extrabold text-white">{stat.value}</p>
                <p className="text-sm text-slate-400 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {departments.length > 0
              ? departments.map(d => (
                  <span
                    key={d.id}
                    className="px-3 py-1 bg-white/10 border border-white/10 text-white/70 rounded-full text-xs font-medium"
                  >
                    {DEPT_ICONS[d.code] ?? '🏛️'} {d.name}
                  </span>
                ))
              : ['Roads & Infrastructure', 'Water & Sanitation', 'Waste Management', 'Public Health', 'City Planning'].map(d => (
                  <span key={d} className="px-3 py-1 bg-white/10 border border-white/10 text-white/70 rounded-full text-xs font-medium">
                    {d}
                  </span>
                ))
            }
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">© 2025 Bedrock Platform · Government Use Only</p>
      </div>

      {/* ─── Right login form ─── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-md">

          {/* Mobile branding */}
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <p className="text-lg font-extrabold text-slate-900">Bedrock Platform</p>
              <p className="text-xs text-slate-500">City Management System</p>
            </div>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Department Sign In</h1>
            <p className="text-slate-500 mt-2">Select your department and sign in securely.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* ── Department Selector ── */}
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-slate-700">
                Department
              </label>
              <div className="relative" ref={dropdownRef}>
                <button
                  id="dept-select-btn"
                  type="button"
                  onClick={() => setDeptOpen(o => !o)}
                  className={`w-full flex items-center justify-between px-4 py-3 bg-white border rounded-xl text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 ${
                    selectedDept ? 'border-slate-300 text-slate-900' : 'border-slate-200 text-slate-400'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {selectedDeptObj ? (
                      <>
                        <span className="text-base">{DEPT_ICONS[selectedDeptObj.code] ?? '🏛️'}</span>
                        <span className="font-semibold text-slate-800">{selectedDeptObj.name}</span>
                      </>
                    ) : (
                      <>
                        <Building2 size={16} className="text-slate-400" />
                        <span>Select your department</span>
                      </>
                    )}
                  </span>
                  <ChevronDown
                    size={18}
                    className={`text-slate-400 transition-transform duration-200 ${deptOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                {/* Dropdown list */}
                {deptOpen && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                    {departments.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-slate-400">Loading departments…</div>
                    ) : (
                      departments.map(dept => (
                        <button
                          key={dept.id}
                          type="button"
                          id={`dept-option-${dept.code.toLowerCase()}`}
                          onClick={() => {
                            setSelectedDept(dept.id);
                            setDeptOpen(false);
                            setError(null);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm font-medium transition-colors hover:bg-blue-50 ${
                            selectedDept === dept.id
                              ? 'bg-blue-50 text-blue-700'
                              : 'text-slate-700'
                          }`}
                        >
                          <span className="text-base">{DEPT_ICONS[dept.code] ?? '🏛️'}</span>
                          <div>
                            <p className="font-semibold">{dept.name}</p>
                            <p className="text-xs text-slate-400 font-normal">{dept.code}</p>
                          </div>
                          {selectedDept === dept.id && (
                            <span className="ml-auto text-blue-600">✓</span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Email ── */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-bold text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                placeholder="official@cityname.gov.zm"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            {/* ── Password ── */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-bold text-slate-700">
                Password
              </label>
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={16} />
                </div>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  className="w-full pl-10 pr-12 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* ── Error ── */}
            {error && (
              <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-700 text-sm font-medium p-4 rounded-xl">
                <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            {/* ── Submit ── */}
            <button
              id="login-submit-btn"
              type="submit"
              disabled={loading || !selectedDept}
              className="w-full flex items-center justify-center gap-2 py-3 px-6 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-base font-bold rounded-xl shadow-lg shadow-blue-500/25 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying access…</span>
                </>
              ) : (
                <>
                  <LogIn size={20} />
                  <span>Sign In to Platform</span>
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs text-slate-400 leading-relaxed">
            This is a secure government system. Unauthorised access is a criminal offence.<br />
            All sessions are logged and monitored.
          </p>
        </div>
      </div>

    </div>
  );
}
