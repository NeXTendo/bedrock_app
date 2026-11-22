import { Trash2 } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function WasteDashboard({ deptId }: { deptId: string }) {
  return (
    <AdminDashboardView
      deptCode="WASTE"
      deptId={deptId}
      departmentName="Solid Waste Management"
      departmentTagline="Municipal refuse collection, illegal dumping hot-spots & recycling coordination"
      icon={<Trash2 size={22} />}
      primaryColor="#16a34a"
      accentGradient="from-emerald-600 via-teal-600 to-slate-900"
    />
  );
}
