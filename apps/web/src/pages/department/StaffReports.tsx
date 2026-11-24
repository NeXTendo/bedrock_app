import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowUpRight, Clock, MapPin, Search, Truck } from 'lucide-react';
import { useDepartmentReports } from '../../hooks/useDepartmentReports';

type WorkFilter = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'ALL';

export default function StaffReports() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('q') || '';
  const [filter, setFilter] = useState<WorkFilter>('OPEN');
  const { reports, loading, error } = useDepartmentReports();

  const filteredReports = useMemo(() => reports.filter(report => {
    const query = search.trim().toLowerCase();
    if (query && ![
      report.id,
      report.description || '',
      report.address || '',
      report.categories?.name || '',
    ].some(value => value.toLowerCase().includes(query))) {
      return false;
    }

    if (filter === 'OPEN') return !['RESOLVED', 'REJECTED'].includes(report.status);
    if (filter === 'IN_PROGRESS') return report.status === 'IN_PROGRESS';
    if (filter === 'COMPLETED') return ['RESOLVED', 'REJECTED'].includes(report.status);
    return true;
  }), [filter, reports, search]);

  const filters: { value: WorkFilter; label: string }[] = [
    { value: 'OPEN', label: 'Open jobs' },
    { value: 'IN_PROGRESS', label: 'In progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'ALL', label: 'All assigned' },
  ];

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">My Assigned Reports</h1>
        <p className="text-xs text-slate-500 mt-1">Your work orders only. Department-wide reports and review tasks are not shown here.</p>
      </header>

      <section className="enterprise-card p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-100 overflow-x-auto" role="group" aria-label="Filter my reports">
          {filters.map(item => (
            <button
              key={item.value}
              type="button"
              onClick={() => setFilter(item.value)}
              aria-pressed={filter === item.value}
              className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                filter === item.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="relative block w-full lg:w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={search}
            onChange={event => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value) next.set('q', event.target.value);
              else next.delete('q');
              setSearchParams(next);
            }}
            placeholder="Search my assigned reports"
            className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-primary"
          />
        </label>
      </section>

      {loading ? (
        <div className="enterprise-card p-10 text-center text-xs text-slate-500">Loading assigned reports…</div>
      ) : error ? (
        <div role="alert" className="enterprise-card p-8 text-center text-sm text-red-700">
          Your assigned reports could not be loaded: {error}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="enterprise-card p-10 text-center">
          <Truck size={24} className="mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-800 mt-2">No reports match this view</p>
          <p className="text-xs text-slate-500 mt-1">Your current and completed assignments will appear here.</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {filteredReports.map(report => (
            <article key={report.id} className="enterprise-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[10px] text-slate-500">#{report.id.slice(0, 8)}</span>
                    <span className="text-[10px] font-semibold uppercase text-slate-500">{report.status.replaceAll('_', ' ')}</span>
                    <span className={`text-[10px] font-semibold uppercase ${
                      ['critical', 'high'].includes(report.severity?.toLowerCase()) ? 'text-red-700' : 'text-slate-500'
                    }`}>
                      {report.severity || 'Normal'}
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 mt-2">
                    {report.categories?.name || 'Assigned job'}
                  </h2>
                </div>
                <Link
                  to={`/dept/${deptCode}/reports/${report.id}`}
                  aria-label={`Open report ${report.id.slice(0, 8)}`}
                  className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  Open <ArrowUpRight size={13} />
                </Link>
              </div>
              <p className="text-xs text-slate-600 mt-2 line-clamp-3">
                {report.description || 'No detailed description provided.'}
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-[11px] text-slate-400">
                {report.address && <span className="inline-flex items-center gap-1"><MapPin size={11} />{report.address}</span>}
                <span className="inline-flex items-center gap-1"><Clock size={11} />Reported {new Date(report.created_at).toLocaleDateString()}</span>
                {report.assignments?.assigned_at && (
                  <span>Assigned {new Date(report.assignments.assigned_at).toLocaleDateString()}</span>
                )}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
