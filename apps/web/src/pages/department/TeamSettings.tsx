import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Users, Shield, Phone, CheckCircle2,
  Truck, ArrowLeft, Search, AlertCircle
} from 'lucide-react';

interface StaffProfile {
  id: string;
  full_name: string | null;
  role: string;
  phone: string | null;
  avatar_url?: string | null;
  created_at?: string;
  activeAssignments: number;
}

export default function TeamSettings() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('Department');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  useEffect(() => {
    async function fetchTeam() {
      setLoading(true);
      if (!deptCode) return;

      try {
        const { data: dept } = await supabase
          .from('departments')
          .select('id, name')
          .eq('code', deptCode.toUpperCase())
          .single();

        if (dept) {
          setDepartmentName(dept.name);

          // Fetch profiles
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, role, phone, avatar_url, created_at')
            .eq('department_id', dept.id)
            .in('role', ['staff', 'admin'])
            .order('role', { ascending: true });

          // Fetch active assignments count per user
          const { data: assignments } = await supabase
            .from('assignments')
            .select('assigned_to')
            .eq('department_id', dept.id);

          const assignmentCountMap = new Map<string, number>();
          (assignments || []).forEach(a => {
            if (a.assigned_to) {
              assignmentCountMap.set(a.assigned_to, (assignmentCountMap.get(a.assigned_to) || 0) + 1);
            }
          });

          const enriched: StaffProfile[] = (profiles || []).map(p => ({
            ...p,
            activeAssignments: assignmentCountMap.get(p.id) || 0,
          }));

          setStaffList(enriched);
        }
      } catch (err) {
        console.error('Error fetching department team:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchTeam();
  }, [deptCode]);

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.phone || '').includes(searchQuery);
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const totalMembers = staffList.length;
  const dispatchedMembers = staffList.filter(s => s.activeAssignments > 0).length;
  const availableMembers = totalMembers - dispatchedMembers;

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-24 bg-slate-200 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="h-28 bg-slate-200 rounded-2xl" />
          <div className="h-28 bg-slate-200 rounded-2xl" />
          <div className="h-28 bg-slate-200 rounded-2xl" />
        </div>
        <div className="h-96 bg-slate-200 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            to={`/dept/${deptCode}/dashboard`}
            className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Department Team & Crews</h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                {deptCode?.toUpperCase()}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5">
              Manage field crews, technician assignments, and admin credentials for {departmentName}.
            </p>
          </div>
        </div>

        <Link
          to={`/dept/${deptCode}/reports`}
          className="self-start sm:self-auto px-4 py-2.5 bg-primary text-white font-bold text-xs rounded-xl hover:bg-primary-dark shadow-sm transition-all"
        >
          Assign Active Work Orders
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="command-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Personnel</span>
            <div className="p-2.5 rounded-xl bg-slate-100 text-slate-700">
              <Users size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{totalMembers}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Registered staff and administrators</p>
        </div>

        <div className="command-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Active in Field</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
              <Truck size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{dispatchedMembers}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Currently handling active dispatches</p>
        </div>

        <div className="command-card rounded-2xl p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Available Standby</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 size={18} />
            </div>
          </div>
          <p className="text-3xl font-black text-slate-900 mt-2">{availableMembers}</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Ready for immediate task assignment</p>
        </div>
      </div>

      {/* Team Directory Table Card */}
      <div className="command-card rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <h2 className="text-base font-bold text-slate-800">Personnel Roster</h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {filteredStaff.length} members
            </span>
          </div>

          <div className="flex items-center space-x-3">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="staff">Field Staff</option>
            </select>
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-12 text-center">
            <AlertCircle size={36} className="text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-700">No personnel found</h3>
            <p className="text-xs text-slate-400 mt-1">Try clearing or adjusting your search filters.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3.5 bg-slate-50/70 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <div className="col-span-4">Staff Member</div>
              <div className="col-span-2">Department Role</div>
              <div className="col-span-3">Contact Information</div>
              <div className="col-span-3 text-right">Workload Status</div>
            </div>

            {/* Rows */}
            {filteredStaff.map(member => (
              <div
                key={member.id}
                className="p-4 md:px-6 md:py-4 flex flex-col md:grid md:grid-cols-12 gap-3 md:gap-4 md:items-center hover:bg-slate-50/60 transition-colors"
              >
                {/* Col 1: Member Avatar & Name */}
                <div className="col-span-4 flex items-center space-x-3.5">
                  <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden border border-slate-300 shadow-sm shrink-0 flex items-center justify-center font-bold text-sm text-slate-600">
                    {member.avatar_url ? (
                      <img src={member.avatar_url} alt={member.full_name || 'Staff'} className="w-full h-full object-cover" />
                    ) : (
                      member.full_name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate">
                      {member.full_name || 'Unnamed Personnel'}
                    </p>
                    <p className="text-[11px] text-slate-400 font-mono truncate">
                      ID: {member.id.substring(0, 8)}
                    </p>
                  </div>
                </div>

                {/* Col 2: Role */}
                <div className="col-span-2 flex items-center">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold capitalize ${
                    member.role === 'admin'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {member.role === 'admin' && <Shield size={12} />}
                    {member.role}
                  </span>
                </div>

                {/* Col 3: Contact */}
                <div className="col-span-3 flex items-center text-xs font-medium text-slate-600">
                  {member.phone ? (
                    <span className="flex items-center gap-1.5">
                      <Phone size={14} className="text-slate-400" />
                      {member.phone}
                    </span>
                  ) : (
                    <span className="text-slate-400 italic">No phone on file</span>
                  )}
                </div>

                {/* Col 4: Workload */}
                <div className="col-span-3 flex items-center md:justify-end">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    member.activeAssignments > 0
                      ? 'bg-blue-100 text-blue-700 border border-blue-200'
                      : 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    {member.activeAssignments > 0 ? (
                      <>
                        <Truck size={13} />
                        <span>{member.activeAssignments} Active Orders</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={13} />
                        <span>Ready / Standby</span>
                      </>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
