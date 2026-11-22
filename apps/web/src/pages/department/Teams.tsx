import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, ChevronDown, Plus, Save, Users, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { DEPARTMENT_ROLES, type DepartmentRole } from '../../lib/departmentRoles';

interface Department {
  id: string;
  name: string;
}

interface StaffOption {
  id: string;
  full_name: string | null;
  role: 'admin' | 'staff';
  is_suspended: boolean;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface TeamMemberDraft {
  profile_id: string;
  primary_role: DepartmentRole;
  capabilities: DepartmentRole[];
}

interface TeamRecord {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  team_members: Array<{
    profile_id: string;
    primary_role: DepartmentRole;
    capabilities: DepartmentRole[];
  }>;
  team_categories: Array<{ category_id: string }>;
}

export default function Teams() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [department, setDepartment] = useState<Department | null>(null);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [members, setMembers] = useState<TeamMemberDraft[]>([]);

  const fetchData = useCallback(async () => {
    if (!deptCode) return;

    const { data: dept, error: deptError } = await supabase
      .from('departments')
      .select('id, name')
      .eq('code', deptCode.toUpperCase())
      .single();
    if (deptError || !dept) {
      setError(deptError?.message || 'Department not found');
      setLoading(false);
      return;
    }

    setDepartment(dept);
    setError('');
    const [staffResult, categoryResult, teamResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, role, is_suspended')
        .eq('department_id', dept.id)
        .in('role', ['staff', 'admin'])
        .order('full_name'),
      supabase
        .from('categories')
        .select('id, name')
        .eq('dept_id', dept.id)
        .eq('is_active', true)
        .order('sort_order'),
      supabase
        .from('teams')
        .select('id, name, description, is_active, team_members(profile_id, primary_role, capabilities), team_categories(category_id)')
        .eq('department_id', dept.id)
        .order('name'),
    ]);

    const queryError = staffResult.error || categoryResult.error || teamResult.error;
    if (queryError) {
      setError(queryError.message);
    } else {
      setStaff((staffResult.data || []) as StaffOption[]);
      setCategories(categoryResult.data || []);
      setTeams((teamResult.data || []) as TeamRecord[]);
    }
    setLoading(false);
  }, [deptCode]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) void fetchData();
    });
    return () => {
      cancelled = true;
    };
  }, [fetchData]);

  const activeStaff = useMemo(() => staff.filter(member => !member.is_suspended), [staff]);

  const resetForm = () => {
    setFormOpen(false);
    setEditingTeamId(null);
    setName('');
    setDescription('');
    setCategoryIds([]);
    setMembers([]);
    setError('');
  };

  const startCreate = () => {
    resetForm();
    setFormOpen(true);
  };

  const startEdit = (team: TeamRecord) => {
    setEditingTeamId(team.id);
    setName(team.name);
    setDescription(team.description || '');
    setCategoryIds(team.team_categories.map(category => category.category_id));
    setMembers(team.team_members.map(member => ({
      profile_id: member.profile_id,
      primary_role: member.primary_role,
      capabilities: member.capabilities || [member.primary_role],
    })));
    setFormOpen(true);
    setError('');
  };

  const addMember = () => {
    const available = activeStaff.find(person => !members.some(member => member.profile_id === person.id));
    if (!available) {
      setError('All active department staff are already on this team.');
      return;
    }
    const isFirst = members.length === 0;
    const primaryRole: DepartmentRole = isFirst ? 'Crew Lead' : 'General Worker';
    setMembers(current => [...current, {
      profile_id: available.id,
      primary_role: primaryRole,
      capabilities: [primaryRole],
    }]);
  };

  const updateMember = (index: number, patch: Partial<TeamMemberDraft>) => {
    setMembers(current => current.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      const next = { ...member, ...patch };
      if (patch.primary_role && !next.capabilities.includes(patch.primary_role)) {
        next.capabilities = [...next.capabilities, patch.primary_role];
      }
      return next;
    }));
  };

  const toggleCapability = (index: number, capability: DepartmentRole) => {
    setMembers(current => current.map((member, memberIndex) => {
      if (memberIndex !== index) return member;
      const hasCapability = member.capabilities.includes(capability);
      const capabilities = hasCapability
        ? member.capabilities.filter(value => value !== capability)
        : [...member.capabilities, capability];
      const primaryRole = member.primary_role === capability && hasCapability
        ? capabilities[0] || 'General Worker'
        : member.primary_role;
      if (!capabilities.includes(primaryRole)) capabilities.push(primaryRole);
      return { ...member, capabilities, primary_role: primaryRole };
    }));
  };

  const saveTeam = async (event: FormEvent) => {
    event.preventDefault();
    if (!department) return;
    if (!name.trim()) {
      setError('Enter a team name.');
      return;
    }
    if (members.length === 0) {
      setError('Add at least one active team member.');
      return;
    }
    if (members.filter(member => member.primary_role === 'Crew Lead').length !== 1) {
      setError('Each team needs exactly one Crew Lead.');
      return;
    }

    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('save_department_team', {
      p_team_id: editingTeamId,
      p_department_id: department.id,
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_category_ids: categoryIds,
      p_members: members,
    });

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    resetForm();
    setSaving(false);
    await fetchData();
  };

  const toggleTeam = async (team: TeamRecord) => {
    const { error: updateError } = await supabase
      .from('teams')
      .update({ is_active: !team.is_active, updated_at: new Date().toISOString() })
      .eq('id', team.id)
      .eq('department_id', department?.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    await fetchData();
  };

  const toggleCategory = (categoryId: string) => {
    setCategoryIds(current => current.includes(categoryId)
      ? current.filter(id => id !== categoryId)
      : [...current, categoryId]);
  };

  if (loading) {
    return <div className="h-64 animate-pulse rounded-xl bg-slate-200/70" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3">
          <Link
            to={`/dept/${deptCode}/team`}
            aria-label="Back to staff"
            className="mt-1 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0b4b3b]">People & operations</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Teams</h1>
            <p className="mt-1 text-sm text-slate-500">
              Build crews and define the roles they can take on for {department?.name || 'this department'}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0b4b3b] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#07382d]"
        >
          <Plus size={16} />
          Create team
        </button>
      </header>

      {error && !formOpen && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {formOpen && (
        <form onSubmit={saveTeam} className="enterprise-card space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{editingTeamId ? 'Edit team' : 'Create a team'}</h2>
              <p className="mt-1 text-sm text-slate-500">Choose its service categories and assign each member’s roles.</p>
            </div>
            <button type="button" onClick={resetForm} aria-label="Close team form" className="rounded p-1 text-slate-400 hover:text-slate-700">
              <X size={18} />
            </button>
          </div>

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Team name
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                maxLength={80}
                required
                placeholder="e.g. North Area Response"
                className="form-input"
              />
            </label>
            <label className="block space-y-2 text-sm font-medium text-slate-700">
              Description
              <input
                value={description}
                onChange={event => setDescription(event.target.value)}
                maxLength={240}
                placeholder="What this team handles"
                className="form-input"
              />
            </label>
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold text-slate-800">Service categories</legend>
            <p className="text-xs text-slate-500">Auto-dispatch prefers teams tagged for the report category; untagged teams are general-purpose.</p>
            {categories.length === 0 ? (
              <p className="text-sm text-slate-500">No active categories are configured for this department.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {categories.map(category => {
                  const selected = categoryIds.includes(category.id);
                  return (
                    <button
                      type="button"
                      key={category.id}
                      aria-pressed={selected}
                      onClick={() => toggleCategory(category.id)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        selected
                          ? 'border-[#a9c5ad] bg-[#e6f2e9] text-[#0b4b3b]'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      {category.name}
                    </button>
                  );
                })}
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <legend className="text-sm font-semibold text-slate-800">Team roster</legend>
              <button
                type="button"
                onClick={addMember}
                disabled={members.length >= activeStaff.length}
                className="inline-flex items-center gap-1.5 rounded-md border border-[#d6ded5] px-3 py-1.5 text-xs font-semibold text-[#0b4b3b] transition hover:bg-[#f0f6f0] disabled:opacity-50"
              >
                <Plus size={14} />
                Add member
              </button>
            </div>
            {members.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-300 py-8 text-center text-sm text-slate-500">
                Add department staff to start building this team.
              </div>
            ) : (
              <div className="space-y-3">
                {members.map((member, index) => {
                  const person = staff.find(option => option.id === member.profile_id);
                  const hasOtherLead = members.some((other, otherIndex) => otherIndex !== index && other.primary_role === 'Crew Lead');
                  return (
                    <div key={`${member.profile_id}-${index}`} className="rounded-lg border border-slate-200 bg-white p-4">
                      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.8fr)_auto] lg:items-end">
                        <label className="block space-y-2 text-xs font-semibold text-slate-600">
                          Staff member
                          <select
                            value={member.profile_id}
                            onChange={event => updateMember(index, { profile_id: event.target.value })}
                            className="form-input text-sm"
                          >
                            {staff.map(option => (
                              <option
                                key={option.id}
                                value={option.id}
                                disabled={option.is_suspended || members.some((other, otherIndex) => otherIndex !== index && other.profile_id === option.id)}
                              >
                                {option.full_name || 'Staff member'}{option.is_suspended ? ' (inactive)' : ''}
                              </option>
                            ))}
                          </select>
                          {person?.role === 'admin' && <span className="block text-[11px] font-normal text-slate-400">Department admin</span>}
                        </label>
                        <label className="block space-y-2 text-xs font-semibold text-slate-600">
                          Primary role
                          <span className="relative block">
                            <select
                              value={member.primary_role}
                              onChange={event => updateMember(index, { primary_role: event.target.value as DepartmentRole })}
                              className="form-input appearance-none pr-9 text-sm"
                            >
                              {DEPARTMENT_ROLES.map(role => (
                                <option key={role} value={role} disabled={role === 'Crew Lead' && hasOtherLead}>
                                  {role}
                                </option>
                              ))}
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                          </span>
                        </label>
                        <button
                          type="button"
                          onClick={() => setMembers(current => current.filter((_, memberIndex) => memberIndex !== index))}
                          aria-label={`Remove ${person?.full_name || 'member'} from team`}
                          className="justify-self-end rounded-md p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-slate-100 pt-3">
                        {DEPARTMENT_ROLES.map(role => (
                          <label key={role} className="inline-flex items-center gap-2 text-xs text-slate-600">
                            <input
                              type="checkbox"
                              checked={member.capabilities.includes(role)}
                              onChange={() => toggleCapability(index, role)}
                              className="h-3.5 w-3.5 rounded border-slate-300 accent-[#0b4b3b]"
                            />
                            {role}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </fieldset>

          <div className="flex flex-col-reverse justify-end gap-2 border-t border-slate-100 pt-4 sm:flex-row">
            <button type="button" onClick={resetForm} className="rounded-md border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[#0b4b3b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#07382d] disabled:opacity-60"
            >
              {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" /> : <Save size={15} />}
              {editingTeamId ? 'Save changes' : 'Create team'}
            </button>
          </div>
        </form>
      )}

      {teams.length === 0 ? (
        <div className="enterprise-card flex flex-col items-center px-6 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f2e9] text-[#0b4b3b]">
            <Users size={20} />
          </span>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">No teams yet</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            Create a team, choose the work it handles, and assign each member’s operational capabilities.
          </p>
          <button type="button" onClick={startCreate} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#0b4b3b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#07382d]">
            <Plus size={15} />
            Create your first team
          </button>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {teams.map(team => (
            <article key={team.id} className={`enterprise-card p-5 ${team.is_active ? '' : 'opacity-65'}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold text-slate-900">{team.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      team.is_active ? 'bg-[#e6f2e9] text-[#0b4b3b]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{team.description || 'No description'}</p>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(team)}
                  className="shrink-0 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Edit
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {team.team_categories.length === 0 ? (
                  <span className="rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-500">General purpose</span>
                ) : (
                  team.team_categories.map(categoryLink => (
                    <span key={categoryLink.category_id} className="rounded bg-[#f0f6f0] px-2 py-1 text-[10px] font-medium text-[#0b4b3b]">
                      {categories.find(category => category.id === categoryLink.category_id)?.name || 'Category'}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
                {team.team_members.map(member => {
                  const person = staff.find(option => option.id === member.profile_id);
                  return (
                    <div key={member.profile_id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                      <span className="font-medium text-slate-700">{person?.full_name || 'Former team member'}</span>
                      <span className="flex items-center gap-1.5 text-slate-500">
                        {member.primary_role === 'Crew Lead' && <Check size={13} className="text-[#0b4b3b]" />}
                        {member.primary_role}
                        {person?.is_suspended && <span className="text-red-600">(inactive)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                <span className="text-slate-500">{team.team_members.length} team members</span>
                <button
                  type="button"
                  onClick={() => void toggleTeam(team)}
                  className="font-semibold text-[#0b4b3b] hover:underline"
                >
                  {team.is_active ? 'Deactivate team' : 'Reactivate team'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
