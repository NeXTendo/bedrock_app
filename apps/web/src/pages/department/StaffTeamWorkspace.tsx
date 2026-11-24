import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock, Save, ShieldCheck, Users } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import type { DepartmentRole } from '../../lib/departmentRoles';
import { supabase } from '../../lib/supabase';

type ProgressStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETE';

interface TeamMember {
  profile_id: string;
  full_name: string | null;
  primary_role: DepartmentRole;
  capabilities: DepartmentRole[];
  is_suspended: boolean;
}

interface StaffTeam {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  members: TeamMember[];
}

interface AssignmentMember {
  profile_id: string;
  full_name: string | null;
  assigned_role: DepartmentRole;
  is_team_lead: boolean;
  progress_status: ProgressStatus;
  progress_note: string | null;
  progress_updated_at: string | null;
}

interface TeamJob {
  id: string;
  report_id: string;
  team_id: string;
  assigned_at: string;
  notes: string | null;
  members: AssignmentMember[];
  report: {
    id: string;
    description: string | null;
    status: string;
    severity: string;
    priority: number;
    created_at: string;
    address: string | null;
    categories: { name: string; color: string } | null;
  } | null;
}

interface ProgressDraft {
  status: ProgressStatus;
  note: string;
}

const progressOptions: { value: ProgressStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not started' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'COMPLETE', label: 'Complete' },
];

function normalizeProfile(profile: { full_name: string | null; is_suspended: boolean } | Array<{ full_name: string | null; is_suspended: boolean }> | null | undefined) {
  return Array.isArray(profile) ? profile[0] : profile;
}

