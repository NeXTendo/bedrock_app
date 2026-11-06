import { Activity } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function HealthDashboard({ deptId }: { deptId: string }) {
  return (
    <AdminDashboardView
      deptCode="HEALTH"
      deptId={deptId}
      departmentName="Public Health & Environment"
      departmentTagline="Environmental hazards, bio-waste risks, sanitation inspections & air quality"
      icon={<Activity size={30} />}
      primaryColor="#ec4899"
      accentGradient="from-pink-600 via-rose-600 to-slate-900"
    />
  );
}
