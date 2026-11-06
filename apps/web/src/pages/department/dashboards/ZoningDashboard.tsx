import { Building2 } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function ZoningDashboard({ deptId }: { deptId: string }) {
  return (
    <AdminDashboardView
      deptCode="ZONING"
      deptId={deptId}
      departmentName="Urban Planning & City Zoning"
      departmentTagline="Land use compliance, unauthorized construction, setback violations & planning"
      icon={<Building2 size={30} />}
      primaryColor="#a855f7"
      accentGradient="from-purple-600 via-indigo-600 to-slate-900"
    />
  );
}
