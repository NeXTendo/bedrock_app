import { Droplet } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function WaterDashboard({ deptId }: { deptId: string }) {
  return (
    <AdminDashboardView
      deptCode="WATER"
      deptId={deptId}
      departmentName="Water & Sanitation"
      departmentTagline="Water grid pressure, pipe burst responses, sewage maintenance & clean supply"
      icon={<Droplet size={30} />}
      primaryColor="#0ea5e9"
      accentGradient="from-sky-600 via-blue-600 to-slate-900"
    />
  );
}
