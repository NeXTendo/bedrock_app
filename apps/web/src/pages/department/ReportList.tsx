import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Filter, ChevronRight, AlertCircle, Clock, CheckCircle } from 'lucide-react';

interface ReportRow {
  id: string;
  description: string;
  status: string;
  severity: string;
  created_at: string;
  categories: { name: string; icon: string; color: string } | null;
}

export default function ReportList() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') || '');
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== search) {
      setSearch(q);
    }
  }, [searchParams]);

  useEffect(() => {
    async function fetchReports() {
      setLoading(true);
      if (!deptCode) return;
      
      const { data: dept } = await supabase
        .from('departments')
        .select('id')
        .eq('code', deptCode.toUpperCase())
        .single();
        
      if (dept) {
        const { data: categories } = await supabase
          .from('categories')
          .select('id')
          .eq('dept_id', dept.id);
          
        const categoryIds = (categories as { id: string }[] | null)?.map(c => c.id) || [];
        
        if (categoryIds.length > 0) {
          const { data } = await supabase
            .from('reports')
            .select('*, categories(name, icon, color)')
            .in('category_id', categoryIds)
            .order('created_at', { ascending: false });
            
          setReports(data || []);
        }
      }
      setLoading(false);
    }
    
    fetchReports();
  }, [deptCode]);

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'NEW': return 'bg-orange-100 text-orange-700 border-orange-200';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'RESOLVED': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'NEW': return <AlertCircle size={14} className="mr-1" />;
      case 'IN_PROGRESS': return <Clock size={14} className="mr-1" />;
      case 'RESOLVED': return <CheckCircle size={14} className="mr-1" />;
      default: return null;
    }
  };

  const filteredReports = reports.filter(r => {
    if (!search.trim()) return true;
    const query = search.toLowerCase();
    return (
      r.id.toLowerCase().includes(query) ||
      (r.description || '').toLowerCase().includes(query) ||
      (r.categories?.name || '').toLowerCase().includes(query) ||
      (r.status || '').toLowerCase().includes(query) ||
      (r.severity || '').toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Active Reports</h1>
          <p className="text-slate-500 text-sm mt-1">Manage issues assigned to your department.</p>
        </div>
        
        <div className="flex space-x-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                if (e.target.value) {
                  setSearchParams({ q: e.target.value });
                } else {
                  setSearchParams({});
                }
              }}
              placeholder="Search reports..." 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
            />
          </div>
          <button className="px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl hover:bg-slate-50 flex items-center space-x-2 text-sm font-medium transition-colors shadow-sm">
            <Filter size={18} />
            <span className="hidden sm:inline">Filter</span>
          </button>
        </div>
      </div>
      
      {/* Responsive List Container */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            <p className="text-slate-500 font-medium">Loading reports database...</p>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-16 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
              <CheckCircle size={32} className="text-slate-300" />
            </div>
            <h3 className="text-lg font-bold text-slate-700">All caught up!</h3>
            <p className="text-slate-500 mt-1 max-w-sm">
              {search ? 'No reports matched your search keyword.' : 'No active reports found for your department at this time.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Desktop Table Header */}
            <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50/80 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
              <div className="col-span-5">Report Details</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Severity</div>
              <div className="col-span-2">Reported On</div>
              <div className="col-span-1 text-right">Action</div>
            </div>

            {/* List Body (Stacks on mobile) */}
            {filteredReports.map(report => (
              <Link 
                to={`/dept/${deptCode}/reports/${report.id}`} 
                key={report.id} 
                className="block md:grid md:grid-cols-12 md:gap-4 md:items-center px-4 py-5 md:px-6 hover:bg-slate-50/80 transition-colors group"
              >
                {/* Mobile View / Desktop Col 1 */}
                <div className="col-span-5 flex items-start space-x-4 mb-3 md:mb-0">
                  <div className="w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-white shadow-inner shadow-black/10" style={{ backgroundColor: report.categories?.color || '#cbd5e1' }}>
                    <span className="font-bold text-sm">{report.categories?.name?.charAt(0) || '?'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-slate-900 truncate group-hover:text-primary transition-colors">
                      {report.categories?.name}
                    </p>
                    <p className="text-sm text-slate-500 line-clamp-1 mt-0.5">
                      {report.description}
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="col-span-2 flex items-center mb-2 md:mb-0">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${getStatusColor(report.status)}`}>
                    {getStatusIcon(report.status)}
                    {report.status}
                  </span>
                </div>

                {/* Severity */}
                <div className="col-span-2 flex items-center mb-2 md:mb-0">
                  <span className={`text-sm font-semibold capitalize
                    ${report.severity === 'critical' ? 'text-red-600' : 
                      report.severity === 'high' ? 'text-orange-500' : 
                      'text-slate-600'}`}>
                    {report.severity}
                  </span>
                </div>

                {/* Date */}
                <div className="col-span-2 flex items-center mb-2 md:mb-0 text-sm font-medium text-slate-500">
                  {new Date(report.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>

                {/* Action arrow */}
                <div className="col-span-1 hidden md:flex justify-end text-slate-300 group-hover:text-primary transition-colors">
                  <ChevronRight size={20} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