export default function StaffTeamWorkspace() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const { profile } = useAuth();
  const [teams, setTeams] = useState<StaffTeam[]>([]);
  const [jobs, setJobs] = useState<TeamJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingAction, setSavingAction] = useState('');
  const [roleDrafts, setRoleDrafts] = useState<Record<string, Record<string, DepartmentRole>>>({});
  const [progressDrafts, setProgressDrafts] = useState<Record<string, Record<string, ProgressDraft>>>({});

  const loadWorkspace = useCallback(async () => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data: membershipRows, error: membershipsError } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('profile_id', profile.id);

    if (membershipsError) {
      setError(membershipsError.message);
      setLoading(false);
      return;
    }

    const teamIds = [...new Set((membershipRows || []).map(row => row.team_id))];
    if (teamIds.length === 0) {
      setTeams([]);
      setJobs([]);
      setRoleDrafts({});
      setProgressDrafts({});
      setLoading(false);
      return;
    }

    const [teamsResult, membersResult, assignmentsResult] = await Promise.all([
      supabase
        .from('teams')
        .select('id, name, description, is_active')
        .in('id', teamIds)
        .order('name'),
      supabase
        .from('team_members')
        .select('team_id, profile_id, primary_role, capabilities, profiles:profile_id(full_name, is_suspended)')
        .in('team_id', teamIds),
      supabase
        .from('assignments')
        .select('id, report_id, team_id, assigned_at, notes, assignment_members(profile_id, assigned_role, is_team_lead, progress_status, progress_note, progress_updated_at, profiles:profile_id(full_name))')
        .in('team_id', teamIds)
        .order('assigned_at', { ascending: false }),
    ]);

    const queryError = teamsResult.error || membersResult.error || assignmentsResult.error;
    if (queryError) {
      setError(queryError.message);
      setLoading(false);
      return;
    }

    const assignmentRows = assignmentsResult.data || [];
    const reportIds = [...new Set(assignmentRows.map(assignment => assignment.report_id))];
    const { data: reportRows, error: reportsError } = reportIds.length > 0
      ? await supabase
        .from('department_reports')
        .select('id, description, status, severity, priority, created_at, address, categories')
        .in('id', reportIds)
      : { data: [], error: null };

    if (reportsError) {
      setError(reportsError.message);
      setLoading(false);
      return;
    }

    const reportById = new Map((reportRows || []).map(report => [report.id, report]));
    const membersByTeam = new Map<string, TeamMember[]>();
    for (const row of membersResult.data || []) {
      const person = normalizeProfile(row.profiles);
      const members = membersByTeam.get(row.team_id) || [];
      members.push({
        profile_id: row.profile_id,
        full_name: person?.full_name || null,
        primary_role: row.primary_role as DepartmentRole,
        capabilities: row.capabilities as DepartmentRole[],
        is_suspended: person?.is_suspended ?? false,
      });
      membersByTeam.set(row.team_id, members);
    }

    setTeams((teamsResult.data || []).map(team => ({
      ...team,
      members: membersByTeam.get(team.id) || [],
    })));
    setJobs(assignmentRows.map(assignment => ({
      ...assignment,
      members: (assignment.assignment_members || []).map(member => {
        const person = normalizeProfile(member.profiles);
        return {
          ...member,
          full_name: person?.full_name || null,
          assigned_role: member.assigned_role as DepartmentRole,
          progress_status: (member.progress_status || 'NOT_STARTED') as ProgressStatus,
        };
      }),
      report: reportById.get(assignment.report_id) || null,
    })) as TeamJob[]);
    setRoleDrafts({});
    setProgressDrafts({});
    setLoading(false);
  }, [profile?.id]);

  useEffect(() => {
    void loadWorkspace();
  }, [loadWorkspace]);

  const jobsByTeam = useMemo(() => {
    const grouped = new Map<string, TeamJob[]>();
    for (const job of jobs) {
      const list = grouped.get(job.team_id) || [];
      list.push(job);
      grouped.set(job.team_id, list);
    }
    return grouped;
  }, [jobs]);

  const getRole = (job: TeamJob, member: AssignmentMember) =>
    roleDrafts[job.id]?.[member.profile_id] || member.assigned_role;

  const getProgress = (job: TeamJob, member: AssignmentMember): ProgressDraft =>
    progressDrafts[job.id]?.[member.profile_id] || {
      status: member.progress_status,
      note: member.progress_note || '',
    };

  const hasRoleChanges = (job: TeamJob) =>
    job.members.some(member => getRole(job, member) !== member.assigned_role);

  const saveRoles = async (job: TeamJob) => {
    setSavingAction(`${job.id}:roles`);
    setError('');
    const { error: saveError } = await supabase.rpc('update_assigned_team_roles', {
      p_assignment_id: job.id,
      p_members: job.members.map(member => ({
        profile_id: member.profile_id,
        assigned_role: getRole(job, member),
      })),
    });

    if (saveError) {
      setError(saveError.message);
      setSavingAction('');
      return;
    }

    setSavingAction('');
    await loadWorkspace();
  };

  const saveProgress = async (job: TeamJob, member: AssignmentMember) => {
    const draft = getProgress(job, member);
    const actionId = `${job.id}:progress:${member.profile_id}`;
    setSavingAction(actionId);
    setError('');
    const { error: saveError } = await supabase.rpc('update_assignment_member_progress', {
      p_assignment_id: job.id,
      p_member_profile_id: member.profile_id,
      p_progress_status: draft.status,
      p_progress_note: draft.note.trim() || null,
    });

    if (saveError) {
      setError(saveError.message);
      setSavingAction('');
      return;
    }

    setSavingAction('');
    await loadWorkspace();
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-20 rounded-xl bg-slate-200/70" />
        <div className="h-64 rounded-xl bg-slate-200/70" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2 text-[#0b4b3b]">
          <Users size={18} />
          <span className="text-xs font-semibold uppercase tracking-wider">Team workspace</span>
        </div>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">My Team</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          View your crew and assigned jobs. Crew Leads manage job roles and each member’s field progress.
        </p>
      </header>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {teams.length === 0 ? (
        <section className="enterprise-card flex flex-col items-center px-6 py-14 text-center">
          <Users size={24} className="text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">You are not on a team yet</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-500">
            Your individual assignments remain available from the Assignments tab. Contact your department administrator if you need team access.
          </p>
          <Link to={`/dept/${deptCode}/dispatch`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#0b4b3b] hover:underline">
            View my assignments <ArrowUpRight size={15} />
          </Link>
        </section>
      ) : (
        teams.map(team => {
          const teamJobs = jobsByTeam.get(team.id) || [];
          return (
            <section key={team.id} className="enterprise-card overflow-hidden">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900">{team.name}</h2>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      team.is_active ? 'bg-[#e6f2e9] text-[#0b4b3b]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {team.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{team.description || 'Department field team'}</p>
                </div>
                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <Users size={14} />
                  {team.members.length} team members
                </div>
              </div>

              <div className="grid gap-5 p-5 xl:grid-cols-[minmax(240px,.75fr)_minmax(0,1.5fr)]">
                <div>
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">Crew roster</h3>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {team.members.map(member => (
                      <div key={member.profile_id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {member.full_name || 'Team member'}
                            {member.profile_id === profile?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {member.primary_role}{member.is_suspended ? ' · inactive' : ''}
                          </p>
                        </div>
                        {member.primary_role === 'Crew Lead' && (
                          <span title="Team role" className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f0f6f0] px-2 py-1 text-[10px] font-semibold text-[#0b4b3b]">
                            <ShieldCheck size={12} /> Lead
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Team assignments</h3>
                    <span className="text-xs text-slate-400">{teamJobs.length} assigned jobs</span>
                  </div>

                  {teamJobs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">
                      No team jobs have been dispatched yet.
                    </div>
                  ) : teamJobs.map(job => {
                    const isLead = job.members.some(member =>
                      member.profile_id === profile?.id && member.is_team_lead
                    );
                    const closed = ['RESOLVED', 'REJECTED'].includes(job.report?.status || '');
                    const teamMemberById = new Map(team.members.map(member => [member.profile_id, member]));
                    const roleSaveKey = `${job.id}:roles`;

                    return (
                      <article key={job.id} className="rounded-lg border border-slate-200 bg-white">
                        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="font-semibold text-slate-900">
                                {job.report?.categories?.name || 'Assigned job'}
                              </h4>
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                                {job.report?.status || 'Unavailable'}
                              </span>
                              {job.report?.severity && (
                                <span className="text-[10px] font-semibold uppercase text-slate-500">
                                  {job.report.severity}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">
                              {job.report?.description || 'No description provided.'}
                            </p>
                            <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                              <Clock size={12} />
                              Assigned {new Date(job.assigned_at).toLocaleString()}
                            </p>
                          </div>
                          <Link
                            to={`/dept/${deptCode}/reports/${job.report_id}`}
                            className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[#0b4b3b] hover:underline"
                          >
                            Open job <ArrowUpRight size={13} />
                          </Link>
                        </div>

                        {job.notes && (
                          <p className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 text-xs leading-5 text-slate-600">
                            Dispatch note: {job.notes}
                          </p>
                        )}

                        <div className="divide-y divide-slate-100">
                          {job.members.map(member => {
                            const teamMember = teamMemberById.get(member.profile_id);
                            const progress = getProgress(job, member);
                            const progressSaveKey = `${job.id}:progress:${member.profile_id}`;
                            return (
                              <div key={member.profile_id} className="grid gap-3 p-4 lg:grid-cols-[minmax(110px,.7fr)_minmax(150px,1fr)_minmax(180px,1.2fr)_minmax(180px,1.4fr)] lg:items-start">
                                <div>
                                  <p className="text-sm font-medium text-slate-800">
                                    {member.full_name || 'Team member'}
                                    {member.profile_id === profile?.id && <span className="ml-1 text-xs text-slate-400">(you)</span>}
                                  </p>
                                  {member.is_team_lead && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b4b3b]">
                                      <ShieldCheck size={11} /> Crew Lead
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <label htmlFor={`role-${job.id}-${member.profile_id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Job role
                                  </label>
                                  {isLead && !closed && teamMember ? (
                                    <select
                                      id={`role-${job.id}-${member.profile_id}`}
                                      value={getRole(job, member)}
                                      onChange={event => {
                                        const role = event.target.value as DepartmentRole;
                                        setRoleDrafts(current => ({
                                          ...current,
                                          [job.id]: { ...current[job.id], [member.profile_id]: role },
                                        }));
                                      }}
                                      className="form-input w-full text-xs"
                                    >
                                      {teamMember.capabilities.map(capability => (
                                        <option key={capability} value={capability}>{capability}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <p className="pt-2 text-xs text-slate-700">{member.assigned_role}</p>
                                  )}
                                </div>

                                <div>
                                  <label htmlFor={`progress-${job.id}-${member.profile_id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Individual progress
                                  </label>
                                  {isLead && !closed ? (
                                    <div className="flex gap-2">
                                      <select
                                        id={`progress-${job.id}-${member.profile_id}`}
                                        value={progress.status}
                                        onChange={event => {
                                          const status = event.target.value as ProgressStatus;
                                          setProgressDrafts(current => ({
                                            ...current,
                                            [job.id]: {
                                              ...current[job.id],
                                              [member.profile_id]: { ...progress, status },
                                            },
                                          }));
                                        }}
                                        className="form-input min-w-0 flex-1 text-xs"
                                      >
                                        {progressOptions.map(option => (
                                          <option key={option.value} value={option.value}>{option.label}</option>
                                        ))}
                                      </select>
                                      <button
                                        type="button"
                                        onClick={() => void saveProgress(job, member)}
                                        disabled={savingAction === progressSaveKey}
                                        aria-label={`Save ${member.full_name || 'member'} progress`}
                                        title="Save progress"
                                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-[#0b4b3b] hover:bg-[#f0f6f0] disabled:opacity-50"
                                      >
                                        {savingAction === progressSaveKey
                                          ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0b4b3b]/30 border-t-[#0b4b3b]" />
                                          : <Save size={14} />}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className={`inline-flex items-center gap-1.5 pt-1 text-xs font-medium ${
                                      member.progress_status === 'COMPLETE'
                                        ? 'text-emerald-700'
                                        : member.progress_status === 'BLOCKED'
                                          ? 'text-amber-700'
                                          : 'text-slate-600'
                                    }`}>
                                      {member.progress_status === 'COMPLETE'
                                        ? <CheckCircle2 size={13} />
                                        : member.progress_status === 'BLOCKED'
                                          ? <AlertCircle size={13} />
                                          : <Clock size={13} />}
                                      {progressOptions.find(option => option.value === member.progress_status)?.label || 'Not started'}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <label htmlFor={`progress-note-${job.id}-${member.profile_id}`} className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    Progress note
                                  </label>
                                  {isLead && !closed ? (
                                    <textarea
                                      id={`progress-note-${job.id}-${member.profile_id}`}
                                      maxLength={1000}
                                      rows={2}
                                      value={progress.note}
                                      onChange={event => {
                                        const note = event.target.value;
                                        setProgressDrafts(current => ({
                                          ...current,
                                          [job.id]: {
                                            ...current[job.id],
                                            [member.profile_id]: { ...progress, note },
                                          },
                                        }));
                                      }}
                                      placeholder="Optional update or blocker"
                                      className="form-input w-full resize-y text-xs"
                                    />
                                  ) : (
                                    <p className="pt-1 text-xs leading-5 text-slate-600">{member.progress_note || 'No update yet'}</p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {isLead && !closed && hasRoleChanges(job) && (
                          <div className="flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3">
                            <button
                              type="button"
                              onClick={() => void saveRoles(job)}
                              disabled={savingAction === roleSaveKey}
                              className="inline-flex items-center gap-2 rounded-md bg-[#0b4b3b] px-3 py-2 text-xs font-semibold text-white hover:bg-[#07382d] disabled:opacity-60"
                            >
                              {savingAction === roleSaveKey
                                ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                                : <Save size={13} />}
                              Save job roles
                            </button>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
