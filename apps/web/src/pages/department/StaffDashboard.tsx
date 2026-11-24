import { Link } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useDepartmentReports } from '../../hooks/useDepartmentReports';

export default function StaffDashboard() {
  const { profile } = useAuth();
  const { reports, loading, error } = useDepartmentReports();
  const openReports = reports.filter(report => !['RESOLVED', 'REJECTED'].includes(report.status));
  const inProgressCount = openReports.filter(report => report.status === 'IN_PROGRESS').length;
  const urgentReports = openReports
    .filter(report => ['critical', 'high'].includes(report.severity?.toLowerCase()))
    .slice(0, 5);
  const recentReports = [...openReports]
    .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
    .slice(0, 6);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          Welcome{profile?.full_name ? `, ${profile.full_name}` : ''}
        </h1>
        <p className="text-xs text-slate-500 mt-1">Your assigned work and current field priorities.</p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-blue-700">
            <span className="text-xs font-semibold uppercase tracking-wide">My open assignments</span>
            <Truck size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : openReports.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-semibold uppercase tracking-wide">In progress</span>
            <Clock size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : inProgressCount}</p>
        </div>
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wide">Urgent assignments</span>
            <AlertCircle size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">
            {loading ? '—' : openReports.filter(report => ['critical', 'high'].includes(report.severity?.toLowerCase())).length}
          </p>
        </div>
      </section>

      {error ? (
        <div role="alert" className="enterprise-card p-6 text-sm text-red-700">
          Your assigned work could not be loaded: {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          <section className="enterprise-card overflow-hidden xl:col-span-2">
            <header className="flex items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-bold text-slate-900">My active assignments</h2>
                <p className="text-[11px] text-slate-500 mt-0.5">Only reports assigned to you are shown here.</p>
              </div>
              <Link to="../dispatch" className="text-xs font-semibold text-primary hover:underline">
                Open workboard
              </Link>
            </header>
            {loading ? (
              <div className="p-8 text-center text-xs text-slate-500">Loading your assignments…</div>
            ) : recentReports.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 size={22} className="mx-auto text-emerald-600" />
                <p className="text-sm font-semibold text-slate-800 mt-2">No active assignments</p>
                <p className="text-xs text-slate-500 mt-1">New jobs assigned to you will appear here.</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentReports.map(report => (
                  <Link
                    key={report.id}
                    to={`../reports/${report.id}`}
                    className="flex items-start justify-between gap-4 p-4 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">{report.categories?.name || 'Assigned job'}</span>
                        <span className="text-[10px] font-semibold uppercase text-slate-500">{report.status.replaceAll('_', ' ')}</span>
                        {['critical', 'high'].includes(report.severity?.toLowerCase()) && (
                          <span className="text-[10px] font-semibold text-red-700">{report.severity}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {report.description || 'No detailed description provided.'}
                      </p>
                      {report.address && <p className="text-[11px] text-slate-400 mt-1">{report.address}</p>}
                    </div>
                    <ArrowUpRight size={15} className="shrink-0 text-slate-400" />
                  </Link>
                ))}
              </div>
            )}
          </section>

          <section className="enterprise-card overflow-hidden">
            <header className="p-4 border-b border-slate-100">
              <h2 className="text-sm font-bold text-slate-900">Urgent jobs</h2>
              <p className="text-[11px] text-slate-500 mt-0.5">High and critical priority items assigned to you.</p>
            </header>
            {loading ? (
              <div className="p-6 text-center text-xs text-slate-500">Loading priorities…</div>
            ) : urgentReports.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">No urgent assigned jobs.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {urgentReports.map(report => (
                  <Link key={report.id} to={`../reports/${report.id}`} className="block p-3 hover:bg-slate-50">
                    <p className="text-xs font-semibold text-slate-900">{report.categories?.name || 'Assigned job'}</p>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                      {report.description || report.address || 'Open assigned report'}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
