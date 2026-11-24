import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, MapPin, Truck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { DepartmentWorkReport, useDepartmentReports } from '../../hooks/useDepartmentReports';

interface DispatchStage {
  key: string;
  title: string;
  description: string;
  reports: DepartmentWorkReport[];
  icon: ReactNode;
  color: string;
}

function hasFieldAssignment(report: DepartmentWorkReport) {
  return Boolean(
    report.assignments?.assigned_to
    || report.assignments?.teams
    || report.assignments?.assignment_members?.length
  );
}

export default function Dispatch() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const { reports, loading, error } = useDepartmentReports();

  const openReports = useMemo(
    () => reports.filter(report => !['RESOLVED', 'REJECTED'].includes(report.status)),
    [reports]
  );
  const completedCount = reports.filter(report => ['RESOLVED', 'REJECTED'].includes(report.status)).length;
  const recentCompletedReports = useMemo(
    () => reports
      .filter(report => ['RESOLVED', 'REJECTED'].includes(report.status))
      .sort((left, right) => new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime())
      .slice(0, 20),
    [reports]
  );
  const urgentCount = openReports.filter(report =>
    report.immediate_danger === 'yes'
    || ['critical', 'high'].includes(report.severity?.toLowerCase())
  ).length;

  const stages = useMemo<DispatchStage[]>(() => isAdmin
    ? [
        {
          key: 'unassigned',
          title: 'Needs assignment',
          description: 'Open reports not yet assigned to a field team or worker.',
          reports: openReports.filter(report => !hasFieldAssignment(report)),
          icon: <AlertCircle size={15} />,
          color: 'text-amber-700',
        },
        {
          key: 'assigned',
          title: 'Assigned',
          description: 'Assigned reports awaiting field work.',
          reports: openReports.filter(report => hasFieldAssignment(report) && report.status !== 'IN_PROGRESS'),
          icon: <Users size={15} />,
          color: 'text-blue-700',
        },
        {
          key: 'in_progress',
          title: 'In progress',
          description: 'Work currently underway.',
          reports: openReports.filter(report => report.status === 'IN_PROGRESS'),
          icon: <Truck size={15} />,
          color: 'text-emerald-700',
        },
      ]
    : [
        {
          key: 'ready',
          title: 'Ready to start',
          description: 'Your assigned jobs waiting for field work.',
          reports: openReports.filter(report => report.status !== 'IN_PROGRESS'),
          icon: <Clock size={15} />,
          color: 'text-blue-700',
        },
        {
          key: 'in_progress',
          title: 'In progress',
          description: 'Your field work currently underway.',
          reports: openReports.filter(report => report.status === 'IN_PROGRESS'),
          icon: <Truck size={15} />,
          color: 'text-emerald-700',
        },
        {
          key: 'completed',
          title: 'Completed',
          description: 'Your recently resolved or closed assignments.',
          reports: recentCompletedReports,
          icon: <CheckCircle2 size={15} />,
          color: 'text-slate-600',
        },
      ], [isAdmin, openReports, recentCompletedReports]);

  const metrics = isAdmin
    ? [
        { label: 'Open workload', value: openReports.length, icon: <Truck size={16} />, color: 'text-slate-500' },
        { label: 'Needs assignment', value: stages.find(stage => stage.key === 'unassigned')?.reports.length || 0, icon: <AlertCircle size={16} />, color: 'text-amber-700' },
        { label: 'Assigned', value: stages.find(stage => stage.key === 'assigned')?.reports.length || 0, icon: <Users size={16} />, color: 'text-blue-700' },
        { label: 'In progress', value: openReports.filter(report => report.status === 'IN_PROGRESS').length, icon: <Clock size={16} />, color: 'text-emerald-700' },
      ]
    : [
        { label: 'My open jobs', value: openReports.length, icon: <Truck size={16} />, color: 'text-slate-500' },
        { label: 'Urgent jobs', value: urgentCount, icon: <AlertCircle size={16} />, color: 'text-amber-700' },
        { label: 'In progress', value: openReports.filter(report => report.status === 'IN_PROGRESS').length, icon: <Clock size={16} />, color: 'text-emerald-700' },
        { label: 'Completed', value: completedCount, icon: <CheckCircle2 size={16} />, color: 'text-slate-600' },
      ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          {isAdmin ? 'Dispatch & Field Operations' : 'My Assignments & Field Work'}
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {isAdmin
            ? 'Track department-wide assignment and field-work stages.'
            : 'Work only on reports assigned to you. Assignment and dispatch are managed by department admins.'}
        </p>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        {metrics.map(metric => (
          <div key={metric.label} className="enterprise-card p-4">
            <div className={`flex items-center justify-between ${metric.color}`}>
              <span className="text-xs font-semibold uppercase tracking-wide">{metric.label}</span>
              {metric.icon}
            </div>
            <p className="text-2xl font-bold text-slate-900 mt-2">{loading ? '—' : metric.value}</p>
          </div>
        ))}
      </section>

      {loading ? (
        <div className="enterprise-card p-10 text-center text-xs text-slate-500">
          {isAdmin ? 'Loading operational board…' : 'Loading your assignments…'}
        </div>
      ) : error ? (
        <div role="alert" className="enterprise-card p-8 text-center text-sm text-red-700">
          Could not load dispatch reports: {error}
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 items-start">
          {stages.map(stage => (
            <div key={stage.key} className="enterprise-card overflow-hidden">
              <header className="p-4 border-b border-slate-100">
                <div className={`flex items-center justify-between ${stage.color}`}>
                  <h2 className="flex items-center gap-2 text-sm font-bold">
                    {stage.icon}
                    {stage.title}
                  </h2>
                  <span className="text-xs font-bold">{stage.reports.length}</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">{stage.description}</p>
              </header>

              <div className="p-3 space-y-3">
                {stage.reports.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400">
                    <CheckCircle2 size={20} className="mx-auto mb-2 text-emerald-600" />
                    Nothing in this stage.
                  </div>
                ) : stage.reports.map(report => {
                  const hasAssignment = hasFieldAssignment(report);
                  const assignmentName = hasAssignment
                    ? report.assignments?.teams?.name
                      || report.assignments?.profiles?.full_name
                      || 'Assigned team or worker'
                    : null;
                  const memberCount = report.assignments?.assignment_members?.length || 0;

                  return (
                    <article key={report.id} className="rounded-lg border border-slate-200 bg-white p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[10px] text-slate-500">#{report.id.slice(0, 8)}</span>
                        <span className={`text-[10px] font-semibold uppercase ${
                          report.severity?.toLowerCase() === 'critical'
                            ? 'text-red-700'
                            : report.severity?.toLowerCase() === 'high'
                              ? 'text-amber-700'
                              : 'text-slate-500'
                        }`}>
                          {report.severity || 'Normal'}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 mt-2">
                        {report.categories?.name || 'Uncategorized'}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                        {report.description || 'No detailed description provided.'}
                      </p>
                      {report.immediate_danger === 'yes' && (
                        <p className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700 mt-2">
                          <AlertCircle size={11} /> Immediate danger reported
                        </p>
                      )}
                      {report.address && (
                        <p className="inline-flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                          <MapPin size={10} /> {report.address}
                        </p>
                      )}
                      {assignmentName && (
                        <p className="text-[10px] text-slate-500 mt-2">
                          <span className="font-semibold">Assigned:</span> {assignmentName}
                          {memberCount > 0 ? ` · ${memberCount} team members` : ''}
                        </p>
                      )}
                      <div className="flex items-center justify-between gap-2 mt-3 pt-2 border-t border-slate-100">
                        <span className="text-[10px] text-slate-400">
                          {new Date(report.created_at).toLocaleDateString()}
                        </span>
                        <Link
                          to={`/dept/${deptCode}/reports/${report.id}`}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline"
                        >
                          {isAdmin && !hasAssignment ? 'Assign' : isAdmin ? 'Open task' : 'Open work order'}
                          <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
