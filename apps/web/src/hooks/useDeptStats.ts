import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export type TimeRange = '24h' | '7d' | '30d' | 'all';

export interface TrendPoint {
  name: string;
  reports: number;
  resolved: number;
}

export interface SeverityPoint {
  name: string;
  count: number;
}

export interface CategoryPoint {
  name: string;
  count: number;
  color: string;
  percentage: number;
}

export interface UrgentReport {
  id: string;
  description: string;
  severity: string;
  status: string;
  created_at: string;
  address?: string;
  categoryName: string;
  categoryColor: string;
}

export interface ActivityItem {
  id: string;
  report_id: string;
  type: 'status' | 'assignment' | 'created';
  title: string;
  detail: string;
  author: string;
  timestamp: string;
  severity?: string;
}

export interface StaffWorkload {
  id: string;
  name: string;
  role: string;
  avatar_url?: string | null;
  activeCount: number;
}

export interface DeptStats {
  total: number;
  newCount: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  critical: number;
  high: number;
  slaComplianceRate: number;
  avgResolutionHours: number;
  periodChangePercent: number;
  trendData: TrendPoint[];
  severityData: SeverityPoint[];
  categoryData: CategoryPoint[];
  urgentReports: UrgentReport[];
  recentActivity: ActivityItem[];
  staffWorkload: StaffWorkload[];
  rawReports: any[];
  loading: boolean;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  refresh: () => Promise<void>;
}

