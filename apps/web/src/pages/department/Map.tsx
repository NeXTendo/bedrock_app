import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import {
  Map as MapIcon, List, AlertCircle, Clock, CheckCircle2,
  Layers, MapPin, ExternalLink, X
} from 'lucide-react';
import MapGL, { Marker, Popup, NavigationControl, Source, Layer } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '';

interface ReportRow {
  id: string;
  category_id: string | null;
  description: string;
  status: string;
  latitude: number;
  longitude: number;
  created_at: string;
  address?: string;
  categories: { name: string; color: string | null } | null;
}

function getReportTypeColor(report: ReportRow) {
  return report.categories?.color || '#64748b';
}

function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace('#', '');
  const normalized = value.length === 3 ? value.split('').map(char => char + char).join('') : value;
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  if ([red, green, blue].some(channel => !Number.isFinite(channel))) {
    return `rgba(100, 116, 139, ${alpha})`;
  }
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: '#ea580c',
  reported: '#ea580c',
  IN_PROGRESS: '#2563eb',
  in_progress: '#2563eb',
  verified: '#7c3aed',
  RESOLVED: '#16a34a',
  resolved: '#16a34a',
};

export default function MapView() {
  const { deptCode } = useParams<{ deptCode: string }>();
  const navigate = useNavigate();
  const mapRef = useRef<any>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedReport, setSelectedReport] = useState<ReportRow | null>(null);
  const [visualization, setVisualization] = useState<'pins' | 'heatmap'>('pins');
  const [basemap, setBasemap] = useState<'street' | 'satellite'>('street');
  const [viewState, setViewState] = useState({
    latitude: -15.4167,
    longitude: 28.2833,
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

          // Center map on average report coordinate if available
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
    { label: 'All Reports', value: 'ALL', icon: Layers },
    { label: 'New', value: 'NEW', icon: AlertCircle },
    { label: 'In Progress', value: 'IN_PROGRESS', icon: Clock },
    { label: 'Resolved', value: 'RESOLVED', icon: CheckCircle2 },
  ];

  const filtered = selectedStatus === 'ALL'
    ? reports
    : reports.filter(r => {
        const s = r.status?.toUpperCase().replace(' ', '_');
        return s === selectedStatus;
      });
  const reportTypeLegend = Array.from(new Map(reports.map(report => {
    const name = report.categories?.name || 'Other';
    const color = getReportTypeColor(report);
    return [`${name}:${color}`, { name, color }];
  })).values());
  const heatmapCategories = Array.from(new Map(filtered.map(report => {
    const id = report.category_id || 'other';
    return [id, { id, color: getReportTypeColor(report) }] as const;
  })).values());
  const heatmapData = {
    type: 'FeatureCollection' as const,
    features: filtered.map(report => ({
      type: 'Feature' as const,
      properties: { category_id: report.category_id || 'other' },
      geometry: {
        type: 'Point' as const,
        coordinates: [Number(report.longitude), Number(report.latitude)] as [number, number],
      },
    })),
  };

  const flyTo = useCallback((lat: number, lng: number) => {
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
  }, []);

  const handleSidebarClick = useCallback((r: ReportRow) => {
    setSelectedReport(r);
    flyTo(Number(r.latitude), Number(r.longitude));
  }, [flyTo]);

  const mapboxReady = Boolean(MAPBOX_TOKEN && MAPBOX_TOKEN !== 'your_mapbox_token');

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <MapIcon size={18} className="text-primary" />
            <span>Geospatial Incident Map</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Geographic distribution of {filtered.length} civic reports with GPS coordinates for {deptCode?.toUpperCase()}.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200" aria-label="Filter reports by status">
          {statusFilters.map(f => {
            const isActive = selectedStatus === f.value;
            const count = f.value === 'ALL'
              ? reports.length
              : reports.filter(r => r.status?.toUpperCase().replace(' ', '_') === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setSelectedStatus(f.value)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{f.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  isActive ? 'bg-slate-100 text-slate-800' : 'bg-slate-200/60 text-slate-500'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" aria-label="Map visualization">
            {([
              { label: 'Pins', value: 'pins' },
              { label: 'Heatmap', value: 'heatmap' },
            ] as const).map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={visualization === option.value}
                onClick={() => setVisualization(option.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  visualization === option.value
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" aria-label="Basemap style">
            {([
              { label: 'Street', value: 'street' },
              { label: 'Satellite', value: 'satellite' },
            ] as const).map(option => (
              <button
                key={option.value}
                type="button"
                aria-pressed={basemap === option.value}
                onClick={() => setBasemap(option.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  basemap === option.value
                    ? 'bg-white text-slate-900 font-semibold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Map + Sidebar Split View */}
      <div className="flex flex-col lg:flex-row gap-4 h-[calc(100vh-14rem)]">
        {/* Main Map Container */}
        <div className="flex-1 enterprise-card overflow-hidden relative min-h-[350px]">
          {mapboxReady ? (
            <MapGL
              ref={mapRef}
              {...viewState}
              onMove={(evt: any) => setViewState(evt.viewState)}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle={basemap === 'street'
                ? 'mapbox://styles/mapbox/light-v11'
                : 'mapbox://styles/mapbox/satellite-streets-v12'}
              style={{ width: '100%', height: '100%' }}
              attributionControl={false}
            >
              <NavigationControl position="top-right" showCompass={false} />

              {visualization === 'pins' && filtered.map(r => {
                const color = getReportTypeColor(r);
                return (
                  <Marker
                    key={r.id}
                    latitude={Number(r.latitude)}
                    longitude={Number(r.longitude)}
                    anchor="bottom"
                    onClick={(e: { originalEvent: MouseEvent }) => {
                      e.originalEvent.stopPropagation();
                      setSelectedReport(r);
                    }}
                  >
                    <div className="relative group cursor-pointer" style={{ filter: `drop-shadow(0 2px 3px ${color}66)` }}>
                      <MapPin size={24} fill={color} color="#fff" strokeWidth={1.5} />
                    </div>
                  </Marker>
                );
              })}

              {visualization === 'heatmap' && filtered.length > 0 && (
                <Source id="reports-heatmap" type="geojson" data={heatmapData}>
                  {heatmapCategories.map(category => (
                    <Layer
                      key={category.id}
                      id={`reports-heatmap-${category.id}`}
                      type="heatmap"
                      filter={['==', ['get', 'category_id'], category.id]}
                      paint={{
                        'heatmap-weight': 1,
                        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 18, 1.5],
                        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 0, 14, 12, 30, 18, 45],
                        'heatmap-opacity': 0.8,
                        'heatmap-color': [
                          'interpolate',
                          ['linear'],
                          ['heatmap-density'],
                          0,
                          hexToRgba(category.color, 0),
                          0.2,
                          hexToRgba(category.color, 0.25),
                          0.6,
                          hexToRgba(category.color, 0.7),
                          1,
                          hexToRgba(category.color, 0.95),
                        ],
                      }}
                    />
                  ))}
                </Source>
              )}

              {selectedReport && (
                <Popup
                  latitude={Number(selectedReport.latitude)}
                  longitude={Number(selectedReport.longitude)}
                  onClose={() => setSelectedReport(null)}
                  closeButton={false}
                  offset={24}
                  maxWidth="260px"
                >
                  <div className="p-1 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded text-white"
                        style={{ backgroundColor: STATUS_COLORS[selectedReport.status] || '#2563eb' }}
                      >
                        {selectedReport.status.replace('_', ' ')}
                      </span>
                      <button onClick={() => setSelectedReport(null)} className="text-slate-400 hover:text-slate-600">
                        <X size={13} />
                      </button>
                    </div>
                    <p className="text-xs font-bold text-slate-900">{selectedReport.categories?.name || 'Report'}</p>
                    <p className="text-[11px] text-slate-600 line-clamp-2 leading-relaxed">{selectedReport.description}</p>
                    {selectedReport.address && (
                      <p className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        <MapPin size={10} className="shrink-0" /> {selectedReport.address}
                      </p>
                    )}
                    <button
                      onClick={() => navigate(`/dept/${deptCode}/reports/${selectedReport.id}`)}
                      className="mt-1 pt-1 border-t border-slate-100 w-full flex items-center justify-between text-[11px] font-semibold text-primary hover:underline"
                    >
                      <span>Open full report</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </Popup>
              )}
            </MapGL>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 p-6 text-center">
              <MapIcon size={36} className="text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Mapbox Access Token Not Configured</p>
              <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                Add <code className="bg-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono">VITE_MAPBOX_ACCESS_TOKEN</code> to your <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">.env</code> to enable map tiles.
              </p>

              {/* Mock plot indicator dots */}
              <div className="mt-4 flex flex-wrap gap-2 justify-center max-w-md">
                {filtered.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setSelectedReport(r)}
                    className="p-1.5 rounded-lg bg-white border border-slate-200 text-xs flex items-center gap-1.5 hover:bg-slate-100"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getReportTypeColor(r) }}
                    />
                    <span className="font-mono text-[10px] text-slate-600">#{r.id.slice(0, 6)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
              <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200 text-xs text-slate-600">
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Loading map data…</span>
              </div>
            </div>
          )}

          {/* Clean Map Legend */}
          <div className="absolute bottom-3 left-3 bg-white/95 border border-slate-200 rounded-lg p-2.5 shadow-sm z-10 text-[11px] space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Report Type Legend</span>
            {reportTypeLegend.map(type => (
              <div key={`${type.name}:${type.color}`} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: type.color }} />
                <span className="text-slate-600">{type.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar Report List */}
        <div className="w-full lg:w-80 xl:w-96 enterprise-card overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800">
              <List size={14} className="text-slate-400" />
              <span>Location Roster</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500">{filtered.length} locations</span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No reports matching filter criteria.
              </div>
            ) : (
              filtered.map(r => (
                <div
                  key={r.id}
                  className={`p-3 hover:bg-slate-50 cursor-pointer transition-colors ${
                    selectedReport?.id === r.id ? 'bg-blue-50/70 border-l-2 border-l-primary' : ''
                  }`}
                  onClick={() => handleSidebarClick(r)}
                >
                  <div className="flex items-start gap-2.5">
                    <span
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ backgroundColor: getReportTypeColor(r) }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <p className="text-xs font-semibold text-slate-900 truncate">
                          {r.categories?.name || 'Report'}
                        </p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          #{r.id.slice(0, 6)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{r.description}</p>
                      {r.address && (
                        <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 truncate">
                          <MapPin size={9} />
                          <span>{r.address}</span>
                        </p>
                      )}
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
