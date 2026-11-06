import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Map as MapIcon, List, Filter, AlertCircle, Clock, CheckCircle,
  Layers, MapPin, ExternalLink, X
} from 'lucide-react';
import MapGL, { Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

interface ReportRow {
  id: string;
  description: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
  address?: string;
  categories: { name: string; color: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#f97316',
  reported: '#f97316',
  IN_PROGRESS: '#3b82f6',
  in_progress: '#3b82f6',
  verified: '#8b5cf6',
  RESOLVED: '#22c55e',
  resolved: '#22c55e',
};

export default function MapView() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<any>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [viewState, setViewState] = useState({
    latitude: -25.746,
    longitude: 28.188,
    zoom: 12,
  });

  useEffect(() => {
    async function fetchReports() {
      if (!deptCode) return;
      const { data: dept } = await supabase
        .from('departments').select('id').eq('code', deptCode.toUpperCase()).single();
      if (dept) {
        const { data: cats } = await supabase.from('categories').select('id').eq('dept_id', dept.id);
        const catIds = (cats as { id: string }[] | null)?.map(c => c.id) || [];
        if (catIds.length > 0) {
          const { data } = await supabase
            .from('reports')
            .select('*, categories(name, color)')
            .in('category_id', catIds)
            .not('latitude', 'is', null)
            .not('longitude', 'is', null);
          const rows = (data || []) as ReportRow[];
          setReports(rows);

          // Centre map on first report
          if (rows.length > 0) {
            const avgLat = rows.reduce((s, r) => s + Number(r.latitude), 0) / rows.length;
            const avgLng = rows.reduce((s, r) => s + Number(r.longitude), 0) / rows.length;
            setViewState(v => ({ ...v, latitude: avgLat, longitude: avgLng }));
          }
        }
      }
      setLoading(false);
    }
    fetchReports();
  }, [deptCode]);

  const statusFilters = [
    { label: 'All', value: 'ALL', icon: Layers, color: '#64748b' },
    { label: 'New', value: 'NEW', icon: AlertCircle, color: '#f97316' },
    { label: 'In Progress', value: 'IN_PROGRESS', icon: Clock, color: '#3b82f6' },
    { label: 'Resolved', value: 'RESOLVED', icon: CheckCircle, color: '#22c55e' },
  ];

  const filtered = selectedStatus === 'ALL'
    ? reports
    : reports.filter(r => {
        const s = r.status?.toUpperCase().replace(' ', '_');
        return s === selectedStatus;
      });

  const flyTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });
  }, []);

  const handleSidebarClick = useCallback((r: ReportRow) => {
    setSelectedReport(r);
    flyTo(Number(r.latitude), Number(r.longitude));
  }, [flyTo]);

  const mapboxReady = MAPBOX_TOKEN && MAPBOX_TOKEN !== 'your_mapbox_token';

  return (
    <div className="space-y-4 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapIcon size={24} className="text-primary" />
            Geospatial Report Map
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} reports with location data for the {deptCode?.toUpperCase()} department.
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {statusFilters.map(f => {
          const Icon = f.icon;
          const isActive = selectedStatus === f.value;
          const count = f.value === 'ALL'
            ? reports.length
            : reports.filter(r => r.status?.toUpperCase().replace(' ', '_') === f.value).length;
          return (
            <button
              key={f.value}
              onClick={() => setSelectedStatus(f.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold border transition-all shadow-sm
                ${isActive
                  ? 'bg-primary text-white border-primary shadow-primary/20 shadow-md'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                }`}
            >
              <Icon size={16} />
              {f.label}
              <span className={`ml-1 text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-white/20' : 'bg-slate-100'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Map + List Layout */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-18rem)]">

        {/* Map Container */}
        <div className="flex-1 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative min-h-[350px]">
          {mapboxReady ? (
            <MapGL
              ref={mapRef}
              {...viewState}
              onMove={(evt: any) => setViewState(evt.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/light-v11"
              style={{ width: '100%', height: '100%' }}
              attributionControl={false}
            >
              <NavigationControl position="top-right" showCompass={false} />

              {filtered.map(r => {
                const color = STATUS_COLORS[r.status] || r.categories?.color || '#94a3b8';
                return (
                  <Marker
                    key={r.id}
                    latitude={Number(r.latitude)}
                    longitude={Number(r.longitude)}
                    anchor="bottom"
                    onClick={(e: { originalEvent: MouseEvent }) => { e.originalEvent.stopPropagation(); setSelectedReport(r); }}
                  >
                    <div className="relative group cursor-pointer" style={{ filter: `drop-shadow(0 2px 4px ${color}66)` }}>
                      <MapPin size={28} fill={color} color="#fff" strokeWidth={1.5} />
                    </div>
                  </Marker>
                );
              })}

              {selectedReport && (
                <Popup
                  latitude={Number(selectedReport.latitude)}
                  longitude={Number(selectedReport.longitude)}
                  onClose={() => setSelectedReport(null)}
                  closeButton={false}
                  offset={28}
                  maxWidth="280px"
                >
                  <div className="p-1">
                    <div className="flex items-center justify-between mb-2">
                      <span
                        className="text-xs font-bold uppercase px-2 py-0.5 rounded-md text-white"
                        style={{ backgroundColor: STATUS_COLORS[selectedReport.status] || '#94a3b8' }}
                      >
                        {selectedReport.status.replace('_', ' ')}
                      </span>
                      <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={14} />
                      </button>
                    </div>
                    <p className="text-sm font-semibold text-slate-800">{selectedReport.categories?.name || 'Report'}</p>
                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{selectedReport.description}</p>
                    {selectedReport.address && (
                      <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin size={10} /> {selectedReport.address}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/${deptCode}/reports/${selectedReport.id}`)}
                      className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      View Details <ExternalLink size={12} />
                    </button>
                  </div>
                </Popup>
              )}
            </MapGL>
          ) : (
            /* Fallback when no real Mapbox token is configured */
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
              <MapIcon size={48} className="text-slate-300 mb-3" />
              <p className="text-sm font-bold text-slate-500">Mapbox Token Required</p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs text-center">
                Set <code className="bg-slate-200 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> in your <code className="bg-slate-200 px-1 rounded">.env</code> file to enable the interactive map.
              </p>

              {/* Still show dots for a visual hint */}
              {filtered.map((r, i) => (
                <div
                  key={r.id}
                  className="absolute group cursor-pointer"
                  style={{
                    left: `${20 + (i * 37) % 60}%`,
                    top: `${15 + (i * 53) % 65}%`,
                  }}
                  onClick={() => setSelectedReport(r)}
                >
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-lg transition-transform group-hover:scale-150"
                    style={{ backgroundColor: STATUS_COLORS[r.status] || r.categories?.color || '#94a3b8' }}
                  />
                </div>
              ))}
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-20">
              <div className="flex items-center space-x-3 bg-white p-4 rounded-2xl shadow-lg border border-slate-100">
                <div className="w-6 h-6 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                <p className="text-slate-700 font-medium text-sm">Loading map data...</p>
              </div>
            </div>
          )}

          {/* Map Legend */}
          <div className="absolute bottom-4 left-4 glass rounded-xl px-3 py-2 shadow-md z-10">
            <p className="text-xs font-bold text-slate-700 mb-1.5">Legend</p>
            <div className="space-y-1">
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-500" /><span className="text-xs text-slate-600">New</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-xs text-slate-600">In Progress</span></div>
              <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500" /><span className="text-xs text-slate-600">Resolved</span></div>
            </div>
          </div>
        </div>

        {/* Sidebar Report List */}
        <div className="w-full lg:w-80 xl:w-96 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <List size={16} className="text-primary" />
              Reports ({filtered.length})
            </h3>
            <button className="p-1.5 text-slate-400 hover:text-primary rounded-lg">
              <Filter size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {filtered.length === 0 ? (
              <div className="p-8 text-center">
                <MapIcon size={32} className="text-slate-200 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-600">No reports found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filter.</p>
              </div>
            ) : (
              filtered.map(r => (
                <div
                  key={r.id}
                  className={`p-4 hover:bg-slate-50 cursor-pointer transition-colors group ${
                    selectedReport?.id === r.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                  onClick={() => handleSidebarClick(r)}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="w-3 h-3 rounded-full mt-1 flex-shrink-0 ring-2 ring-white shadow"
                      style={{ backgroundColor: STATUS_COLORS[r.status] || r.categories?.color || '#94a3b8' }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-800 group-hover:text-primary transition-colors truncate">
                        {r.categories?.name || 'Report'}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{r.description}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <span
                          className="text-xs font-semibold px-1.5 py-0.5 rounded text-white"
                          style={{ backgroundColor: STATUS_COLORS[r.status] || '#94a3b8' }}
                        >
                          {r.status?.replace('_', ' ')}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
