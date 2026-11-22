import { LayoutDashboard } from 'lucide-react';
import AdminDashboardView from './AdminDashboardView';

export default function GenericDashboard({ deptCode, deptId }: { deptCode: string; deptId: string }) {
  return (
    <AdminDashboardView
      deptCode={deptCode}
      deptId={deptId}
      departmentName={`${deptCode} Operations`}
      departmentTagline="Municipal incident management, work order tracking & dispatch center"
      icon={<LayoutDashboard size={22} />}
      primaryColor="#0b4b3b"
      accentGradient="from-slate-900 via-slate-800 to-slate-750"
    />
  );
}
