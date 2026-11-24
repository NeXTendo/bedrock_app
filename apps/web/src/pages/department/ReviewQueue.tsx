import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, Clock, Eye, ShieldAlert } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ReviewQueueReport {
  id: string;
  description: string | null;
  status: string;
  severity: string;
  address: string | null;
  created_at: string;
  priority: number;
  categories: { name: string; color: string } | null;
  potentialDuplicate: boolean;
}

export default function ReviewQueue() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [reports, setReports] = useState<ReviewQueueReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchQueue() {
      setLoading(true);
      setError('');

      const [queueResult, duplicateResult] = await Promise.all([
        supabase
          .from('department_reports')
          .select('id, description, status, severity, address, created_at, priority, categories')
          .is('visibility_reviewed_at', null)
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('department_report_duplicate_flags')
          .select('report_id'),
      ]);

      if (!active) return;
      if (queueResult.error || duplicateResult.error) {
        setError(queueResult.error?.message || duplicateResult.error?.message || 'The review queue could not be loaded.');
        setLoading(false);
        return;
      }

      const possibleDuplicateIds = new Set((duplicateResult.data || []).map(flag => flag.report_id));
      setReports((queueResult.data || []).map(report => ({
        ...report,
        potentialDuplicate: possibleDuplicateIds.has(report.id),
      })) as ReviewQueueReport[]);
      setLoading(false);
    }

    void fetchQueue();
    return () => { active = false; };
  }, [deptCode]);

  const duplicateCount = reports.filter(report => report.potentialDuplicate).length;
  const urgentCount = reports.filter(report => ['critical', 'high'].includes(report.severity?.toLowerCase())).length;

  return (
    <div className="space-y-5">
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Public Release Review Queue</h1>
          <p className="text-xs text-slate-500 mt-1">
            Decide whether a sanitized version can be shared publicly. This review does not verify whether an incident is true.
          </p>
        </div>
        <Link to={`/dept/${deptCode}/reports`} className="text-xs font-semibold text-primary hover:underline">
          Browse all reports
        </Link>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-semibold uppercase tracking-wide">Awaiting release review</span>
            <Eye size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{reports.length}</p>
        </div>
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-red-700">
            <span className="text-xs font-semibold uppercase tracking-wide">High / critical severity</span>
            <AlertCircle size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{urgentCount}</p>
        </div>
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between text-amber-800">
            <span className="text-xs font-semibold uppercase tracking-wide">Possible duplicates</span>
            <ShieldAlert size={16} />
          </div>
          <p className="text-2xl font-bold text-slate-900 mt-2">{duplicateCount}</p>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="enterprise-card p-10 text-center text-xs text-slate-500">Loading release reviews…</div>
        ) : error ? (
          <div role="alert" className="enterprise-card p-8 text-center text-sm text-red-700">
            Could not load the review queue: {error}
          </div>
        ) : reports.length === 0 ? (
          <div className="enterprise-card p-10 text-center">
            <Eye size={24} className="mx-auto text-emerald-600" />
            <p className="text-sm font-semibold text-slate-800 mt-2">No reports awaiting release review</p>
            <p className="text-xs text-slate-500 mt-1">Reviewed reports remain in the full Reports browser.</p>
          </div>
        ) : (
          reports.map(report => (
            <article key={report.id} className="enterprise-card p-4 sm:p-5">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-slate-500">#{report.id.slice(0, 8)}</span>
                    <span
                      className={`px-2 py-0.5 rounded border text-[10px] font-semibold ${
                        report.severity?.toLowerCase() === 'critical'
                          ? 'bg-red-50 text-red-700 border-red-200'
                          : report.severity?.toLowerCase() === 'high'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}
                    >
                      {report.severity || 'Normal'}
                    </span>
                    {report.potentialDuplicate && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-semibold">
                        <ShieldAlert size={11} /> Possible duplicate
                      </span>
                    )}
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-2">
                    {report.categories?.name || 'Uncategorized'}
                  </h2>
                  <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap line-clamp-3">
                    {report.description || 'No detailed description provided.'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
                    {report.address && <span>{report.address}</span>}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} /> Submitted {new Date(report.created_at).toLocaleString()}
                    </span>
                    <span className="text-slate-500">Operational status: {report.status.replaceAll('_', ' ')}</span>
                  </div>
                </div>
                <Link
                  to={`/dept/${deptCode}/reports/${report.id}`}
                  className="inline-flex shrink-0 items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-xs font-semibold hover:opacity-90"
                >
                  Review public release <ArrowUpRight size={13} />
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
}