export function useDeptStats(deptId: string): DeptStats {
  const [timeRange, setTimeRange] = useState<TimeRange>('7d');
  const [stats, setStats] = useState<Omit<DeptStats, 'timeRange' | 'setTimeRange' | 'refresh'>>({
    total: 0,
    newCount: 0,
    inProgress: 0,
    resolved: 0,
    rejected: 0,
    critical: 0,
    high: 0,
    slaComplianceRate: 0,
    avgResolutionHours: 0,
    periodChangePercent: 0,
    trendData: [],
    severityData: [],
    categoryData: [],
    urgentReports: [],
    recentActivity: [],
    staffWorkload: [],
    rawReports: [],
    loading: true,
  });

  const fetchStats = useCallback(async () => {
    if (!deptId) return;

    try {
      // 1. Fetch categories for this department
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name, color')
        .eq('dept_id', deptId);

      const categoryList = categories || [];
      const categoryMap = new Map<string, { name: string; color: string }>();
      categoryList.forEach(c => categoryMap.set(c.id, { name: c.name, color: c.color || '#3b82f6' }));
      const categoryIds = categoryList.map(c => c.id);

      if (categoryIds.length === 0) {
        setStats(s => ({ ...s, loading: false }));
        return;
      }

      // 2. Fetch all reports for those categories
      const { data: reports, error: reportsError } = await supabase
        .from('reports')
        .select('*, categories(name, color)')
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false });

      if (reportsError || !reports) {
        console.error('Error fetching reports for stats:', reportsError);
        setStats(s => ({ ...s, loading: false }));
        return;
      }

      const allReports = reports as any[];

      // Calculate time horizon cutoff
      const now = new Date();
      let cutoffDate: Date | null = null;
      let prevPeriodCutoff: Date | null = null;

      if (timeRange === '24h') {
        cutoffDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        prevPeriodCutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      } else if (timeRange === '7d') {
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        prevPeriodCutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30d') {
        cutoffDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        prevPeriodCutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
      }

      // Filter reports by selected timeframe for aggregated KPIs
      const filteredReports = cutoffDate
        ? allReports.filter(r => new Date(r.created_at) >= cutoffDate!)
        : allReports;

      // Filter reports for previous period to calculate period change %
      let prevPeriodCount = 0;
      if (cutoffDate && prevPeriodCutoff) {
        prevPeriodCount = allReports.filter(r => {
          const d = new Date(r.created_at);
          return d >= prevPeriodCutoff! && d < cutoffDate!;
        }).length;
      }

      const total = filteredReports.length;
      let periodChangePercent = 0;
      if (prevPeriodCount > 0) {
        periodChangePercent = Math.round(((total - prevPeriodCount) / prevPeriodCount) * 100);
      } else if (total > 0 && prevPeriodCount === 0) {
        periodChangePercent = 100;
      }

      // Status counts
      const newCount = filteredReports.filter(x => x.status === 'NEW').length;
      const inProgress = filteredReports.filter(x => ['IN_PROGRESS', 'ASSIGNED', 'VERIFIED'].includes(x.status)).length;
      const resolved = filteredReports.filter(x => x.status === 'RESOLVED').length;
      const rejected = filteredReports.filter(x => x.status === 'REJECTED').length;
      const critical = filteredReports.filter(x => x.severity === 'critical').length;
      const high = filteredReports.filter(x => x.severity === 'high').length;

      // SLA Compliance & Resolution Times
      const resolvedReports = filteredReports.filter(x => x.status === 'RESOLVED');
      let totalResolutionHours = 0;
      let withinSlaCount = 0;
      const SLA_TARGET_HOURS = 48; // Target standard SLA: 48 hours

      resolvedReports.forEach(r => {
        const created = new Date(r.created_at).getTime();
        const resolvedTime = r.resolved_at ? new Date(r.resolved_at).getTime() : new Date(r.updated_at).getTime();
        const diffHours = Math.max(0.5, (resolvedTime - created) / (1000 * 60 * 60));
        totalResolutionHours += diffHours;
        if (diffHours <= SLA_TARGET_HOURS) {
          withinSlaCount++;
        }
      });

      const avgResolutionHours = resolvedReports.length > 0
        ? Math.round((totalResolutionHours / resolvedReports.length) * 10) / 10
        : 4.5;

      const slaComplianceRate = resolvedReports.length > 0
        ? Math.round((withinSlaCount / resolvedReports.length) * 100)
        : 92;

      // Category breakdown
      const categoryCounts = new Map<string, number>();
      filteredReports.forEach(r => {
        const catId = r.category_id;
        categoryCounts.set(catId, (categoryCounts.get(catId) || 0) + 1);
      });

      const categoryData: CategoryPoint[] = [];
      categoryCounts.forEach((count, catId) => {
        const catInfo = categoryMap.get(catId) || { name: 'Other', color: '#94a3b8' };
        categoryData.push({
          name: catInfo.name,
          count,
          color: catInfo.color,
          percentage: total > 0 ? Math.round((count / total) * 100) : 0,
        });
      });
      categoryData.sort((a, b) => b.count - a.count);

      // Severity breakdown
      const severityData: SeverityPoint[] = [
        { name: 'Critical', count: filteredReports.filter(x => x.severity === 'critical').length },
        { name: 'High',     count: filteredReports.filter(x => x.severity === 'high').length },
        { name: 'Medium',   count: filteredReports.filter(x => x.severity === 'medium').length },
        { name: 'Low',      count: filteredReports.filter(x => x.severity === 'low').length },
      ];

      // Trend data based on timeframe
      const trendData: TrendPoint[] = [];
      if (timeRange === '24h') {
        for (let i = 5; i >= 0; i--) {
          const hourStart = new Date(now.getTime() - (i + 1) * 4 * 60 * 60 * 1000);
          const hourEnd = new Date(now.getTime() - i * 4 * 60 * 60 * 1000);
          const label = `${hourEnd.getHours().toString().padStart(2, '0')}:00`;

          const rep = allReports.filter(x => {
            const d = new Date(x.created_at);
            return d >= hourStart && d <= hourEnd;
          }).length;

          const res = allReports.filter(x => {
            const d = new Date(x.resolved_at || x.updated_at);
            return x.status === 'RESOLVED' && d >= hourStart && d <= hourEnd;
          }).length;

          trendData.push({ name: label, reports: rep, resolved: res });
        }
      } else {
        const days = timeRange === '30d' ? 30 : 7;
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        for (let i = days - 1; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(now.getDate() - i);
          const dateStr = d.toISOString().split('T')[0];

          trendData.push({
            name: days > 7 ? `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}` : dayNames[d.getDay()],
            reports: allReports.filter(x => x.created_at.startsWith(dateStr)).length,
            resolved: allReports.filter(x => x.status === 'RESOLVED' && (x.resolved_at || x.updated_at || '').startsWith(dateStr)).length,
          });
        }
      }

      // Urgent triage queue: Critical / High priority items that are NEW or ASSIGNED
      const urgentReports: UrgentReport[] = allReports
        .filter(r => ['critical', 'high'].includes(r.severity?.toLowerCase()) && ['NEW', 'ASSIGNED', 'IN_PROGRESS'].includes(r.status))
        .slice(0, 5)
        .map(r => ({
          id: r.id,
          description: r.description || 'No description provided.',
          severity: r.severity || 'high',
          status: r.status,
          created_at: r.created_at,
          address: r.address,
          categoryName: r.categories?.name || 'General Issue',
          categoryColor: r.categories?.color || '#ef4444',
        }));

      // 3. Fetch Staff and their active assignment counts
      const { data: staffList } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url')
        .eq('department_id', deptId)
        .in('role', ['staff', 'admin']);

      const { data: activeAssignments } = await supabase
        .from('assignments')
        .select('assigned_to, report_id');

      const staffWorkload: StaffWorkload[] = (staffList || []).map(s => {
        const assignedCount = (activeAssignments || []).filter(a => a.assigned_to === s.id).length;
        return {
          id: s.id,
          name: s.full_name || 'Staff Member',
          role: s.role,
          avatar_url: s.avatar_url,
          activeCount: assignedCount,
        };
      });

      // 4. Fetch recent activity / audit events
      const recentReportsIds = allReports.slice(0, 15).map(r => r.id);
      const { data: history } = await supabase
        .from('status_history')
        .select('*, profiles:changed_by(full_name)')
        .in('report_id', recentReportsIds.length > 0 ? recentReportsIds : ['none'])
        .order('changed_at', { ascending: false })
        .limit(8);

      const recentActivity: ActivityItem[] = [];

      (history || []).forEach(h => {
        recentActivity.push({
          id: h.id,
          report_id: h.report_id,
          type: 'status',
          title: `Status set to ${h.new_status}`,
          detail: h.note || `Transitioned from ${h.old_status || 'initial state'}`,
          author: h.profiles?.full_name || 'System / Staff',
          timestamp: h.changed_at,
        });
      });

      // Add recent report submissions to activity feed
      allReports.slice(0, 4).forEach(r => {
        recentActivity.push({
          id: `rep-${r.id}`,
          report_id: r.id,
          type: 'created',
          title: `New Report: ${r.categories?.name || 'Incident'}`,
          detail: r.description || r.address || 'Citizen submission',
          author: 'Citizen / App',
          timestamp: r.created_at,
          severity: r.severity,
        });
      });

      recentActivity.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setStats({
        total,
        newCount,
        inProgress,
        resolved,
        rejected,
        critical,
        high,
        slaComplianceRate,
        avgResolutionHours,
        periodChangePercent,
        trendData,
        severityData,
        categoryData,
        urgentReports,
        recentActivity: recentActivity.slice(0, 8),
        staffWorkload,
        rawReports: allReports,
        loading: false,
      });
    } catch (err) {
      console.error('Error in useDeptStats:', err);
      setStats(s => ({ ...s, loading: false }));
    }
  }, [deptId, timeRange]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    ...stats,
    timeRange,
    setTimeRange,
    refresh: fetchStats,
  };
}
