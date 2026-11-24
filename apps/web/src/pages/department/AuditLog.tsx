import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock, EyeOff, FileText, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

type AuditFilter = 'all' | 'status' | 'visibility_review';

interface AuditEvent {
  event_id: string;
  event_type: 'status' | 'visibility_review';
  report_id: string;
  actor_name: string | null;
  old_status: string | null;
  new_status: string | null;
  decision: 'published' | 'withheld' | null;
  note: string | null;
  approved_photo_ids: string[];
  occurred_at: string;
}

export default function AuditLog() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [filter, setFilter] = useState<AuditFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchEvents() {
      setLoading(true);
      setError('');

      const { data, error: queryError } = await supabase
        .from('department_audit_events')
        .select('*')
        .order('occurred_at', { ascending: false })
        .limit(200);

      if (!active) return;
      if (queryError) {
        setError(queryError.message);
        setLoading(false);
        return;
      }

      setEvents((data || []) as AuditEvent[]);
      setLoading(false);
    }

    void fetchEvents();
    return () => { active = false; };
  }, [deptCode]);

  const visibleEvents = useMemo(
    () => filter === 'all' ? events : events.filter(event => event.event_type === filter),
    [events, filter]
  );

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isAdmin ? 'Audit & Accountability' : 'My Work History'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isAdmin
              ? 'A read-only record of report status changes and public-release decisions in this department.'
              : 'A read-only history of activity on reports currently assigned to you.'}
          </p>
        </div>
        <span className="text-[11px] text-slate-400">Showing the latest 200 events</span>
      </header>

      <section className="enterprise-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-slate-700">
            <ShieldCheck size={16} className="text-primary" />
            <h2 className="text-sm font-bold">{isAdmin ? 'Department activity' : 'Assigned report activity'}</h2>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-slate-100" role="group" aria-label="Filter audit events">
            {([
              ['all', 'All events'],
              ['status', 'Status changes'],
              ['visibility_review', 'Release reviews'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
                className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                  filter === value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-500">Loading audit events…</div>
        ) : error ? (
          <div role="alert" className="p-8 text-center text-sm text-red-700">
            Could not load audit events: {error}
          </div>
        ) : visibleEvents.length === 0 ? (
          <div className="p-10 text-center">
            <FileText size={22} className="mx-auto text-slate-400" />
            <p className="text-sm font-semibold text-slate-800 mt-2">No matching audit events</p>
            <p className="text-xs text-slate-500 mt-1">Recorded actions will appear here.</p>
          </div>
        ) : (
          <ol className="divide-y divide-slate-100">
            {visibleEvents.map(event => {
              const isReview = event.event_type === 'visibility_review';
              const approvedPhotoCount = event.approved_photo_ids?.length || 0;

              return (
                <li key={`${event.event_type}-${event.event_id}`} className="p-4 flex gap-3">
                  <span className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isReview && event.decision === 'published'
                      ? 'bg-emerald-50 text-emerald-700'
                      : isReview
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-blue-50 text-blue-700'
                  }`}>
                    {isReview
                      ? event.decision === 'published' ? <CheckCircle2 size={15} /> : <EyeOff size={15} />
                      : <Clock size={15} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="text-xs font-semibold text-slate-900">
                        {isReview
                          ? event.decision === 'published' ? 'Report approved for public release' : 'Report kept private'
                          : `Status changed: ${event.old_status || 'Initial'} → ${event.new_status || 'Unknown'}`}
                      </p>
                      <Link
                        to={`/dept/${deptCode}/reports/${event.report_id}`}
                        className="font-mono text-[10px] text-primary hover:underline"
                      >
                        #{event.report_id.slice(0, 8)}
                      </Link>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {event.actor_name || 'System'} · {new Date(event.occurred_at).toLocaleString()}
                    </p>
                    {isReview && approvedPhotoCount > 0 && (
                      <p className="text-[11px] text-slate-600 mt-1">
                        {approvedPhotoCount} photo{approvedPhotoCount === 1 ? '' : 's'} approved for public release.
                      </p>
                    )}
                    {event.note && (
                      <p className="text-xs text-slate-600 mt-2 p-2.5 rounded bg-slate-50 border border-slate-100 whitespace-pre-wrap">
                        {event.note}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
