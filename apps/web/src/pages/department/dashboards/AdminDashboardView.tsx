import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import {
  AlertTriangle, CheckCircle2, Clock, Truck, TrendingUp, RefreshCw,
  Download, ArrowUpRight, ArrowDownRight, ShieldAlert,
  ChevronRight, Users, Sparkles, MapPin, Activity
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
  accentGradient = 'from-slate-900 via-slate-850 to-slate-800',
}: AdminDashboardViewProps) {
  const stats = useDeptStats(deptId);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await stats.refresh();
    setTimeout(() => setIsRefreshing(false), 600);
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
    link.setAttribute('download', `${deptCode.toLowerCase()}_incidents_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (stats.loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-32 bg-slate-200/80 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="h-36 bg-slate-200/80 rounded-2xl" />
          <div className="h-36 bg-slate-200/80 rounded-2xl" />
          <div className="h-36 bg-slate-200/80 rounded-2xl" />
          <div className="h-36 bg-slate-200/80 rounded-2xl" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-96 bg-slate-200/80 rounded-2xl" />
          <div className="h-96 bg-slate-200/80 rounded-2xl" />
        </div>
      </div>
    );
  }

  const timeRanges: { label: string; value: TimeRange }[] = [
    { label: '24H', value: '24h' },
    { label: '7D', value: '7d' },
    { label: '30D', value: '30d' },
    { label: 'All', value: 'all' },
  ];

  const resolutionRate = stats.total > 0 ? Math.round((stats.resolved / stats.total) * 100) : 0;
  const isTrendPositive = stats.periodChangePercent <= 0; // Fewer incidents is positive for city departments

  return (
    <div className="space-y-7 animate-in fade-in duration-500 pb-12">
      {/* ─── Executive Command Header ─── */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${accentGradient} text-white p-6 sm:p-8 shadow-xl border border-white/10`}>
        {/* Subtle decorative background elements */}
        <div className="absolute -right-16 -top-16 w-80 h-80 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute right-12 bottom-4 opacity-10 pointer-events-none transform translate-x-6 translate-y-6">
          <Sparkles size={220} />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-start sm:items-center space-x-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-white shadow-inner shrink-0">
              {icon}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-white/15 text-white/90 border border-white/20">
                  {deptCode} Command Center
                </span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 glow-pulse" />
                  Live Sync
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                {departmentName}
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm mt-0.5 font-medium max-w-xl">
                {departmentTagline}
              </p>
            </div>
          </div>

          {/* Timeframe & Action Controls */}
          <div className="flex flex-wrap items-center gap-3 self-start md:self-auto">
            {/* Time horizon pill switch */}
            <div className="bg-slate-900/60 p-1 rounded-xl border border-white/15 backdrop-blur-md flex items-center shadow-inner">
              {timeRanges.map(tr => (
                <button
                  key={tr.value}
                  onClick={() => stats.setTimeRange(tr.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    stats.timeRange === tr.value
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {tr.label}
                </button>
              ))}
            </div>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              title="Refresh Dashboard Data"
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition-all shadow-sm active:scale-95"
            >
              <RefreshCw size={17} className={isRefreshing ? 'animate-spin text-white' : ''} />
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCSV}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-bold text-xs hover:bg-slate-100 transition-all shadow-md active:scale-95"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Executive Metric Cards (4 Grid) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Incidents */}
        <div className="command-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Volume</span>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.total}</span>
            <span className={`inline-flex items-center text-xs font-bold px-2 py-0.5 rounded-full ${
              isTrendPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
            }`}>
              {isTrendPositive ? <ArrowDownRight size={13} className="mr-0.5" /> : <ArrowUpRight size={13} className="mr-0.5" />}
              {Math.abs(stats.periodChangePercent)}% vs prior
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">
            {stats.newCount} awaiting triage · {stats.rejected} rejected
          </p>
          {/* Progress Mini Bar */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Resolution Rate</span>
            <span className="text-primary font-bold">{resolutionRate}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div className="h-full bg-primary rounded-full transition-all duration-700" style={{ width: `${resolutionRate}%` }} />
          </div>
        </div>

        {/* Card 2: Critical / Urgent Backlog */}
        <div className="command-card rounded-2xl p-5 relative overflow-hidden group border-l-4 border-l-red-500">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 glow-pulse" />
              Critical Attention
            </span>
            <div className="p-2.5 rounded-xl bg-red-50 text-red-600 group-hover:scale-110 transition-transform">
              <AlertTriangle size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.critical}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
              High Risk
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">
            {stats.high} secondary high-priority incidents
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Emergency SLA</span>
            <span className="text-red-600 font-bold">&lt; 4 Hours Target</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.total > 0 ? Math.min(100, (stats.critical / stats.total) * 100 * 2) : 0}%` }}
            />
          </div>
        </div>

        {/* Card 3: Active Dispatches */}
        <div className="command-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Active Crews</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
              <Truck size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.inProgress}</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              In Field
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">
            {stats.staffWorkload.filter(s => s.activeCount > 0).length} field teams currently assigned
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>Assigned Ratio</span>
            <span className="text-blue-600 font-bold">
              {stats.total > 0 ? Math.round((stats.inProgress / stats.total) * 100) : 0}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.total > 0 ? (stats.inProgress / stats.total) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Card 4: SLA & Resolution Efficiency */}
        <div className="command-card rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SLA Adherence</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-3xl font-black text-slate-900 tracking-tight">{stats.slaComplianceRate}%</span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              On Target
            </span>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-1">
            Avg {stats.avgResolutionHours} hrs from dispatch to fix
          </p>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span>48-Hour Compliance</span>
            <span className="text-emerald-600 font-bold">Standard Met</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-700"
              style={{ width: `${stats.slaComplianceRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* ─── Urgent Triage Deck (If Critical Reports Exist) ─── */}
      {stats.urgentReports.length > 0 && (
        <div className="command-card rounded-2xl p-6 border-l-4 border-l-red-500 bg-gradient-to-r from-red-50/40 to-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-xl">
                <ShieldAlert size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  Urgent Triage Queue
                  <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-red-500 text-white">
                    {stats.urgentReports.length} ACTION REQUIRED
                  </span>
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  High-severity incidents currently unassigned or awaiting immediate field dispatch.
                </p>
              </div>
            </div>
            <Link
              to={`/dept/${deptCode}/reports`}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-xl transition-all"
            >
              <span>View All Reports</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {stats.urgentReports.map(item => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-white border border-red-100/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span
                      className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider text-white"
                      style={{ backgroundColor: item.categoryColor || '#ef4444' }}
                    >
                      {item.categoryName}
                    </span>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-100 text-red-700">
                      {item.severity}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-slate-800 line-clamp-2 leading-snug">
                    {item.description}
                  </p>
                  {item.address && (
                    <p className="text-xs text-slate-500 mt-2 flex items-center gap-1 line-clamp-1">
                      <MapPin size={12} className="text-slate-400 shrink-0" />
                      <span>{item.address}</span>
                    </p>
                  )}
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400 font-medium flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                  <Link
                    to={`/dept/${deptCode}/reports/${item.id}`}
                    className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    <span>Dispatch</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Multi-Chart Analytics Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart: Velocity & Intake Trend */}
        <div className="lg:col-span-2 command-card rounded-2xl p-6 shadow-sm flex flex-col">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity size={18} className="text-primary" />
                Incident Inflow vs Resolution Velocity
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Trajectory of newly reported citizen issues versus resolved work orders over {stats.timeRange.toUpperCase()}.
              </p>
            </div>
            <div className="flex items-center space-x-4 text-xs font-semibold text-slate-600">
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-primary" />
                <span>New Reports</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <span className="w-3 h-3 rounded-full bg-emerald-500" />
                <span>Resolved</span>
              </div>
            </div>
          </div>

          <div className="h-[290px] w-full mt-auto">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradientReports" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={primaryColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={primaryColor} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradientResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                  dy={10}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#64748b', fontSize: 12 }}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    borderRadius: '16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                    fontSize: '12px',
                    fontWeight: '600',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="reports"
                  name="New Reports"
                  stroke={primaryColor}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradientReports)"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  name="Resolved Issues"
                  stroke="#10b981"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#gradientResolved)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown (Donut Chart & Distribution) */}
        <div className="command-card rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900">Category Breakdown</h3>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                {stats.categoryData.length} Categories
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Distribution of incidents across municipal classifications.
            </p>
          </div>

          <div className="h-[180px] w-full relative flex items-center justify-center">
            {stats.categoryData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                      fontSize: '12px',
                    }}
                  />
                  <Pie
                    data={stats.categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={4}
                    dataKey="count"
                  >
                    {stats.categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || primaryColor} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-xs text-slate-400 font-medium">No category data</div>
            )}
            {/* Centered Total Counter */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-xl font-black text-slate-800">{stats.total}</span>
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Total</span>
            </div>
          </div>

          {/* Top Categories Progress Bars */}
          <div className="mt-4 space-y-2.5 overflow-y-auto max-h-[140px] pr-1">
            {stats.categoryData.slice(0, 4).map(cat => (
              <div key={cat.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700 truncate max-w-[170px]">{cat.name}</span>
                  <span className="font-semibold text-slate-500">{cat.count} ({cat.percentage}%)</span>
                </div>
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${cat.percentage}%`, backgroundColor: cat.color || primaryColor }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Bottom Operations Split: Live Audit Stream & Crew Workload ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Operational Activity Stream (2 cols) */}
        <div className="lg:col-span-2 command-card rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary glow-pulse" />
                Live Dispatch & Audit Stream
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Real-time chronological events, status transitions, and technician assignments.
              </p>
            </div>
            <Link
              to={`/dept/${deptCode}/reports`}
              className="text-xs font-bold text-primary hover:underline"
            >
              All Reports
            </Link>
          </div>

          {stats.recentActivity.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs font-medium">
              No recent audit activity logged for this department.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.recentActivity.map((act) => (
                <div key={act.id} className="py-3.5 flex items-start space-x-3.5 group hover:bg-slate-50/60 rounded-xl px-2.5 transition-colors">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    act.type === 'status' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                  }`}>
                    {act.type === 'status' ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {act.title}
                      </p>
                      <span className="text-[11px] font-medium text-slate-400 shrink-0">
                        {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5 line-clamp-1 font-medium">
                      {act.detail}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 font-semibold">
                      Triggered by: {act.author}
                    </p>
                  </div>
                  <Link
                    to={`/dept/${deptCode}/reports/${act.report_id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-slate-400 hover:text-primary rounded-lg"
                  >
                    <ChevronRight size={16} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Crew & Personnel Readiness (1 col) */}
        <div className="command-card rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users size={18} className="text-primary" />
                Crew Readiness
              </h3>
              <Link
                to={`/dept/${deptCode}/team`}
                className="text-xs font-bold text-primary hover:underline"
              >
                Manage
              </Link>
            </div>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Active field engineers and assigned work capacity.
            </p>

            <div className="space-y-3">
              {stats.staffWorkload.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200 rounded-xl">
                  No staff registered for this department yet.
                </div>
              ) : (
                stats.staffWorkload.map(staff => (
                  <div
                    key={staff.id}
                    className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 border border-slate-100 hover:border-slate-200 transition-all"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-xs flex items-center justify-center">
                        {staff.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-900">{staff.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400 capitalize">{staff.role}</p>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                      staff.activeCount > 0
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {staff.activeCount > 0 ? `${staff.activeCount} Active` : 'Available'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100">
            <Link
              to={`/dept/${deptCode}/map`}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm"
            >
              <MapPin size={15} />
              <span>Launch Geospatial Map View</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
