import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  ArrowLeft, MapPin, Clock, User, Phone,
  ShieldAlert, Truck, X, ExternalLink, Users, Sparkles, UserRound, Check
} from 'lucide-react';
import { AssignedTeamMember, DEPARTMENT_ROLES, DepartmentRole } from '../../lib/departmentRoles';

interface DispatchTeam {
  id: string;
  name: string;
  members: AssignedTeamMember[];
}

interface DispatchStaff {
  id: string;
  full_name: string | null;
  role: 'admin' | 'staff';
}

type AssignmentMode = 'auto' | 'team' | 'worker';

export default function ReportDetail() {
  const { deptCode, id } = useParams<{ deptCode: string, id: string }>();
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  // State for modals and actions
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('NEW');
  const [statusNote, setStatusNote] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [selectedWorkerRole, setSelectedWorkerRole] = useState<DepartmentRole>('General Worker');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('auto');
  const [assignmentMembers, setAssignmentMembers] = useState<AssignedTeamMember[]>([]);
  const [teams, setTeams] = useState<DispatchTeam[]>([]);
  const [assignmentError, setAssignmentError] = useState('');
  const [loadingRecommendation, setLoadingRecommendation] = useState(false);
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [staffList, setStaffList] = useState<DispatchStaff[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [activePhoto, setActivePhoto] = useState<string | null>(null);
  const recommendationRequestId = useRef(0);

  async function fetchReport() {
    if (!id) return;
    try {
      const { data } = await supabase
        .from('reports')
        .select(`
          *,
          categories(name, color),
          profiles!user_id(full_name, phone),
          status_history(*, profiles:changed_by(full_name)),
          assignments(
            *,
            profiles:assigned_to(full_name),
            teams(name),
            assignment_members(*, profiles:profile_id(full_name))
          ),
          report_photos(image_url)
        `)
        .eq('id', id)
        .single();

      setReport(data);
      if (data && data.status) {
        setNewStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();

    // Subscribe to real-time changes
    if (!id) return;
    const reportSubscription = supabase
      .channel(`report-changes-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports', filter: `id=eq.${id}` },
        () => fetchReport()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_history', filter: `report_id=eq.${id}` },
        () => fetchReport()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter: `report_id=eq.${id}` },
        () => fetchReport()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportSubscription);
    };
  }, [id]);

  useEffect(() => {
    async function fetchDepartmentAndStaff() {
      if (!deptCode) return;
      const { data: dept } = await supabase
        .from('departments')
        .select('id')
        .eq('code', deptCode.toUpperCase())
        .single();

      if (dept) {
        setDeptId(dept.id);
        const [staffResult, teamResult] = await Promise.all([
          supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('department_id', dept.id)
          .in('role', ['staff', 'admin'])
          .eq('is_suspended', false)
          .order('full_name'),
          supabase
            .from('teams')
            .select('id, name, team_members(profile_id, primary_role, capabilities, profiles:profile_id(full_name, is_suspended))')
            .eq('department_id', dept.id)
            .eq('is_active', true)
            .order('name'),
        ]);
        if (staffResult.error) {
          setAssignmentError(staffResult.error.message);
        } else {
          setStaffList((staffResult.data || []) as DispatchStaff[]);
        }
        if (teamResult.error) {
          setAssignmentError(teamResult.error.message);
        } else {
          setTeams((teamResult.data || []).map(team => ({
            id: team.id,
            name: team.name,
            members: (team.team_members || []).flatMap(member => {
              const profile = Array.isArray(member.profiles) ? member.profiles[0] : member.profiles;
              if (!profile || profile.is_suspended) return [];
              return [{
                profile_id: member.profile_id,
                full_name: profile.full_name || 'Staff Member',
                assigned_role: member.primary_role as DepartmentRole,
                capabilities: member.capabilities as DepartmentRole[],
                open_assignments: 0,
                is_team_lead: member.primary_role === 'Crew Lead',
              }];
            }),
          })));
        }
      }
    }
    fetchDepartmentAndStaff();
  }, [deptCode]);

  const handleStatusUpdate = async () => {
    if (!id) return;
    setUpdating(true);
    try {
      const { error } = await supabase.rpc('update_report_status', {
        p_report_id: id,
        p_new_status: newStatus,
        p_note: statusNote || null,
      });

      if (error) {
        console.error('Error updating status:', error);
        alert('Failed to update status: ' + error.message);
      } else {
        setIsStatusModalOpen(false);
        setStatusNote('');
        fetchReport();
      }
    } catch (err: any) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setUpdating(false);
    }
  };

  const loadAutoRecommendation = async () => {
    if (!id) return;
    const requestId = ++recommendationRequestId.current;
    setLoadingRecommendation(true);
    setAssignmentError('');
    const { data, error } = await supabase.rpc('get_best_dispatch_recommendation', {
      p_report_id: id,
    });
    if (requestId !== recommendationRequestId.current) return;
    setLoadingRecommendation(false);
    if (error) {
      setAssignmentError(error.message);
      setAssignmentMembers([]);
      setSelectedTeamId('');
      return;
    }

    const recommendation = data as {
      team_id: string | null;
      team_name: string | null;
      members: AssignedTeamMember[];
    } | null;
    if (!recommendation?.team_id || !Array.isArray(recommendation.members) || recommendation.members.length === 0) {
      setAssignmentError('No active team is available for this report. Choose a team or assign an individual worker.');
      setAssignmentMembers([]);
      setSelectedTeamId('');
      return;
    }
    setSelectedTeamId(recommendation.team_id);
    setAssignmentMembers(recommendation.members);
  };

  const openAssignmentModal = () => {
    setAssignmentMode('auto');
    setSelectedStaffId('');
    setSelectedTeamId('');
    setAssignmentMembers([]);
    setAssignmentError('');
    setIsAssignModalOpen(true);
    void loadAutoRecommendation();
  };

  const handleAssignmentMode = (mode: AssignmentMode) => {
    if (mode !== 'auto') {
      recommendationRequestId.current += 1;
      setLoadingRecommendation(false);
    }
    setAssignmentMode(mode);
    setAssignmentError('');
    setSelectedTeamId('');
    setSelectedStaffId('');
    setAssignmentMembers([]);
    if (mode === 'auto') void loadAutoRecommendation();
  };

  const handleTeamSelection = (teamId: string) => {
    setSelectedTeamId(teamId);
    const team = teams.find(item => item.id === teamId);
    setAssignmentMembers(team?.members || []);
    setAssignmentError('');
  };

  const handleWorkerSelection = (profileId: string) => {
    setSelectedStaffId(profileId);
    const existingRole = teams.flatMap(team => team.members)
      .find(member => member.profile_id === profileId)?.assigned_role;
    setSelectedWorkerRole(existingRole || 'General Worker');
  };

  const updateAssignmentRole = (profileId: string, role: DepartmentRole) => {
    setAssignmentMembers(current => current.map(member => member.profile_id === profileId
      ? { ...member, assigned_role: role, is_team_lead: role === 'Crew Lead' }
      : member));
  };

  const handleCrewAssignment = async () => {
    if (!id || !deptId) return;
    const isWorkerAssignment = assignmentMode === 'worker';
    const selectedTeam = teams.find(team => team.id === selectedTeamId);
    const members = isWorkerAssignment
      ? selectedStaffId
        ? [{
            profile_id: selectedStaffId,
            assigned_role: selectedWorkerRole,
            is_team_lead: selectedWorkerRole === 'Crew Lead',
          }]
        : []
      : assignmentMembers.map(member => ({
          profile_id: member.profile_id,
          assigned_role: member.assigned_role,
          is_team_lead: member.is_team_lead,
        }));

    if ((isWorkerAssignment && !selectedStaffId) || (!isWorkerAssignment && !selectedTeamId)) {
      setAssignmentError('Choose a worker or team to continue.');
      return;
    }
    if (!members.length) {
      setAssignmentError('The selected team has no active members to assign.');
      return;
    }
    if (!isWorkerAssignment && members.filter(member => member.assigned_role === 'Crew Lead').length !== 1) {
      setAssignmentError('Assign exactly one Crew Lead before dispatching this team.');
      return;
    }

    setUpdating(true);
    setAssignmentError('');
    try {
      const { error: assignError } = await supabase.rpc('save_report_assignment', {
        p_report_id: id,
        p_worker_id: isWorkerAssignment ? selectedStaffId : null,
        p_team_id: isWorkerAssignment ? null : selectedTeamId,
        p_notes: assignmentNotes || null,
        p_members: members,
      });

      if (assignError) {
        setAssignmentError(assignError.message);
        return;
      }

      const assignmentLabel = isWorkerAssignment
        ? staffList.find(staff => staff.id === selectedStaffId)?.full_name || 'Staff member'
        : selectedTeam?.name || 'Selected team';
      const { error: statusError } = await supabase.rpc('update_report_status', {
        p_report_id: id,
        p_new_status: 'IN_PROGRESS',
        p_note: `Assigned to ${assignmentLabel}. Notes: ${assignmentNotes || 'None'}`,
      });

      setIsAssignModalOpen(false);
      setAssignmentNotes('');
      setSelectedStaffId('');
      setSelectedTeamId('');
      setAssignmentMembers([]);
      await fetchReport();
      if (statusError) {
        alert(`Assignment saved, but the report status could not be updated: ${statusError.message}`);
      }
    } catch (err: any) {
      console.error(err);
      setAssignmentError(err.message || 'An unexpected error occurred while assigning this report.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 space-y-3">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-xs font-medium text-slate-500">Loading incident record…</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center p-6">
        <ShieldAlert size={40} className="text-slate-300 mb-3" />
        <h2 className="text-lg font-bold text-slate-800">Report Not Found</h2>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          The requested report could not be located in this department.
        </p>
        <Link
          to={`/dept/${deptCode}/reports`}
          className="mt-4 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
        >
          Return to Reports List
        </Link>
      </div>
    );
  }

  const currentAssignmentMembers = report.assignments?.assignment_members || [];
  const currentAssignmentName = report.assignments?.teams?.name
    || report.assignments?.profiles?.full_name
    || 'Staff member';

  return (
    <div className="space-y-5">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1 border-b border-slate-200">
        <div className="flex items-center space-x-3">
          <Link
            to={`/dept/${deptCode}/reports`}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Back to Reports"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-lg font-bold text-slate-900 font-mono">
                Report #{report.id.substring(0, 8)}
              </h1>
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                {report.status}
              </span>
              <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                report.severity === 'critical' ? 'bg-red-50 text-red-700 border border-red-200' :
                report.severity === 'high' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                'bg-slate-100 text-slate-600 border border-slate-200'
              }`}>
                {report.severity || 'Normal'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5">
              <Clock size={12} />
              <span>Filed on {new Date(report.created_at).toLocaleString()}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={() => setIsStatusModalOpen(true)}
            className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
          >
            Update Status
          </button>
          <button
            onClick={openAssignmentModal}
            className="px-3.5 py-1.5 bg-slate-900 text-white font-medium text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-2xs flex items-center space-x-1.5"
          >
            <Truck size={14} />
            <span>Assign Crew</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Details & Evidence & Timeline */}
        <div className="lg:col-span-2 space-y-5">
          {/* Main Description Card */}
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center space-x-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: report.categories?.color || '#2563eb' }}
                />
                <h2 className="text-sm font-bold text-slate-900">
                  {report.categories?.name || 'General Civic Issue'}
                </h2>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                ID: {report.id}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                Citizen Issue Description
              </span>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap font-normal">
                {report.description || 'No detailed description provided by the citizen.'}
              </p>
            </div>
          </div>

          {/* Evidence Photos */}
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
              <h2 className="text-sm font-bold text-slate-900">Photo Evidence</h2>
              <span className="text-xs text-slate-400">
                {Array.isArray(report.report_photos) ? report.report_photos.length : 0} photos attached
              </span>
            </div>

            {Array.isArray(report.report_photos) && report.report_photos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {report.report_photos.map((photo: any, index: number) => {
                  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/report-photos/${photo.image_url}`;
                  return (
                    <div
                      key={index}
                      onClick={() => setActivePhoto(url)}
                      className="aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group relative"
                    >
                      <img
                        src={url}
                        alt={`Evidence ${index + 1}`}
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-200"
                      />
                      <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/20 transition-colors flex items-center justify-center">
                        <span className="text-white opacity-0 group-hover:opacity-100 text-xs font-medium">Click to expand</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No photographic evidence was attached to this report.
              </div>
            )}
          </div>

          {/* Timeline & Audit History */}
          <div className="enterprise-card p-5">
            <h2 className="text-sm font-bold text-slate-900 mb-4 border-b border-slate-100 pb-3">
              Audit & Resolution History
            </h2>

            <div className="relative border-l-2 border-slate-200 ml-3 space-y-5">
              {/* Submission Milestone */}
              <div className="relative pl-5">
                <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-slate-400" />
                <p className="text-xs font-semibold text-slate-900">Report Registered in Bedrock System</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{new Date(report.created_at).toLocaleString()}</p>
              </div>

              {/* Status History */}
              {Array.isArray(report.status_history) && report.status_history
                .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
                .map((history: any) => (
                  <div key={history.id} className="relative pl-5">
                    <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-blue-600" />
                    <p className="text-xs font-semibold text-slate-900">
                      Status transitioned to: <span className="text-blue-700 font-bold">{history.new_status}</span>
                    </p>
                    {history.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 max-w-lg leading-relaxed">
                        {history.note}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      By {history.profiles?.full_name || 'System / Staff'} · {new Date(history.changed_at).toLocaleString()}
                    </p>
                  </div>
                ))}

              {/* Current Assignment */}
              {report.assignments && (
                <div className="relative pl-5">
                  <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-white bg-emerald-600" />
                  <p className="text-xs font-semibold text-slate-900">
                    Assigned to: <span className="text-emerald-700 font-bold">{currentAssignmentName}</span>
                  </p>
                  {currentAssignmentMembers.length > 0 && (
                    <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                      {currentAssignmentMembers.map((member: Record<string, any>) => (
                        <li key={member.profile_id}>
                          {member.profiles?.full_name || 'Staff member'} · {member.assigned_role}
                        </li>
                      ))}
                    </ul>
                  )}
                  {report.assignments.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-200 mt-1 max-w-lg">
                      Instructions: {report.assignments.notes}
                    </p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Assigned on {new Date(report.assignments.assigned_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Metadata Cards */}
        <div className="space-y-5">
          {/* Location Details Card */}
          <div className="enterprise-card p-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MapPin size={14} className="text-slate-400" />
              <span>Incident Location</span>
            </h3>
            <p className="text-xs font-medium text-slate-800 bg-slate-50 p-2.5 rounded-lg border border-slate-200 leading-relaxed">
              {report.address || `${report.latitude}, ${report.longitude}`}
            </p>
            {report.latitude && report.longitude && (
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span className="font-mono text-[11px]">
                  {Number(report.latitude).toFixed(5)}, {Number(report.longitude).toFixed(5)}
                </span>
                <a
                  href={`https://www.google.com/maps?q=${report.latitude},${report.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <span>Google Maps</span>
                  <ExternalLink size={11} />
                </a>
              </div>
            )}
          </div>

          {/* Assigned Team or Worker */}
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-slate-400" />
                <span>Assigned team or worker</span>
              </h3>
              <button
                onClick={openAssignmentModal}
                className="text-xs text-primary font-semibold hover:underline"
              >
                {report.assignments ? 'Reassign' : 'Assign'}
              </button>
            </div>

            {report.assignments ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
                <p className="text-xs font-semibold text-slate-900">
                  {currentAssignmentName}
                </p>
                {currentAssignmentMembers.length > 0 && (
                  <div className="space-y-1 pt-2">
                    {currentAssignmentMembers.map((member: Record<string, any>) => (
                      <p key={member.profile_id} className="flex items-center justify-between gap-2 text-[11px] text-slate-600">
                        <span>{member.profiles?.full_name || 'Staff member'}</span>
                        <span className="rounded bg-white px-2 py-0.5 font-medium text-slate-500">{member.assigned_role}</span>
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-slate-500">
                  Assigned on {new Date(report.assignments.assigned_at).toLocaleDateString()}
                </p>
                {report.assignments.notes && (
                  <p className="text-xs text-slate-600 pt-1.5 border-t border-slate-200/60 mt-1">
                    {report.assignments.notes}
                  </p>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 border border-dashed border-slate-200 rounded-lg">
                No crew currently assigned.
              </div>
            )}
          </div>

          {/* Citizen Reporter Card */}
          <div className="enterprise-card p-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <User size={14} className="text-slate-400" />
              <span>Citizen Reporter</span>
            </h3>

            {!report.is_anonymous && report.profiles ? (
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                <div className="flex items-center space-x-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center">
                    {report.profiles.full_name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900">
                      {report.profiles.full_name || 'Verified Citizen'}
                    </p>
                    <p className="text-[10px] text-slate-500 font-medium">Registered account</p>
                  </div>
                </div>
                {report.profiles.phone && (
                  <div className="flex items-center space-x-2 text-xs text-slate-600 pt-2 border-t border-slate-200/60">
                    <Phone size={13} className="text-slate-400" />
                    <span>{report.profiles.phone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
                <p className="font-semibold text-slate-700">Anonymous Submission</p>
                <p className="text-[11px] text-slate-400 mt-0.5">Citizen chose to withhold contact identity.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lightbox / Expanded Photo Preview Modal */}
      {activePhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-4xl max-h-[85vh] bg-white rounded-xl overflow-hidden shadow-2xl p-2" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 p-1.5 bg-slate-900/70 hover:bg-slate-900 text-white rounded-full z-10"
            >
              <X size={16} />
            </button>
            <img src={activePhoto} alt="Full view" className="max-h-[80vh] w-auto object-contain rounded-lg" />
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Update Incident Status</h3>
                <p className="text-xs text-slate-500">Record a status transition in the audit history.</p>
              </div>
              <button onClick={() => setIsStatusModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-3.5">
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Select Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-primary"
                >
                  <option value="NEW">NEW — Unreviewed</option>
                  <option value="IN_PROGRESS">IN_PROGRESS — Field crew dispatched</option>
                  <option value="RESOLVED">RESOLVED — Incident repaired / closed</option>
                  <option value="REJECTED">REJECTED — Duplicate or invalid</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">Audit Explanation / Note</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Provide context on work completed or reason for status change..."
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-primary min-h-[90px]"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end space-x-2">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updating}
                className="px-3.5 py-1.5 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 text-xs flex items-center space-x-1.5 disabled:opacity-50"
              >
                {updating && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <span>Save Status</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Worker or Team Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
          <div role="dialog" aria-modal="true" aria-labelledby="assignment-dialog-title" className="bg-white rounded-xl border border-slate-200 shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-slate-100 flex items-start justify-between gap-4">
              <div>
                <h3 id="assignment-dialog-title" className="text-lg font-semibold text-slate-900">Assign report</h3>
                <p className="mt-1 text-sm text-slate-500">Choose a suggested team, a saved team, or one worker.</p>
              </div>
              <button onClick={() => setIsAssignModalOpen(false)} aria-label="Close assignment dialog" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {assignmentError && (
                <div role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                  {assignmentError}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-3">
                {([
                  { value: 'auto', title: 'Auto-dispatch', icon: Sparkles },
                  { value: 'team', title: 'Choose a team', icon: Users },
                  { value: 'worker', title: 'Choose a worker', icon: UserRound },
                ] as const).map(option => {
                  const Icon = option.icon;
                  const active = assignmentMode === option.value;
                  return (
                    <button
                      type="button"
                      key={option.value}
                      aria-pressed={active}
                      onClick={() => handleAssignmentMode(option.value)}
                      className={`flex items-center justify-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold transition ${
                        active
                          ? 'border-[#a9c5ad] bg-[#e6f2e9] text-[#0b4b3b]'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <Icon size={15} />
                      {option.title}
                    </button>
                  );
                })}
              </div>

              {assignmentMode === 'auto' && (
                <div className="rounded-lg border border-[#dce9dd] bg-[#f4f8f2] p-4">
                  <div className="flex items-start gap-3">
                    <Sparkles size={17} className="mt-0.5 shrink-0 text-[#0b4b3b]" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[#15352b]">
                        {loadingRecommendation
                          ? 'Finding the best available team…'
                          : teams.find(team => team.id === selectedTeamId)?.name || 'Automatic team suggestion'}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-600">
                        The suggestion prioritizes category-matched teams and lower active workload. Review the crew and roles below before assigning.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {assignmentMode === 'team' && (
                <label className="block space-y-2 text-sm font-medium text-slate-700">
                  Saved team
                  <select
                    value={selectedTeamId}
                    onChange={event => handleTeamSelection(event.target.value)}
                    className="form-input"
                  >
                    <option value="">Choose a team</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </label>
              )}

              {assignmentMode === 'worker' && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    Staff member
                    <select
                      value={selectedStaffId}
                      onChange={event => handleWorkerSelection(event.target.value)}
                      className="form-input"
                    >
                      <option value="">Choose a worker</option>
                      {staffList.map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.full_name || 'Staff member'} · {staff.role}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block space-y-2 text-sm font-medium text-slate-700">
                    Assignment role
                    <select
                      value={selectedWorkerRole}
                      onChange={event => setSelectedWorkerRole(event.target.value as DepartmentRole)}
                      className="form-input"
                    >
                      {DEPARTMENT_ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {assignmentMode !== 'worker' && assignmentMembers.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-slate-800">Proposed crew</h4>
                    <span className="text-xs text-slate-500">{assignmentMembers.length} workers</span>
                  </div>
                  <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {assignmentMembers.map(member => (
                      <div key={member.profile_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {member.full_name}
                            {member.is_team_lead && <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-semibold text-[#0b4b3b]"><Check size={12} />Lead</span>}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {member.open_assignments} open assignments
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <select
                            value={member.assigned_role}
                            onChange={event => updateAssignmentRole(member.profile_id, event.target.value as DepartmentRole)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-2 text-xs text-slate-700 focus:border-primary focus:outline-none"
                          >
                            {member.capabilities.map(role => <option key={role} value={role}>{role}</option>)}
                          </select>
                          <button
                            type="button"
                            aria-label={`Remove ${member.full_name} from this assignment`}
                            onClick={() => setAssignmentMembers(current => current.filter(item => item.profile_id !== member.profile_id))}
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {assignmentMode === 'team' && selectedTeamId && assignmentMembers.length === 0 && (
                <p className="rounded-md border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
                  This team has no active members.
                </p>
              )}

              <label className="block space-y-2 text-sm font-medium text-slate-700">
                Dispatch notes
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Add scope of work or instructions for the assigned staff."
                  className="form-input min-h-[90px] resize-y"
                />
              </label>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-3 py-1.5 border border-slate-200 text-slate-600 font-medium rounded-lg hover:bg-slate-100 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleCrewAssignment}
                disabled={
                  updating
                  || loadingRecommendation
                  || (assignmentMode === 'worker' ? !selectedStaffId : !selectedTeamId || assignmentMembers.length === 0)
                  || (assignmentMode !== 'worker' && assignmentMembers.filter(member => member.assigned_role === 'Crew Lead').length !== 1)
                }
                className="px-3.5 py-2 bg-[#0b4b3b] text-white font-semibold rounded-md hover:bg-[#07382d] text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {updating && <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                <span>{updating ? 'Assigning…' : 'Confirm assignment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
