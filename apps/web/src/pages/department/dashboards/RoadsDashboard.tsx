import { Truck } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function RoadsDashboard({ deptId }: { deptId: string }) {
  return (
    <AdminDashboardView
      deptCode="ROADS"
      deptId={deptId}
      departmentName="Roads & Infrastructure"
      departmentTagline="Pavement repairs, traffic signals, drainage clearing & arterial road networks"
      icon={<Truck size={22} />}
      primaryColor="#ea580c"
      accentGradient="from-orange-600 via-amber-600 to-slate-900"
    />
  );
}
