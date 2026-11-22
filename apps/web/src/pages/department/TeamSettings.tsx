import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Users, CheckCircle2, Truck, ArrowLeft, Search, ShieldCheck,
  Plus, Pencil, UserRoundX, UserRoundCheck, X,
} from 'lucide-react';

interface StaffProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: 'staff' | 'admin';
  phone: string | null;
  avatar_url?: string | null;
  created_at?: string;
  is_suspended: boolean;
  activeAssignments: number;
}

interface StaffFormState {
  id?: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'staff' | 'admin';
}

async function getStaffFunctionErrorMessage(error: { name: string; message: string; context?: unknown }) {
  if (error.name === 'FunctionsFetchError') {
    return 'Could not reach the manage-staff Edge Function. Confirm it is deployed to this Supabase project and that VITE_SUPABASE_URL points to the same project.';
  }

  if (error.name === 'FunctionsHttpError' && error.context instanceof Response) {
    const response = error.context.clone();
    try {
      const body: unknown = await response.json();
      const functionMessage = body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : body && typeof body === 'object' && 'message' in body && typeof body.message === 'string'
          ? body.message
          : null;
      if (functionMessage) {
        if (functionMessage.toLowerCase().includes('error sending invite email')) {
          return 'Supabase Auth could not send the invitation email. Check the project SMTP settings, sender address/domain, and Auth email logs, then retry.';
        }
        return functionMessage;
      }
    } catch {
      return `Staff request failed with status ${response.status}. ${error.message}`;
    }
    return `Staff request failed with status ${response.status}. ${error.message}`;
  }

  return error.message;
}

