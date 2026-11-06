import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ArrowLeft, MapPin, Clock, User, Phone, CheckCircle, ShieldAlert } from 'lucide-react';

export default function ReportDetail() {
  const { deptCode, id } = useParams<{ deptCode: string, id: string }>();
  const [report, setReport] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  // State for modals and actions
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [newStatus, setNewStatus] = useState('NEW');
  const [statusNote, setStatusNote] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [staffList, setStaffList] = useState<Record<string, any>[]>([]);
  const [deptId, setDeptId] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

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
          assignments(*, profiles:assigned_to(full_name)),
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
        () => {
          fetchReport();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'status_history', filter: `report_id=eq.${id}` },
        () => {
          fetchReport();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'assignments', filter: `report_id=eq.${id}` },
        () => {
          fetchReport();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportSubscription);
    };
  }, [id]);

  useEffect(() => {
    async function fetchDepartmentAndStaff() {
      if (!deptCode) return;
      // Get department ID
      const { data: dept } = await supabase
        .from('departments')
        .select('id')
        .eq('code', deptCode.toUpperCase())
        .single();
      
      if (dept) {
        setDeptId(dept.id);
        // Fetch staff profiles for this department
        const { data: staff } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('department_id', dept.id)
          .in('role', ['staff', 'admin']);
        setStaffList(staff || []);
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

  const handleCrewAssignment = async () => {
    if (!id || !deptId || !selectedStaffId) return;
    setUpdating(true);
    try {
      // 1. Insert/upsert into assignments
      const { error: assignError } = await supabase
        .from('assignments')
        .upsert({
          report_id: id,
          department_id: deptId,
          assigned_to: selectedStaffId,
          assigned_by: session?.user?.id,
          notes: assignmentNotes || null,
          assigned_at: new Date().toISOString()
        }, { onConflict: 'report_id' });

      if (assignError) {
        console.error('Error assigning crew:', assignError);
        alert('Failed to assign crew: ' + assignError.message);
        setUpdating(false);
        return;
      }

      // Find staff name
      const staffMember = staffList.find(s => s.id === selectedStaffId);
      const staffName = staffMember ? staffMember.full_name : 'Staff Member';

      // 2. Automatically update status to 'ASSIGNED' via the RPC function to create status history + notify submitter
      const { error: statusError } = await supabase.rpc('update_report_status', {
        p_report_id: id,
        p_new_status: 'ASSIGNED',
        p_note: `Assigned to ${staffName}. Notes: ${assignmentNotes || 'None'}`,
      });

      if (statusError) {
        console.error('Error updating status to ASSIGNED:', statusError);
      }

      setIsAssignModalOpen(false);
      setAssignmentNotes('');
      setSelectedStaffId('');
      fetchReport();
    } catch (err: any) {
      console.error(err);
      alert('An unexpected error occurred.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
        <p className="text-slate-500 font-medium">Loading report profile...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center text-center">
        <ShieldAlert size={48} className="text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-slate-700">Report Not Found</h2>
        <p className="text-slate-500 mt-2">The report you are looking for does not exist or has been removed.</p>
        <Link to={`/dept/${deptCode}/reports`} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl font-medium hover:bg-primary-dark transition-colors">
          Back to Reports
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link to={`/dept/${deptCode}/reports`} className="p-2.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:bg-slate-50 text-slate-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Report #{report.id.substring(0, 8)}</h1>
              <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider border border-slate-200">
                {report.status}
              </span>
            </div>
            <p className="text-slate-500 text-sm mt-0.5 flex items-center">
              <Clock size={14} className="mr-1.5" /> 
              {new Date(report.created_at).toLocaleString()}
            </p>
          </div>
        </div>
        
        <div className="flex space-x-3">
          <button 
            onClick={() => setIsStatusModalOpen(true)}
            className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 shadow-sm transition-all"
          >
            Update Status
          </button>
          <button 
            onClick={() => setIsAssignModalOpen(true)}
            className="px-5 py-2.5 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark shadow-sm shadow-primary/20 transition-all flex items-center space-x-2"
          >
            <CheckCircle size={18} />
            <span>Assign Crew</span>
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (Main Content) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Description Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: report.categories?.color || '#cbd5e1' }}></div>
                <h2 className="text-lg font-bold text-slate-800">{report.categories?.name}</h2>
              </div>
              <span className={`text-sm font-bold capitalize px-3 py-1 rounded-lg ${report.severity === 'critical' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                {report.severity} Priority
              </span>
            </div>
            <div className="p-6">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Citizen Description</h3>
              <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                {report.description || "No description provided."}
              </p>
            </div>
          </div>
          
          {/* Photos Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              Evidence Photos
            </h3>
            {Array.isArray(report.report_photos) && report.report_photos.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {report.report_photos.map((photo: any, index: number) => (
                  <div key={index} className="aspect-square bg-slate-50 rounded-xl overflow-hidden border border-slate-100 shadow-inner relative group">
                    <img
                      src={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/report-photos/${photo.image_url}`}
                      alt={`Evidence ${index + 1}`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="aspect-square bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                  <p className="text-sm font-medium">No photos attached</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Tracking / Timeline Area */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-6">Resolution Timeline</h3>
            <div className="relative border-l-2 border-slate-100 ml-3 space-y-6">
              {/* Submission Milestone */}
              <div className="relative pl-6">
                <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white bg-primary shadow-sm shadow-primary/30"></div>
                <p className="text-sm font-bold text-slate-800">Report Submitted</p>
                <p className="text-xs text-slate-500 mt-1">{new Date(report.created_at).toLocaleString()}</p>
              </div>

              {/* Status History Milestones */}
              {Array.isArray(report.status_history) && report.status_history
                .sort((a: any, b: any) => new Date(a.changed_at).getTime() - new Date(b.changed_at).getTime())
                .map((history: any) => (
                  <div key={history.id} className="relative pl-6">
                    <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white bg-blue-500 shadow-sm shadow-blue-500/30"></div>
                    <p className="text-sm font-bold text-slate-800">
                      Status changed to: <span className="text-blue-600 font-extrabold">{history.new_status}</span>
                    </p>
                    {history.note && (
                      <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1 max-w-md font-semibold leading-relaxed">
                        {history.note}
                      </p>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      By {history.profiles?.full_name || 'System / Staff'} · {new Date(history.changed_at).toLocaleString()}
                    </p>
                  </div>
                ))}

              {/* Assignments Milestone */}
              {report.assignments && (
                <div className="relative pl-6">
                  <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white bg-green-500 shadow-sm shadow-green-500/30"></div>
                  <p className="text-sm font-bold text-slate-800">
                    Crew Assigned: <span className="text-green-600 font-extrabold">{report.assignments.profiles?.full_name || 'Staff member'}</span>
                  </p>
                  {report.assignments.notes && (
                    <p className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-1 max-w-md font-semibold leading-relaxed">
                      {report.assignments.notes}
                    </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    Assigned on {new Date(report.assignments.assigned_at).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
        
        {/* Right Column (Sidebar Details) */}
        <div className="space-y-6">
          
          {/* Location Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              <MapPin size={18} className="mr-2 text-slate-400" />
              Location Details
            </h3>
            <div className="h-40 bg-slate-100 rounded-xl border border-slate-200 mb-4 relative overflow-hidden group">
               <div className="absolute inset-0 bg-[url('https://maps.wikimedia.org/osm-intl/13/4666/4549.png')] bg-cover bg-center opacity-70"></div>
               <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                 <div className="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg animate-bounce"></div>
               </div>
            </div>
            <p className="text-sm font-medium text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
              {report.address || `${report.latitude}, ${report.longitude}`}
            </p>
          </div>
          
          {/* Reporter Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center">
              <User size={18} className="mr-2 text-slate-400" />
              Reporter Information
            </h3>
            {!report.is_anonymous && report.profiles ? (
              <div className="space-y-4">
                <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                    {report.profiles.full_name?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{report.profiles.full_name || 'Verified Citizen'}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">Account verified</p>
                  </div>
                </div>
                {report.profiles.phone && (
                  <div className="flex items-center space-x-3 px-2">
                    <Phone size={16} className="text-slate-400" />
                    <span className="text-sm font-medium text-slate-700">{report.profiles.phone}</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-xl border border-slate-100 border-dashed text-center">
                <User size={24} className="text-slate-300 mb-2" />
                <p className="text-sm font-bold text-slate-700">Anonymous Reporter</p>
                <p className="text-xs text-slate-500 mt-1">Contact details hidden by user preference.</p>
              </div>
            )}
          </div>
          
        </div>
      </div>

      {/* Update Status Modal */}
      {isStatusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Update Report Status</h3>
              <p className="text-slate-500 text-sm mt-1">This will change the public status of this report.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">New Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
                >
                  <option value="NEW">NEW</option>
                  <option value="ASSIGNED">ASSIGNED</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="RESOLVED">RESOLVED</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Internal Audit Note</label>
                <textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Explain the reason for this status change (e.g. crew dispatched, road repaired)"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px] font-medium"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button
                onClick={() => setIsStatusModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleStatusUpdate}
                disabled={updating}
                className="px-5 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all text-sm flex items-center space-x-2 disabled:opacity-50"
              >
                {updating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Crew Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-800">Assign Maintenance Crew</h3>
              <p className="text-slate-500 text-sm mt-1">Select a department staff member to assign this report to.</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Staff Member</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all font-semibold"
                >
                  <option value="">-- Select Staff Member --</option>
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.full_name || 'Unnamed Staff'} ({staff.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-bold text-slate-700">Assignment Notes</label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  placeholder="Instructions for the assigned staff member..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all min-h-[100px] font-medium"
                />
              </div>
            </div>
            <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end space-x-3">
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="px-4 py-2 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-100 transition-all text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleCrewAssignment}
                disabled={updating || !selectedStaffId}
                className="px-5 py-2 bg-primary text-white font-semibold rounded-xl hover:bg-primary-dark transition-all text-sm flex items-center space-x-2 disabled:opacity-50"
              >
                {updating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>}
                <span>Assign Crew</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
