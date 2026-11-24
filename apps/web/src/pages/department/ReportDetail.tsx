import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ArrowLeft, MapPin, Clock, User,
  ShieldAlert, Truck, X, ExternalLink, Users, Sparkles, UserRound, Check
} from 'lucide-react';
import { AssignedTeamMember, DEPARTMENT_ROLES, DepartmentRole } from '../../lib/departmentRoles';
import { getPrivateImageUrl } from '../../lib/storage';

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

interface CurrentAssignmentMember {
  profile_id: string;
  assigned_role: string;
  is_team_lead: boolean;
  profiles?: { full_name: string | null } | null;
}

const incidentAnswerLabels: Record<string, string> = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Unsure',
};

const categoryDetailLabels: Record<string, string> = {
  issue_ongoing: 'Issue still happening',
  road_blocked: 'Road or footpath blocked',
  water_collecting: 'Water collecting at damage',
  leak_active: 'Leak still active',
  access_affected: 'Nearby access or property affected',
  waste_blocking_access: 'Waste blocking access',
  hazardous_waste: 'Possible hazardous waste',
  exposed_wires: 'Exposed wires',
  sparks_or_fire: 'Sparks or fire',
};

type AssignmentMode = 'auto' | 'team' | 'worker';

export default function ReportDetail() {
  const { deptCode, id } = useParams<{ deptCode: string, id: string }>();
  const { profile } = useAuth();
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
  const [publicDescription, setPublicDescription] = useState('');
  const [publicAddress, setPublicAddress] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [approvedPhotoIds, setApprovedPhotoIds] = useState<string[]>([]);
  const [reviewError, setReviewError] = useState('');
  const [savingReview, setSavingReview] = useState(false);
  const [togglingMap, setTogglingMap] = useState(false);
  const [toggleMapError, setToggleMapError] = useState('');
  const recommendationRequestId = useRef(0);

  async function fetchReport() {
    if (!id) return;
    try {
      const [reportResult, duplicateResult, contextResult] = await Promise.all([
        supabase
          .from('department_reports')
          .select('*')
          .eq('id', id)
          .single(),
        supabase
          .from('department_report_duplicate_flags')
          .select('duplicate_report_id, duplicate_status, duplicate_created_at')
          .eq('report_id', id)
          .maybeSingle(),
        supabase
          .from('department_report_context')
          .select('occurred_at, immediate_danger, category_details')
          .eq('id', id)
          .maybeSingle(),
      ]);

      if (reportResult.error) throw reportResult.error;
      if (duplicateResult.error) throw duplicateResult.error;
      if (contextResult.error) throw contextResult.error;
      const data = reportResult.data;

      const reportPhotos = await Promise.all((data.report_photos || []).map(async (photo: Record<string, any>) => {
        try {
          return {
            ...photo,
            signed_url: await getPrivateImageUrl(photo.image_url, photo.bucket_id || 'report-photos'),
          };
        } catch (error) {
          console.error('Unable to load report evidence:', error);
          return { ...photo, signed_url: '' };
        }
      }));

      setReport({
        ...data,
        report_photos: reportPhotos,
        potential_duplicate: duplicateResult.data,
        incident_context: contextResult.data,
      });
      setPublicDescription(data.public_description || '');
      setPublicAddress(data.public_address || '');
      setApprovedPhotoIds(reportPhotos.filter(photo => photo.is_public_approved).map(photo => photo.id));
      if (data && data.status) {
        setNewStatus(data.status);
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

  const toggleMapVisibility = async (visible: boolean) => {
    if (!id) return;
    setTogglingMap(true);
    setToggleMapError('');
    try {
      const { error } = await supabase.rpc('set_report_map_visibility', {
        p_report_id: id,
        p_visible: visible,
      });
      if (error) { setToggleMapError(error.message); return; }
      await fetchReport();
    } catch (error) {
      setToggleMapError(error instanceof Error ? error.message : 'Could not update map visibility.');
    } finally {
      setTogglingMap(false);
    }
  };

  const saveVisibilityReview = async (publish: boolean) => {
    if (!id) return;
    setSavingReview(true);
    setReviewError('');

    try {
      const { error } = await supabase.rpc('review_report_visibility', {
        p_report_id: id,
        p_publish: publish,
        p_public_description: publish ? publicDescription : null,
        p_public_address: publish ? publicAddress : null,
        p_approved_photo_ids: publish ? approvedPhotoIds : [],
        p_note: reviewNote || null,
      });

      if (error) {
        setReviewError(error.message);
        return;
      }

      setReviewNote('');
      await fetchReport();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : 'The review could not be saved.');
    } finally {
      setSavingReview(false);
    }
  };

  useEffect(() => {
    fetchReport();

    // Subscribe to real-time changes
    if (!id) return;
    const reportSubscription = supabase
      .channel(`report-changes-${id}`)
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
    const { data, error } = await supabase.rpc('admin_get_best_dispatch_recommendation', {
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
      const { error: assignError } = await supabase.rpc('dispatch_report_assignment', {
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

      setIsAssignModalOpen(false);
      setAssignmentNotes('');
      setSelectedStaffId('');
      setSelectedTeamId('');
      setAssignmentMembers([]);
      await fetchReport();
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

  const currentAssignmentMembers: CurrentAssignmentMember[] = report.assignments?.assignment_members || [];
  const incidentContext = report.incident_context;
  const categoryAnswers = Object.entries(incidentContext?.category_details || {}) as [string, string][];
  const hasFieldAssignment = Boolean(
    report.assignments?.assigned_to
    || report.assignments?.teams?.name
    || currentAssignmentMembers.length
  );
  const currentAssignmentName = report.assignments?.teams?.name
    || report.assignments?.profiles?.full_name
    || 'Staff member';
  const isAssignedStaff = profile?.role === 'staff'
    && currentAssignmentMembers.some(member => member.profile_id === profile.id);
  const isTeamLead = isAssignedStaff
    && currentAssignmentMembers.some(member => member.profile_id === profile.id && member.is_team_lead);
  const isTeamAssignment = Boolean(report.assignments?.teams?.name);
  const canResolve = profile?.role === 'admin'
    || (isAssignedStaff && (!isTeamAssignment || isTeamLead));
  const canUpdateOperationalStatus = profile?.role === 'admin'
    || (isAssignedStaff && !['RESOLVED', 'REJECTED'].includes(report.status));
  const openStatusModal = () => {
    setNewStatus(profile?.role === 'admin' ? report.status : 'IN_PROGRESS');
    setIsStatusModalOpen(true);
  };

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
          {canUpdateOperationalStatus ? (
            <button
              onClick={openStatusModal}
              className="px-3.5 py-1.5 bg-white border border-slate-200 text-slate-700 font-medium text-xs rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
            >
              Update Status
            </button>
          ) : (
            <span className="text-[11px] text-slate-500">
              Operational updates are limited to assigned workers and admins.
            </span>
          )}
          {profile?.role === 'admin' && (
            <button
              onClick={openAssignmentModal}
              className="px-3.5 py-1.5 bg-slate-900 text-white font-medium text-xs rounded-lg hover:bg-slate-800 transition-colors shadow-2xs flex items-center space-x-1.5"
            >
              <Truck size={14} />
              <span>Assign Crew</span>
            </button>
          )}
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

          {/* ── Public map toggle (quick show/hide) ── */}
          {profile?.role === 'admin' && (
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Public map visibility</h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Show or hide this report on the citizen map at any time. Reporter identity is never exposed.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  report.is_public
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                }`}>
                  {report.is_public ? 'Visible' : 'Hidden'}
                </span>
                {report.is_public ? (
                  <button
                    type="button"
                    disabled={togglingMap}
                    onClick={() => void toggleMapVisibility(false)}
                    className="px-3 py-1.5 bg-white border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {togglingMap ? '…' : 'Hide'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={togglingMap}
                    onClick={() => void toggleMapVisibility(true)}
                    className="px-3 py-1.5 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {togglingMap ? '…' : 'Show'}
                  </button>
                )}
              </div>
            </div>
            {toggleMapError && (
              <p role="alert" className="text-xs text-red-600 mt-2">{toggleMapError}</p>
            )}
          </div>
          )}

          {/* Public release review — full sanitized publish flow */}
          {profile?.role === 'admin' && (
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Public release review</h2>
                <p className="text-[11px] text-slate-500 mt-1">
                  Only the approved summary, broad area and selected photos will be public. Exact coordinates and reporter identity stay restricted.
                </p>
              </div>
              <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase ${
                report.is_public
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {report.is_public
                  ? 'Published'
                  : report.visibility_reviewed_at
                    ? 'Private · reviewed'
                    : 'Private · Needs review'}
              </span>
            </div>

            {report.potential_duplicate && (
              <div role="status" className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-900">Possible duplicate detected</p>
                <p className="text-[11px] text-amber-800 mt-1">
                  A recent active report in this category was found within 100 metres. Review both reports before deciding whether they describe the same incident.
                </p>
                <Link
                  to={`/dept/${deptCode}/reports/${report.potential_duplicate.duplicate_report_id}`}
                  className="inline-flex mt-2 text-[11px] font-semibold text-amber-900 underline"
                >
                  Review report {report.potential_duplicate.duplicate_report_id.slice(0, 8)} · {report.potential_duplicate.duplicate_status}
                </Link>
              </div>
            )}

            {/* ── Already published: read-only view ── */}
            {report.is_public ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
                  <Check size={16} className="mt-0.5 shrink-0 text-emerald-700" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">This report has been published to the public feed.</p>
                    <p className="text-[11px] text-emerald-800 mt-1">
                      To retract it, use the <strong>Retract</strong> button below. To change the public text,
                      retract first, edit, then re-publish — this avoids overwriting already-visible content by accident.
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Current public description</p>
                  <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 leading-relaxed whitespace-pre-wrap">
                    {report.public_description || '—'}
                  </p>
                </div>

                {report.public_address && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Current public area</p>
                    <p className="text-xs text-slate-800 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5">
                      {report.public_address}
                    </p>
                  </div>
                )}

                {Array.isArray(report.report_photos) && report.report_photos.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Approved photos</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {report.report_photos.map((photo: any) => {
                        const isApproved = photo.is_public_approved;
                        return (
                          <div
                            key={photo.id}
                            className={`relative rounded-lg overflow-hidden border-2 ${
                              isApproved ? 'border-emerald-400' : 'border-slate-200 opacity-40'
                            }`}
                          >
                            {photo.signed_url ? (
                              <img
                                src={photo.signed_url}
                                alt="Report evidence"
                                className="w-full aspect-video object-cover"
                              />
                            ) : (
                              <div className="w-full aspect-video bg-slate-100 flex items-center justify-center text-[11px] text-slate-400">
                                Unavailable
                              </div>
                            )}
                            <span className={`absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isApproved
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-600 text-white'
                            }`}>
                              {isApproved ? 'Public' : 'Private'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Retraction note (optional)
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={event => setReviewNote(event.target.value)}
                    maxLength={1000}
                    placeholder="Reason for retracting this report from public view."
                    className="w-full min-h-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                  {reviewError && (
                    <p role="alert" className="text-xs text-red-600 mt-2">{reviewError}</p>
                  )}
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveVisibilityReview(false)}
                    className="mt-3 px-3.5 py-2 bg-white border border-red-300 text-red-700 text-xs font-semibold rounded-lg hover:bg-red-50 disabled:opacity-50"
                  >
                    {savingReview ? 'Retracting…' : 'Retract from public feed'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Not yet published: full edit form ── */
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sanitized public description
                  </label>
                  <textarea
                    value={publicDescription}
                    onChange={event => setPublicDescription(event.target.value)}
                    maxLength={1000}
                    placeholder="Write a concise public summary. Remove names, contact details, and sensitive operational information."
                    className="w-full min-h-24 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Broad public area (optional)
                  </label>
                  <input
                    value={publicAddress}
                    onChange={event => setPublicAddress(event.target.value)}
                    maxLength={200}
                    placeholder="For example: Kabulonga area"
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Public area label shown to citizens (e.g. neighborhood or street name).
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-700 mb-2">Evidence photo review</p>
                  {Array.isArray(report.report_photos) && report.report_photos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {report.report_photos.map((photo: any) => (
                        <label key={photo.id} className="flex flex-col gap-2 p-2 border border-slate-200 rounded-lg cursor-pointer hover:border-primary transition-colors">
                          {photo.signed_url ? (
                            <img
                              src={photo.signed_url}
                              alt="Report evidence for review"
                              className="w-full aspect-video object-cover rounded"
                            />
                          ) : (
                            <div className="w-full aspect-video rounded bg-slate-100 flex items-center justify-center text-[11px] text-slate-500">
                              Evidence unavailable
                            </div>
                          )}
                          <span className="flex items-center gap-2 text-[11px] text-slate-700">
                            <input
                              type="checkbox"
                              checked={approvedPhotoIds.includes(photo.id)}
                              onChange={event => setApprovedPhotoIds(current => event.target.checked
                                ? [...new Set([...current, photo.id])]
                                : current.filter(photoId => photoId !== photo.id))}
                            />
                            Approve for public release
                          </span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-400">No photos attached.</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Review note
                  </label>
                  <textarea
                    value={reviewNote}
                    onChange={event => setReviewNote(event.target.value)}
                    maxLength={1000}
                    placeholder="Required when keeping this report private."
                    className="w-full min-h-16 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-primary"
                  />
                </div>

                {reviewError && (
                  <p role="alert" className="text-xs text-red-600">{reviewError}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveVisibilityReview(true)}
                    className="px-3.5 py-2 bg-emerald-700 text-white text-xs font-semibold rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {savingReview ? 'Saving…' : 'Publish sanitized report'}
                  </button>
                  <button
                    type="button"
                    disabled={savingReview}
                    onClick={() => void saveVisibilityReview(false)}
                    className="px-3.5 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Keep report private
                  </button>
                </div>
              </div>
            )}
          </div>
          )}

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
                  const url = photo.signed_url;
                  if (!url) return null;
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
              {hasFieldAssignment && (
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

          <div className="enterprise-card p-5">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
              Incident context
            </h3>
            <dl className="space-y-3 text-xs">
              <div>
                <dt className="text-slate-500">When it happened</dt>
                <dd className="font-medium text-slate-800 mt-0.5">
                  {incidentContext?.occurred_at
                    ? new Date(incidentContext.occurred_at).toLocaleString()
                    : 'Not sure'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500">Immediate danger reported</dt>
                <dd className={`font-semibold mt-0.5 ${
                  incidentContext?.immediate_danger === 'yes' ? 'text-red-700' : 'text-slate-800'
                }`}>
                  {incidentAnswerLabels[incidentContext?.immediate_danger] || 'Unsure'}
                </dd>
              </div>
              {categoryAnswers.map(([key, value]) => (
                <div key={key}>
                  <dt className="text-slate-500">
                    {categoryDetailLabels[key] || key.replace(/_/g, ' ')}
                  </dt>
                  <dd className="font-medium text-slate-800 mt-0.5">
                    {incidentAnswerLabels[value] || 'Unsure'}
                  </dd>
                </div>
              ))}
            </dl>
            {incidentContext?.immediate_danger === 'yes' && (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
                Review this report promptly using the department’s safety procedures.
              </p>
            )}
          </div>

          {/* Assigned Team or Worker */}
          <div className="enterprise-card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck size={14} className="text-slate-400" />
                <span>Assigned team or worker</span>
              </h3>
              {profile?.role === 'admin' && (
                <button
                  onClick={openAssignmentModal}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  {hasFieldAssignment ? 'Reassign' : 'Assign'}
                </button>
              )}
            </div>

            {hasFieldAssignment ? (
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

            <div className="text-center py-4 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="font-semibold text-slate-700">
                {report.is_anonymous ? 'Anonymous submission' : 'Reporter identity restricted'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Reporter names and contact details are not shown in the department portal.
              </p>
            </div>
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
      {isStatusModalOpen && canUpdateOperationalStatus && (
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
                  {profile?.role === 'admin' ? (
                    <>
                      <option value="NEW">NEW — Unreviewed</option>
                      <option value="VERIFIED">VERIFIED — Accepted for work</option>
                      <option value="ASSIGNED">ASSIGNED — Assigned to field work</option>
                      <option value="IN_PROGRESS">IN_PROGRESS — Field work underway</option>
                      <option value="RESOLVED">RESOLVED — Incident repaired / closed</option>
                      <option value="REJECTED">REJECTED — Duplicate or invalid</option>
                    </>
                  ) : (
                    <>
                      <option value="IN_PROGRESS">IN_PROGRESS — Field work underway</option>
                      {canResolve && <option value="RESOLVED">RESOLVED — Field work complete</option>}
                    </>
                  )}
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
      {isAssignModalOpen && profile?.role === 'admin' && (
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
