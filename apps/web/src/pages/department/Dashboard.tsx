import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

import GenericDashboard from './dashboards/GenericDashboard';
import RoadsDashboard from './dashboards/RoadsDashboard';
import WaterDashboard from './dashboards/WaterDashboard';
import WasteDashboard from './dashboards/WasteDashboard';
import HealthDashboard from './dashboards/HealthDashboard';
import ZoningDashboard from './dashboards/ZoningDashboard';
import StaffDashboard from './StaffDashboard';

export default function Dashboard() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const { profile } = useAuth();
  const [deptId, setDeptId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDept() {
      if (!deptCode || profile?.role === 'staff') return;
      const { data } = await supabase
        .from('departments')
        .select('id')
        .eq('code', deptCode.toUpperCase())
        .single();
      if (data) {
        setDeptId(data.id);
      }
    }
    fetchDept();
  }, [deptCode, profile?.role]);

  if (profile?.role === 'staff') {
    return <StaffDashboard />;
  }

  if (!deptId || !deptCode) {
    return <div className="animate-pulse h-64 bg-slate-200 rounded-2xl"></div>;
  }

  // Render specific layout based on department
  switch (deptCode.toUpperCase()) {
    case 'ROADS':
      return <RoadsDashboard deptId={deptId} />;
    case 'WATER':
      return <WaterDashboard deptId={deptId} />;
    case 'WASTE':
      return <WasteDashboard deptId={deptId} />;
    case 'HEALTH':
      return <HealthDashboard deptId={deptId} />;
    case 'ZONING':
      return <ZoningDashboard deptId={deptId} />;
    default:
      return <GenericDashboard deptCode={deptCode.toUpperCase()} deptId={deptId} />;
  }
}
