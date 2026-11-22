import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, Truck, TrendingUp, RefreshCw,
  Download, ArrowUpRight, ArrowDownRight, ShieldAlert,
  ChevronRight, MapPin, Activity
} from 'lucide-react';
import { useDeptStats, TimeRange } from '../../../hooks/useDeptStats';

interface AdminDashboardViewProps {
  deptCode: string;
  deptId: string;
  departmentName: string;
  departmentTagline?: string;
  icon: React.ReactNode;
  primaryColor?: string;
  accentGradient?: string;
}

export default function AdminDashboardView({
  deptCode,
  deptId,
  departmentName,
  departmentTagline = 'Municipal Operations & Citizen Services Management',
  icon,
  primaryColor = 'var(--color-primary)',
}: AdminDashboardViewProps) {
  const stats = useDeptStats(deptId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await stats.refresh();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleExportCSV = () => {
    if (!stats.rawReports || stats.rawReports.length === 0) {
      alert('No reports available to export.');
      return;
    }

    const headers = ['Report ID', 'Category', 'Severity', 'Status', 'Description', 'Address', 'Latitude', 'Longitude', 'Created At'];
    const rows = stats.rawReports.map(r => [
      `"${r.id}"`,
      `"${r.categories?.name || 'Uncategorized'}"`,
      `"${r.severity || 'normal'}"`,
      `"${r.status}"`,
      `"${(r.description || '').replace(/"/g, '""')}"`,
      `"${(r.address || '').replace(/"/g, '""')}"`,
      `"${r.latitude || ''}"`,
      `"${r.longitude || ''}"`,
      `"${r.created_at}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${deptCode.toLowerCase()}_reports_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (stats.loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-40 bg-slate-200/70 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-32 bg-slate-200/70 rounded-xl" />
          <div className="h-32 bg-slate-200/70 rounded-xl" />
          <div className="h-32 bg-slate-200/70 rounded-xl" />
          <div className="h-32 bg-slate-200/70 rounded-xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-80 bg-slate-200/70 rounded-xl" />
          <div className="h-80 bg-slate-200/70 rounded-xl" />
        </div>
      </div>
    );
  }

  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: '24 Hours', value: '24h' },
    { label: '7 Days',   value: '7d' },
    { label: '30 Days',  value: '30d' },
    { label: 'All Time', value: 'all' },
  ];

  const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const isTrendPositive = stats.periodChangePercent <= 0;

  return (
    <div className="space-y-6">
      {/* ─── Executive Header ─── */}
      <section className="enterprise-card overflow-hidden border-[#dfe8df]">
        <div className="h-36 overflow-hidden bg-[#07382d] sm:h-44 lg:h-48">
          <img
            src="/bedrock-header.png"
            alt="Bedrock Community Reporting Survey — Report, Track, Improve"
            className="h-full w-full object-cover object-[center_34%]"
          />
        </div>
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#e6f2e9] text-[#0b4b3b] flex items-center justify-center shrink-0 border border-[#d5e6d9]">
              {icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {departmentName}
                </h1>
                <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-[#f0f6f0] text-[#0b4b3b] border border-[#dce9dd]">
                  {deptCode}
                </span>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-[#eaf3eb] text-[#0b4b3b] border border-[#d5e6d9]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#f58208]" />
                  Live Sync
                </span>
              </div>
              <p className="text-xs text-slate-500 max-w-2xl font-normal leading-relaxed">
                {departmentTagline}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            <div className="bg-slate-100 p-1 rounded-lg border border-slate-200 flex items-center">
              {timeRanges.map(tr => (
                <button
                  key={tr.value}
                  onClick={() => stats.setTimeRange(tr.value)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    stats.timeRange === tr.value
                      ? 'bg-white text-slate-900 shadow-xs font-semibold'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>

            <button
              onClick={handleRefresh}
              title="Refresh dashboard metrics"
              className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RefreshCw size={15} className={isRefreshing ? 'animate-spin text-primary' : ''} />
            </button>

            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-700 font-medium text-xs hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </section>

      {/* ─── Key Metrics (4 Grid) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Volume */}
        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Reports</span>
            <span className="w-8 h-8 rounded-lg bg-[#e6f2e9] text-[#0b4b3b] flex items-center justify-center">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{stats.total}</span>
            <span className={`inline-flex items-center text-[11px] font-semibold px-1.5 py-0.5 rounded ${
              isTrendPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {isTrendPositive ? <ArrowDownRight size={12} className="mr-0.5" /> : <ArrowUpRight size={12} className="mr-0.5" />}
              {Math.abs(stats.periodChangePercent)}%
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.newCount} pending triage · {stats.inProgress} in progress
          </p>
        </div>

        {/* Metric 2: Critical Backlog */}
        <div className="enterprise-card p-5 border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-red-700 uppercase tracking-wider">Critical Priority</span>
            <span className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle size={16} />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{stats.critical}</span>
            <span className="text-[11px] font-medium text-slate-500">
              of {stats.total} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.high} secondary high-priority incidents
          </p>
        </div>

        {/* Metric 3: Active Dispatches */}
        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Field Crews Active</span>
            <span className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Truck size={16} />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{stats.inProgress}</span>
            <span className="text-[11px] font-medium text-slate-500">
              reports assigned
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            {stats.staffWorkload.filter(s => s.activeCount > 0).length} technicians currently in field
          </p>
        </div>

        {/* Metric 4: Resolution Rate */}
        <div className="enterprise-card p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Resolution Rate</span>
            <span className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">{resolutionRate}%</span>
            <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
              {stats.resolved} resolved
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Avg {stats.avgResolutionHours} hrs from report to fix
          </p>
        </div>
      </div>

      {/* ─── Urgent Action Queue (when high/critical reports exist) ─── */}
      {stats.urgentReports.length > 0 && (
        <div className="enterprise-card p-5 border-l-4 border-l-amber-500">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-amber-50 text-amber-700 rounded-lg">
                <ShieldAlert size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Action Required: Urgent Incident Queue</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800">
                    {stats.urgentReports.length} pending
                  </span>
                </h2>
                <p className="text-xs text-slate-500">
                  Critical or high-severity reports requiring immediate assessment and staff dispatch.
                </p>
              </div>
            </div>
            <Link
              to={`/dept/${deptCode}/reports`}
              className="inline-flex items-center space-x-1 text-xs font-semibold text-primary hover:underline"
            >
              <span>View all reports</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {stats.urgentReports.map(item => (
              <div
                key={item.id}
                className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col justify-between hover:bg-slate-100/70 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.categoryName}
                    </span>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      item.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                  {item.address && (
                    <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1 truncate">
                      <MapPin size={11} className="shrink-0" />
                      <span>{item.address}</span>
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Clock size={11} />
                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <Link
                    to={`/dept/${deptCode}/reports/${item.id}`}
                    className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Dispatch</span>
                    <ChevronRight size={13} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Analytics Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Trend Chart (2 columns) */}
        <div className="lg:col-span-2 enterprise-card p-5 flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Activity size={16} className="text-primary" />
                <span>Incident Inflow vs. Resolution Trend</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                New civic reports received compared to work orders completed over the selected timeframe.
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-medium text-slate-600">
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: primaryColor }} />
                <span>New</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>Resolved</span>
              </div>
            </div>
          </div>

          <div className="h-[260px] w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.18} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="chartResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#16a34a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 11 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.06)',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  name="New Reports"
                  stroke={primaryColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#chartReports)"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved"
                  stroke="#16a34a"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#chartResolved)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown (1 column) */}
        <div className="enterprise-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-bold text-slate-900">Incident Classification</h2>
              <span className="text-[11px] font-mono text-slate-400">
                {stats.categoryData.length} categories
              </span>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Distribution across municipal service areas.
            </p>
          </div>

          <div className="h-[170px] w-full relative flex items-center justify-center">
            {stats.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '12px',
                    }}
                  />
                  <Pie
                    data={stats.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={3}
                    dataKey="count"
                  >
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || '#2563eb'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400">No category data recorded</div>
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-slate-900">{stats.total}</span>
              <span className="text-[10px] uppercase font-semibold text-slate-400">Total</span>
            </div>
          </div>

          {/* Categories List */}
          <div className="mt-3 space-y-2 max-h-[140px] overflow-y-auto pr-1">
            {stats.categoryData.slice(0, 4).map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 truncate max-w-[180px]">{cat.name}</span>
                  <span className="text-slate-500 tabular-nums">{cat.count} ({cat.percentage}%)</span>
                </div>
                <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || '#2563eb' }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Operational Activity Stream & Team Roster ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Log (2 columns) */}
        <div className="lg:col-span-2 enterprise-card p-5">
          <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Recent Operational Activity</h2>
              <p className="text-xs text-slate-500">Status transitions, assignments, and resolution audits.</p>
            </div>
            <Link
              to={`/dept/${deptCode}/reports`}
              className="text-xs font-semibold text-primary hover:underline"
            >
              All reports
            </Link>
          </div>

          {stats.recentActivity.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No recent audit activity logged for this department.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentActivity.map((act) => (
                <div key={act.id} className="py-2.5 flex items-start space-x-3 group">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 text-xs ${
                    act.type === 'status' ? 'bg-[#e6f2e9] text-[#0b4b3b]' : 'bg-slate-100 text-slate-700'
                  }`}>
                    {act.type === 'status' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-900 truncate">
                        {act.title}
                      </p>
                      <span className="text-[11px] text-slate-400 shrink-0 font-mono">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1">
                      {act.detail}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      By {act.author}
                    </p>
                  </div>
                  <Link
                    to={`/dept/${deptCode}/reports/${act.report_id}`}
                    className="p-1 text-slate-300 hover:text-slate-600 rounded"
                  >
                    <ChevronRight size={14} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Staff & Crew Status (1 column) */}
        <div className="enterprise-card p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Personnel & Crews</h2>
                <p className="text-xs text-slate-500">Active engineers and field assignments.</p>
              </div>
              <Link
                to={`/dept/${deptCode}/team`}
                className="text-xs font-semibold text-primary hover:underline"
              >
                Manage
              </Link>
            </div>

            <div className="space-y-2 mt-3">
              {stats.staffWorkload.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                  No staff accounts registered for this department.
                </div>
              ) : (
                stats.staffWorkload.map(staff => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-100"
                  >
                    <div className="flex items-center space-x-2.5">
                      <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center">
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{staff.name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{staff.role}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      staff.activeCount > 0
                        ? 'bg-[#e6f2e9] text-[#0b4b3b] border border-[#d5e6d9]'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}>
                      {staff.activeCount > 0 ? `${staff.activeCount} active` : 'Available'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100">
            <Link
              to={`/dept/${deptCode}/map`}
              className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 rounded-lg bg-[#0b4b3b] hover:bg-[#07382d] text-white font-medium text-xs transition-colors shadow-2xs"
            >
              <MapPin size={13} />
              <span>Open Geospatial Map</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
