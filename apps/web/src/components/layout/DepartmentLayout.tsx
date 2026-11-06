import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import {
  LogOut, LayoutDashboard, FileText, Map, Users, Menu, X, Loader2,
  Search, ShieldCheck, ChevronRight
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

  const navLinks = [
    { name: 'Command Center', path: `/dept/${deptCode}/dashboard`, icon: LayoutDashboard },
    { name: 'Incident Reports', path: `/dept/${deptCode}/reports`, icon: FileText },
    { name: 'Geospatial Map', path: `/dept/${deptCode}/map`, icon: Map },
  ];

  if (profile?.role === 'admin') {
    navLinks.push({ name: 'Personnel & Teams', path: `/dept/${deptCode}/team`, icon: Users });
  }

  // Show a full-screen spinner while auth state resolves
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 size={40} className="animate-spin text-primary" />
          <p className="text-sm font-semibold tracking-tight">Initializing Command Center…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden relative">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 z-30 px-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <button onClick={() => setIsMobileOpen(true)} className="p-2 -ml-2 text-slate-600 hover:text-primary rounded-xl focus:outline-none">
            <Menu size={22} />
          </button>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary text-white rounded-xl flex items-center justify-center shadow-sm">
              <LayoutDashboard size={16} />
            </div>
            <span className="font-black text-slate-900 text-sm truncate max-w-[160px]">{deptName}</span>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <NotificationTray />
          <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 font-bold text-xs">
                {profile?.full_name?.charAt(0) || 'U'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Backdrop */}
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-40 transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <aside className={`
        fixed md:relative top-0 left-0 h-full w-72 bg-white border-r border-slate-200/80 flex flex-col z-50 transform transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Brand Department Identity */}
        <div className="p-6 flex flex-col relative bg-slate-50/50 border-b border-slate-100">
          <button
            className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-lg"
            onClick={() => setIsMobileOpen(false)}
          >
            <X size={20} />
          </button>

          <div className="flex items-center space-x-3 mb-2">
            <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25">
              <LayoutDashboard size={24} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Municipal Portal</span>
              <h2 className="text-base font-black text-slate-900 leading-tight">
                {deptName}
              </h2>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/60 w-fit">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 glow-pulse" />
            <span>Operational · Realtime</span>
          </div>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 px-3 py-6 space-y-1.5 overflow-y-auto">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">
            Operations Menu
          </div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname.startsWith(link.path);

            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center justify-between px-3.5 py-3 rounded-2xl font-bold text-sm transition-all duration-200 group
                  ${isActive
                    ? 'bg-primary text-white shadow-md shadow-primary/25'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  <Icon size={19} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-600'} />
                  <span>{link.name}</span>
                </div>
                {isActive && <ChevronRight size={16} className="text-white/80" />}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Sign Out */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/40">
          <div className="flex items-center space-x-3 mb-3.5 p-2 rounded-xl bg-white border border-slate-100 shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary font-black text-sm flex items-center justify-center shrink-0 border border-primary/20">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover rounded-xl" />
              ) : (
                profile?.full_name?.charAt(0) || 'U'
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-slate-900 truncate">
                {profile?.full_name || 'Staff User'}
              </p>
              <p className="text-[10px] text-slate-400 truncate capitalize font-semibold flex items-center gap-1">
                <ShieldCheck size={11} className="text-primary" />
                {profile?.role}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-2 px-3 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all shadow-xs"
          >
            <LogOut size={15} />
            <span>Sign Out Workspace</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden bg-slate-50/50 relative flex flex-col pt-16 md:pt-0">
        {/* Desktop Header with Global Search & Status */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200/70 items-center justify-between px-8 shrink-0 relative z-20 shadow-xs">
          {/* Left Breadcrumbs / Title */}
          <div className="flex items-center space-x-2 text-xs font-medium text-slate-500">
            <span className="text-slate-400">Lusaka City Council</span>
            <span>/</span>
            <span className="font-bold text-slate-800">{deptName}</span>
          </div>

          {/* Center Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative w-96">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              type="text"
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Search reports by ID, location, or issue description..."
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-inner"
            />
          </form>

          {/* Right Notifications & Profile */}
          <div className="flex items-center space-x-4">
            <NotificationTray />
            <div className="w-[1px] h-5 bg-slate-200" />
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 font-black text-xs">
                    {profile?.full_name?.charAt(0) || 'U'}
                  </div>
                )}
              </div>
              <div className="text-left">
                <p className="text-xs font-black text-slate-900 leading-none">{profile?.full_name || 'Staff User'}</p>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{profile?.role}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <div className="flex-1 overflow-auto relative">
          <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10 relative z-10">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
