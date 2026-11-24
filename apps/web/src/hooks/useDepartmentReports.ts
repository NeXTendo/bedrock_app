import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface DepartmentWorkReport {
  id: string;
  category_id: string;
  description: string | null;
  status: string;
  severity: string;
  address: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  priority: number;
  occurred_at: string | null;
  immediate_danger: 'yes' | 'no' | 'unsure';
  category_details: Record<string, 'yes' | 'no' | 'unsure'>;
  categories: { name: string; color: string } | null;
  assignments: {
    assigned_at: string;
    assigned_to: string | null;
    teams: { name: string } | null;
    profiles: { full_name: string | null } | null;
    assignment_members: { profile_id: string; assigned_role: string }[];
  } | null;
}

export function useDepartmentReports() {
  const [reports, setReports] = useState<DepartmentWorkReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function fetchReports() {
      setLoading(true);
      setError('');

      const [reportsResult, contextResult] = await Promise.all([
        supabase
          .from('department_reports')
          .select('id, category_id, description, status, severity, address, created_at, updated_at, resolved_at, priority, categories, assignments')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true }),
        supabase
          .from('department_report_context')
          .select('id, occurred_at, immediate_danger, category_details'),
      ]);

      if (!active) return;
      if (reportsResult.error || contextResult.error) {
        setError(reportsResult.error?.message || contextResult.error?.message || 'Unable to load report context.');
        setLoading(false);
        return;
      }

      const contextById = new Map(
        (contextResult.data || []).map(context => [context.id, context])
      );
      setReports((reportsResult.data || []).map(report => ({
        ...report,
        ...contextById.get(report.id),
      })) as DepartmentWorkReport[]);
      setLoading(false);
    }

    void fetchReports();
    return () => { active = false; };
  }, []);

  return { reports, loading, error };
}
