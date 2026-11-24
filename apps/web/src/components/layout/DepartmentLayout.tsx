import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import {
  LogOut, LayoutDashboard, FileText, Map, Users, Menu, X, Loader2,
  Search, ShieldCheck, ShieldAlert, Building2, ChevronRight, UserRound,
  Truck, History
} from 'lucide-react';
import NotificationTray from './NotificationTray';

export default function DepartmentLayout() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const { profile, session, isLoading } = useAuth();
  const { setDepartmentCode } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [deptName, setDeptName] = useState('Workspace');
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  useEffect(() => {
    if (isLoading) return;

    if (!session) {
      navigate('/login', { replace: true });
      return;
    }

    if (profile && !profile.department_id) {
      navigate('/login', { replace: true });
      return;
    }

    if (deptCode) {
      const code = deptCode.toUpperCase() as Parameters<typeof setDepartmentCode>[0];
      setDepartmentCode(code);

      supabase
        .from('departments')
        .select('id, name')
        .eq('code', code)
        .single()
        .then(async ({ data }) => {
          if (data) {
            setDeptName(data.name);

            if (profile?.department_id && profile.department_id !== data.id) {
              await supabase.auth.signOut();
              navigate('/login', { replace: true });
            }
          }
        });
    }
  }, [deptCode, session, profile, isLoading, navigate, setDepartmentCode]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    navigate(`/dept/${deptCode}/reports?q=${encodeURIComponent(globalSearch.trim())}`);
  };

  const navLinks = profile?.role === 'admin'
    ? [
        { name: 'Dashboard', path: `/dept/${deptCode}/dashboard`, icon: LayoutDashboard },
        { name: 'Review Queue', path: `/dept/${deptCode}/review`, icon: ShieldAlert },
        { name: 'Reports', path: `/dept/${deptCode}/reports`, icon: FileText },
        { name: 'Dispatch', path: `/dept/${deptCode}/dispatch`, icon: Truck },
        { name: 'Map View', path: `/dept/${deptCode}/map`, icon: Map },
        { name: 'Audit', path: `/dept/${deptCode}/audit`, icon: History },
        { name: 'Staff', path: `/dept/${deptCode}/team`, icon: UserRound },
        { name: 'Teams', path: `/dept/${deptCode}/teams`, icon: Users },
      ]
    : [
        { name: 'Dashboard', path: `/dept/${deptCode}/dashboard`, icon: LayoutDashboard },
      { name: 'Team', path: `/dept/${deptCode}/teams`, icon: Users },
        { name: 'My Reports', path: `/dept/${deptCode}/reports`, icon: FileText },
        { name: 'My Assignments', path: `/dept/${deptCode}/dispatch`, icon: Truck },
        { name: 'Job Map', path: `/dept/${deptCode}/map`, icon: Map },
        { name: 'My Activity', path: `/dept/${deptCode}/audit`, icon: History },
      ];

  // Get active page name for breadcrumb
  const isLinkActive = (path: string) => location.pathname === path || location.pathname.startsWith(`${path}/`);
  const currentNav = navLinks.find(link => isLinkActive(link.path))?.name || 'Dashboard';

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 size={32} className="animate-spin text-primary" />
          <p className="text-sm font-medium">Loading department portal…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-white border-b border-slate-200 z-30 px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMobileOpen(true)}
            className="p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-primary text-white rounded-lg flex items-center justify-center">
              <Building2 size={15} />
            </div>
            <span className="font-semibold text-slate-900 text-sm truncate max-w-[160px]">{deptName}</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <NotificationTray />
          <div className="w-7 h-7 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-xs font-semibold text-slate-700">
            {profile?.full_name?.charAt(0) || 'U'}
          </div>
        </div>
      </div>

      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-900/50 z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Left Sidebar */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full w-64 bg-white border-r border-slate-200 flex flex-col z-50 transform transition-transform duration-200 ease-in-out
        ${isMobileOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand / Municipal Identity */}
        <div className="p-5 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <img
                src="/bedrock-logo.png"
                alt="Bedrock"
                className="h-12 w-40 object-cover object-center"
              />
              <p className="mt-1 text-[11px] font-medium tracking-wide text-slate-500">
                Community Reporting Survey
              </p>
            </div>
            <button
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              onClick={() => setIsMobileOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Department Badge */}
          <div className="mt-3.5 px-2.5 py-1.5 bg-[#f0f6f0] border border-[#dce9dd] rounded-lg flex items-center justify-between">
            <div className="flex items-center space-x-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#f58208] shrink-0" />
              <span className="text-xs font-semibold text-slate-800 truncate">{deptName}</span>
            </div>
            <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-white text-slate-500 border border-slate-200 shrink-0">
              {deptCode?.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Workspace
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = isLinkActive(link.path);

            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-[#eaf3eb] text-[#07382d] font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon
                    size={17}
                    className={isActive ? 'text-[#0b4b3b]' : 'text-slate-400'}
                  />
                  <span>{link.name}</span>
                </div>
                {isActive && <ChevronRight size={14} className="text-slate-400" />}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-slate-200 bg-slate-50/50">
          <div className="p-2.5 bg-white border border-slate-200 rounded-lg flex items-center justify-between shadow-2xs mb-2">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {profile?.full_name || 'Staff User'}
                </p>
                <div className="flex items-center gap-1 text-[11px] text-slate-500 capitalize">
                  <ShieldCheck size={12} className="text-primary" />
                  <span>{profile?.role || 'Staff'}</span>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-transparent transition-colors"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden bg-[#f7f7f2] flex flex-col pt-14 md:pt-0">
        {/* Top Header */}
        <header className="hidden md:flex h-14 bg-white border-b border-slate-200 items-center justify-between px-6 shrink-0 z-20">
          {/* Breadcrumbs */}
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span>Bedrock</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-700 font-medium">{deptName}</span>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 font-semibold">{currentNav}</span>
          </div>

          {/* Search Box */}
          <form onSubmit={handleSearchSubmit} className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder={profile?.role === 'admin'
                ? 'Search department reports...'
                : 'Search my assigned reports...'}
              className="w-full pl-8 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </form>

          {/* Right Status & Notifications */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-1.5 text-xs text-slate-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="font-medium text-slate-600">Operational</span>
            </div>
            <div className="w-[1px] h-4 bg-slate-200" />
            <NotificationTray />
          </div>
        </header>

        {/* Scrollable Page Body */}
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