export default function TeamSettings() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [staffList, setStaffList] = useState<StaffProfile[]>([]);
  const [departmentName, setDepartmentName] = useState<string>('Department');
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [staffForm, setStaffForm] = useState<StaffFormState>({
    full_name: '',
    email: '',
    phone: '',
    role: 'staff',
  });

  const fetchTeam = useCallback(async () => {
    if (!deptCode) return;

    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('code', deptCode.toUpperCase())
      .single();
    if (deptError || !dept) {
      setError(deptError?.message || 'Department not found.');
      setLoading(false);
      return;
    }

    setDepartmentId(dept.id);
    setDepartmentName(dept.name);
    setError('');
    const [staffResult, assignmentResult] = await Promise.all([
      supabase.functions.invoke<{ staff: Omit<StaffProfile, 'activeAssignments'>[] }>('manage-staff', {
        body: { action: 'list', department_id: dept.id },
      }),
      supabase
        .from('assignments')
        .select('id, assigned_to, report:reports(status), assignment_members(profile_id)')
        .eq('department_id', dept.id),
    ]);

    if (staffResult.error) {
      console.error('Could not reach the manage-staff Edge Function:', staffResult.error);
      setError(await getStaffFunctionErrorMessage(staffResult.error));
      setLoading(false);
      return;
    }
    if (assignmentResult.error) {
      setError(assignmentResult.error.message);
      setLoading(false);
      return;
    }

    const assignmentIdsByProfile = new Map<string, Set<string>>();
    for (const assignment of assignmentResult.data || []) {
      const report = Array.isArray(assignment.report) ? assignment.report[0] : assignment.report;
      if (!report || ['RESOLVED', 'REJECTED'].includes(report.status)) continue;
      const ids = new Set<string>();
      if (assignment.assigned_to) ids.add(assignment.assigned_to);
      (assignment.assignment_members || []).forEach(member => ids.add(member.profile_id));
      ids.forEach(profileId => {
        const assignments = assignmentIdsByProfile.get(profileId) || new Set<string>();
        assignments.add(assignment.id);
        assignmentIdsByProfile.set(profileId, assignments);
      });
    }

    setStaffList((staffResult.data?.staff || []).map(member => ({
      ...member,
      activeAssignments: assignmentIdsByProfile.get(member.id)?.size || 0,
    })));
    setLoading(false);
  }, [deptCode]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void fetchTeam();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchTeam]);

  const filteredStaff = staffList.filter(s => {
    const matchesSearch = (s.full_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                          s.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (s.phone || '').includes(searchQuery);
    const matchesRole = roleFilter === 'ALL' || s.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const activeStaff = staffList.filter(member => !member.is_suspended);
  const totalMembers = activeStaff.length;
  const dispatchedMembers = activeStaff.filter(member => member.activeAssignments > 0).length;
  const availableMembers = totalMembers - dispatchedMembers;

  const openInviteForm = () => {
    setStaffForm({ full_name: '', email: '', phone: '', role: 'staff' });
    setFormError('');
    setModalOpen(true);
  };

  const openEditForm = (member: StaffProfile) => {
    setStaffForm({
      id: member.id,
      full_name: member.full_name || '',
      email: member.email,
      phone: member.phone || '',
      role: member.role,
    });
    setFormError('');
    setModalOpen(true);
  };

  const saveStaff = async (event: FormEvent) => {
    event.preventDefault();
    if (!departmentId) return;
    setSaving(true);
    setFormError('');

    const action = staffForm.id ? 'update' : 'invite';
    const { error: invokeError } = await supabase.functions.invoke('manage-staff', {
      body: {
        action,
        department_id: departmentId,
        profile_id: staffForm.id,
        email: staffForm.email.trim(),
        full_name: staffForm.full_name.trim(),
        phone: staffForm.phone.trim(),
        role: staffForm.role,
      },
    });

    if (invokeError) {
      console.error('Staff details could not be sent to the manage-staff Edge Function:', invokeError);
      setFormError(await getStaffFunctionErrorMessage(invokeError));
      setSaving(false);
      return;
    }

    setModalOpen(false);
    setSaving(false);
    await fetchTeam();
  };

  const toggleStaffAccess = async (member: StaffProfile) => {
    if (!departmentId) return;
    const action = member.is_suspended ? 'activate' : 'deactivate';
    if (action === 'deactivate' && !window.confirm(`Deactivate ${member.full_name || 'this staff member'}? Existing reports will remain, but they will no longer be able to sign in or receive new assignments.`)) {
      return;
    }
    setSaving(true);
    setError('');
    const { error: invokeError } = await supabase.functions.invoke('manage-staff', {
      body: { action, department_id: departmentId, profile_id: member.id },
    });
    if (invokeError) {
      console.error('Staff access could not be changed through the manage-staff Edge Function:', invokeError);
      setError(await getStaffFunctionErrorMessage(invokeError));
      setSaving(false);
      return;
    }
    setSaving(false);
    await fetchTeam();
  };

  if (loading) {
    return (
      <div className="space-y-5 animate-pulse">
        <div className="h-20 bg-slate-200/70 rounded-xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 bg-slate-200/70 rounded-xl" />
          <div className="h-24 bg-slate-200/70 rounded-xl" />
          <div className="h-24 bg-slate-200/70 rounded-xl" />
        </div>
        <div className="h-80 bg-slate-200/70 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <Link
            to={`/dept/${deptCode}/dashboard`}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Dashboard"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Staff</h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                {deptCode?.toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Manage department access, staff details, and dispatch availability for {departmentName}.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            to={`/dept/${deptCode}/teams`}
            className="inline-flex items-center gap-2 rounded-md border border-[#d6ded5] bg-white px-3.5 py-2 text-sm font-semibold text-[#0b4b3b] transition hover:bg-[#f0f6f0]"
          >
            <Users size={15} />
            Manage teams
          </Link>
          <button
            type="button"
            onClick={openInviteForm}
            className="inline-flex items-center gap-2 rounded-md bg-[#0b4b3b] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#07382d]"
          >
            <Plus size={15} />
            Invite staff
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Personnel</span>
            <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Users size={15} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{totalMembers}</p>
          <p className="text-xs text-slate-400 mt-1">Registered department members</p>
        </div>

        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#0b4b3b] uppercase tracking-wider">Active in Field</span>
            <span className="w-7 h-7 rounded-lg bg-[#e6f2e9] text-[#0b4b3b] flex items-center justify-center">
              <Truck size={15} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{dispatchedMembers}</p>
          <p className="text-xs text-slate-400 mt-1">Technicians with open assignments</p>
        </div>

        <div className="enterprise-card p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-[#0b4b3b] uppercase tracking-wider">Available</span>
            <span className="w-7 h-7 rounded-lg bg-[#e6f2e9] text-[#0b4b3b] flex items-center justify-center">
              <CheckCircle2 size={15} />
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 tracking-tight">{availableMembers}</p>
          <p className="text-xs text-slate-400 mt-1">Active staff without open assignments</p>
        </div>
      </div>

      {/* Staff Directory */}
      <div className="enterprise-card overflow-hidden">
        {/* Filter bar */}
        <div className="p-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Department staff</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-600">
              {filteredStaff.length} members
            </span>
          </div>

          <div className="flex items-center space-x-2.5">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search name, email or phone..."
                className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:bg-white focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>

            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Roles</option>
              <option value="admin">Administrators</option>
              <option value="staff">Staff Members</option>
            </select>
          </div>
        </div>

        {filteredStaff.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-xs">
            No team members matched the search criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  <th className="py-2.5 px-4">Staff member</th>
                  <th className="py-2.5 px-4">Access</th>
                  <th className="py-2.5 px-4">Phone</th>
                  <th className="py-2.5 px-4">Open reports</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredStaff.map(member => (
                  <tr key={member.id} className={`transition-colors hover:bg-slate-50/80 ${member.is_suspended ? 'opacity-60' : ''}`}>
                    {/* Name + Avatar */}
                    <td className="py-3 px-4">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-semibold text-xs flex items-center justify-center shrink-0 border border-slate-200">
                          {member.full_name?.charAt(0) || 'U'}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-900">{member.full_name || 'Staff Member'}</p>
                          <p className="truncate text-[11px] text-slate-500">{member.email || 'Invitation pending'}</p>
                        </div>
                      </div>
                    </td>

                    {/* Access role */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium capitalize ${
                        member.role === 'admin'
                          ? 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {member.role === 'admin' && <ShieldCheck size={11} />}
                        <span>{member.role}</span>
                      </span>
                    </td>

                    {/* Phone */}
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {member.phone || '—'}
                    </td>

                    {/* Active Assignments */}
                    <td className="py-3 px-4 text-slate-700">
                      <span className="font-semibold text-slate-900">{member.activeAssignments}</span> open reports
                    </td>

                    {/* Readiness status */}
                    <td className="py-3 px-4">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        member.is_suspended
                          ? 'bg-slate-100 text-slate-500 border border-slate-200'
                          : member.activeAssignments > 0
                            ? 'bg-[#e6f2e9] text-[#0b4b3b] border border-[#d5e6d9]'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      }`}>
                        {member.is_suspended ? 'Inactive' : member.activeAssignments > 0 ? 'Assigned' : 'Available'}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEditForm(member)}
                          aria-label={`Edit ${member.full_name || 'staff member'}`}
                          className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#0b4b3b]"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStaffAccess(member)}
                          disabled={saving}
                          aria-label={`${member.is_suspended ? 'Reactivate' : 'Deactivate'} ${member.full_name || 'staff member'}`}
                          className="rounded-md p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        >
                          {member.is_suspended ? <UserRoundCheck size={15} /> : <UserRoundX size={15} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <form
            onSubmit={saveStaff}
            role="dialog"
            aria-modal="true"
            aria-labelledby="staff-form-title"
            className="w-full max-w-lg space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="staff-form-title" className="text-lg font-semibold text-slate-900">
                  {staffForm.id ? 'Edit staff member' : 'Invite staff member'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  {staffForm.id ? 'Update department access and contact details.' : 'They will receive an email invitation to set up their account.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close staff form"
                className="rounded p-1 text-slate-400 hover:text-slate-700"
              >
                <X size={17} />
              </button>
            </div>

            {formError && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
                {formError}
              </div>
            )}

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Full name
              <input
                autoComplete="name"
                required
                maxLength={120}
                value={staffForm.full_name}
                onChange={event => setStaffForm(current => ({ ...current, full_name: event.target.value }))}
                className="form-input"
              />
            </label>

            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Work email
              <input
                type="email"
                autoComplete="email"
                required={!staffForm.id}
                readOnly={Boolean(staffForm.id)}
                value={staffForm.email}
                onChange={event => setStaffForm(current => ({ ...current, email: event.target.value }))}
                placeholder="name@organization.com"
                className="form-input read-only:bg-slate-50 read-only:text-slate-500"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Phone
                <input
                  type="tel"
                  autoComplete="tel"
                  value={staffForm.phone}
                  onChange={event => setStaffForm(current => ({ ...current, phone: event.target.value }))}
                  className="form-input"
                />
              </label>
              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Account access
                <select
                  value={staffForm.role}
                  onChange={event => setStaffForm(current => ({ ...current, role: event.target.value as StaffFormState['role'] }))}
                  className="form-input"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Department admin</option>
                </select>
              </label>
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Deactivating a member blocks sign-in but keeps their reports and assignment history.
            </p>

            <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0b4b3b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#07382d] disabled:opacity-60"
              >
                <Plus size={15} />
                {saving ? 'Saving…' : staffForm.id ? 'Save changes' : 'Send invitation'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
