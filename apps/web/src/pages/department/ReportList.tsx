import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Search, ChevronRight, AlertCircle, Clock, CheckCircle2,
  XCircle, MapPin, X
} from 'lucide-react';

interface ReportRow {
  id: string;
  description: string;
  status: string;
  severity: string;
  address?: string;
  created_at: string;
  categories: { name: string; icon: string; color: string } | null;
}

export default function ReportList() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== search) {
      setSearch(q);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      if (!deptCode) return;

      const { data: dept } = await supabase
        .from('departments')
        .select('id')
        .eq('code', deptCode.toUpperCase())
        .single();

      if (dept) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id')
          .eq('dept_id', dept.id);

        const categoryIds = (categories as { id: string }[] | null)?.map(c => c.id) || [];

        if (categoryIds.length > 0) {
          const { data } = await supabase
            .from('reports')
            .select('*, categories(name, icon, color)')
            .in('category_id', categoryIds)
            .order('created_at', { ascending: false });

          setReports(data || []);
        } else {
          setReports([]);
        }
      }
      setLoading(false);
    }

    fetchReports();
  }, [deptCode]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'NEW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <AlertCircle size={12} />
            <span>New</span>
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock size={12} />
            <span>In Progress</span>
          </span>
        );
      case 'RESOLVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={12} />
            <span>Resolved</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-200">
            <XCircle size={12} />
            <span>Rejected</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
            {status}
          </span>
        );
    }
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'critical':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-bold uppercase bg-red-50 text-red-700 border border-red-200">
            Critical
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase bg-amber-50 text-amber-800 border border-amber-200">
            High
          </span>
        );
      case 'normal':
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium uppercase bg-slate-100 text-slate-600 border border-slate-200">
            {severity || 'Normal'}
          </span>
        );
    }
  };

  const filteredReports = reports.filter(r => {
    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        r.id.toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q) ||
        (r.categories?.name || '').toLowerCase().includes(q);
      if (!match) return false;
    }

    // Status filter
    if (statusFilter !== 'ALL' && r.status !== statusFilter) {
      return false;
    }

    // Severity filter
    if (severityFilter !== 'ALL' && r.severity?.toLowerCase() !== severityFilter.toLowerCase()) {
      return false;
    }

    return true;
  });

  return (
    <div className="space-y-5">
      {/* Page Title & Filter Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Incident Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Review incoming citizen reports, triage priority, and dispatch departmental staff.
          </p>
        </div>

        <div className="text-xs text-slate-500 font-medium">
          Showing <span className="font-semibold text-slate-900">{filteredReports.length}</span> of {reports.length} reports
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="enterprise-card p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left Search */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input
            type="text"
            value={search}
            onChange={e => {
              setSearch(e.target.value);
              if (e.target.value) {
                setSearchParams({ q: e.target.value });
              } else {
                setSearchParams({});
              }
            }}
            placeholder="Filter by report ID, street, or description..."
            className="w-full pl-8 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
          />
          {search && (
            <button
              onClick={() => {
                setSearch('');
                setSearchParams({});
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Right Selectors */}
        <div className="flex items-center gap-2">
          {/* Status Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-xs font-medium px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Statuses</option>
              <option value="NEW">New</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Severity Dropdown */}
          <div className="flex items-center space-x-1.5">
            <span className="text-xs text-slate-500 font-medium hidden sm:inline">Severity:</span>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg text-xs font-medium px-2.5 py-1.5 text-slate-700 focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </select>
          </div>

          {(statusFilter !== 'ALL' || severityFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setStatusFilter('ALL');
                setSeverityFilter('ALL');
                setSearch('');
                setSearchParams({});
              }}
              className="text-xs text-slate-500 hover:text-slate-900 underline px-1"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Reports Data Table */}
      <div className="enterprise-card overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 space-y-3">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            <p className="text-xs font-medium text-slate-500">Loading reports from database…</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
              <CheckCircle2 size={20} />
            </div>
            <p className="text-sm font-semibold text-slate-800">No matching reports found</p>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {search || statusFilter !== 'ALL' || severityFilter !== 'ALL'
                ? 'Try adjusting your search criteria or resetting filters.'
                : 'There are currently no active reports filed for this department.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4 w-28">Report ID</th>
                  <th className="py-3 px-4">Category & Issue</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 w-28">Severity</th>
                  <th className="py-3 px-4 w-32">Reported Date</th>
                  <th className="py-3 px-4 w-20 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredReports.map(report => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => window.location.href = `/dept/${deptCode}/reports/${report.id}`}
                  >
                    {/* ID */}
                    <td className="py-3.5 px-4 font-mono text-slate-500 font-medium">
                      #{report.id.slice(0, 8)}
                    </td>

                    {/* Category & Description */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-start space-x-2.5">
                        <span
                          className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                          style={{ backgroundColor: report.categories?.color || '#94a3b8' }}
                        />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-primary transition-colors">
                            {report.categories?.name || 'Uncategorized'}
                          </p>
                          <p className="text-slate-600 line-clamp-1 mt-0.5">
                            {report.description}
                          </p>
                          {report.address && (
                            <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-1 truncate">
                              <MapPin size={11} className="shrink-0" />
                              <span>{report.address}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(report.status)}
                    </td>

                    {/* Severity */}
                    <td className="py-3.5 px-4">
                      {getSeverityBadge(report.severity)}
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4 text-slate-500">
                      {new Date(report.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </td>

                    {/* Action Arrow */}
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        to={`/dept/${deptCode}/reports/${report.id}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center text-slate-400 group-hover:text-primary p-1 rounded"
                      >
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
