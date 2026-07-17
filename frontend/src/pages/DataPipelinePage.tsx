import React, { useEffect, useState, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiClient } from '../api/client';
import {
  Database, RefreshCw, CheckCircle2, AlertTriangle,
  XCircle, Clock, Wifi, WifiOff, Activity,
  Layers, Zap, Shield, GitBranch,
  ChevronDown, ChevronRight, Info, Server
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────
interface SourceStatus {
  key: string; name: string; type: string; status: string;
  quality_score: number; latency_ms: number; records_processed: number;
  failed_records: number; missing_pct: number; last_updated: string;
  update_frequency: string; parameters: string[]; pluggable: boolean;
}

interface Anomaly {
  type: string; severity: string; source: string;
  detail: string; detected_at: string; auto_resolved: boolean;
  station_id?: string;
}

interface QualitySource {
  source: string; quality_score: number; latency_ms: number;
  records_processed: number; failed_records: number;
  missing_pct: number; status: string; errors: string[];
  last_updated: string;
}

interface PipelineStatus {
  initialized: boolean;
  last_refresh: string;
  feature_store_grids: number;
  overall_health: number;
  sources: SourceStatus[];
  anomalies: Anomaly[];
  anomaly_count: number;
  sync_log: { source: string; synced_at: string; status: string; latency_ms: number }[];
}

interface QualityReport {
  sources: Record<string, QualitySource>;
  overall_health: number;
  grade: string;
}

interface FeatureStat {
  min: number; max: number; mean: number; count: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const scoreColour = (s: number) =>
  s >= 90 ? 'text-[#4ade80]' : s >= 75 ? 'text-[#fbbf24]' : s >= 60 ? 'text-[#f97316]' : 'text-[#f87171]';

const scoreBg = (s: number) =>
  s >= 90 ? 'bg-[#16a34a]/15 border-[#16a34a]/30' :
  s >= 75 ? 'bg-[#f59e0b]/15 border-[#f59e0b]/30' :
  s >= 60 ? 'bg-[#ea580c]/15 border-[#ea580c]/30' : 'bg-[#ef4444]/15 border-[#ef4444]/30';

const statusIcon = (status: string) =>
  status === 'Online'   ? <Wifi    className="w-3.5 h-3.5 text-[#4ade80]" /> :
  status === 'Degraded' ? <AlertTriangle className="w-3.5 h-3.5 text-[#fbbf24]" /> :
                          <WifiOff className="w-3.5 h-3.5 text-[#f87171]" />;

const severityBadge = (sev: string) =>
  sev === 'High'   ? 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30' :
  sev === 'Medium' ? 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30' :
                     'bg-[#3b82f6]/15 text-[#93c5fd] border-[#3b82f6]/30';

const TYPE_ICON: Record<string, string> = {
  'Ground Station': '📡', 'Satellite': '🛰️', 'Weather API': '🌤️',
  'Traffic API': '🚗', 'GIS': '🗺️', 'Government Database': '🏛️',
};

const FEATURE_LABELS: Record<string, string> = {
  interpolated_aqi:      'Interpolated AQI',
  temperature_c:         'Temperature (°C)',
  humidity_pct:          'Humidity (%)',
  wind_speed_mps:        'Wind Speed (m/s)',
  industrial_area_pct:   'Industrial Area (%)',
  green_cover_pct:       'Green Cover (%)',
  population_density:    'Population Density',
  vehicle_emission_index:'Vehicle Emission Index',
  emission_hotspot_score:'Emission Hotspot Score',
  dust_potential_index:  'Dust Potential Index',
  wind_transport_index:  'Wind Transport Index',
  atmospheric_stability: 'Atmospheric Stability',
  modis_aod:             'MODIS AOD (550nm)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const MetricCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; accent: string;
}> = ({ label, value, sub, icon, accent }) => (
  <div className={`flex items-center gap-3 bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3`}>
    <div className={`w-8 h-8 rounded flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{label}</p>
      <p className="text-[15px] font-bold text-[#f9fafb]">{value}</p>
      {sub && <p className="text-[10px] text-[#6b7280] mt-0.5">{sub}</p>}
    </div>
  </div>
);

const ScoreGauge: React.FC<{ score: number; label: string; size?: 'sm' | 'lg' }> = ({ score, label, size = 'sm' }) => {
  const colour = score >= 90 ? '#4ade80' : score >= 75 ? '#fbbf24' : score >= 60 ? '#f97316' : '#f87171';
  const r = size === 'lg' ? 38 : 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const sz = size === 'lg' ? 96 : 56;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
        <circle cx={sz/2} cy={sz/2} r={r} fill="none" stroke="#374151" strokeWidth={size === 'lg' ? 6 : 4} />
        <circle
          cx={sz/2} cy={sz/2} r={r} fill="none" stroke={colour}
          strokeWidth={size === 'lg' ? 6 : 4}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${sz/2} ${sz/2})`}
        />
        <text x="50%" y="50%" textAnchor="middle" dy="0.35em"
          fill={colour} fontSize={size === 'lg' ? 14 : 9} fontWeight="700">
          {score}
        </text>
      </svg>
      <p className="text-[9px] text-[#6b7280] text-center leading-tight max-w-[60px]">{label}</p>
    </div>
  );
};

const QualityBar: React.FC<{ score: number }> = ({ score }) => {
  const colour = score >= 90 ? 'bg-[#4ade80]' : score >= 75 ? 'bg-[#fbbf24]' : score >= 60 ? 'bg-[#f97316]' : 'bg-[#f87171]';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#374151] rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${colour} transition-all duration-700`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-[11px] font-bold w-8 text-right ${scoreColour(score)}`}>{score}</span>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export const DataPipelinePage: React.FC = () => {
  const { config } = useConfig();

  const [status, setStatus]   = useState<PipelineStatus | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [stats, setStats]     = useState<Record<string, FeatureStat>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'sources' | 'quality' | 'features' | 'anomalies' | 'sync'>('sources');
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  const city = config?.city || 'bengaluru';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [statusRes, qualityRes, statsRes] = await Promise.all([
        apiClient.get(`/api/data/status?city=${city}`),
        apiClient.get(`/api/data/quality?city=${city}`),
        apiClient.get(`/api/data/statistics?city=${city}`),
      ]);
      setStatus(statusRes.data);
      setQuality(qualityRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error('Data pipeline fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [city]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await apiClient.post('/api/data/refresh', { city });
      await load();
    } catch (err) {
      console.error('Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, [load]);

  const onlineSources  = status?.sources.filter(s => s.status === 'Online').length  ?? 0;
  const degraded       = status?.sources.filter(s => s.status === 'Degraded').length ?? 0;
  const offline        = status?.sources.filter(s => s.status === 'Offline').length  ?? 0;
  const health         = status?.overall_health ?? 0;
  const grade          = quality?.grade ?? '—';

  const TAB_ITEMS = [
    { key: 'sources',   label: 'Data Sources',  icon: <Server    className="w-3.5 h-3.5" /> },
    { key: 'quality',   label: 'Quality Metrics',icon: <Shield   className="w-3.5 h-3.5" /> },
    { key: 'features',  label: 'Feature Store', icon: <Layers   className="w-3.5 h-3.5" /> },
    { key: 'anomalies', label: 'Anomalies',      icon: <Zap      className="w-3.5 h-3.5" /> },
    { key: 'sync',      label: 'Sync Log',       icon: <GitBranch className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#111827] font-sans overflow-hidden">

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#1f2937] border-b border-[#374151] px-5 py-3">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded bg-[#2563eb]/20 border border-[#2563eb]/30 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#60a5fa]" />
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#f9fafb]">Data Fusion & Quality Agent</p>
              <p className="text-[10px] text-[#6b7280]">Central intelligence layer • Feature store publisher</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {status?.last_refresh && (
              <div className="flex items-center gap-1.5 text-[10px] text-[#6b7280]">
                <Clock className="w-3 h-3" />
                Last sync: {new Date(status.last_refresh).toLocaleTimeString()}
              </div>
            )}
            <button
              onClick={refresh}
              disabled={refreshing || loading}
              className="flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white text-[12px] font-semibold px-3 py-1.5 rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Syncing…' : 'Run Pipeline'}
            </button>
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-6 gap-3">
          <MetricCard label="Overall Health"    icon={<Shield className="w-4 h-4 text-white" />} accent="bg-[#2563eb]/20" value={`${health}%`} sub={`Grade: ${grade}`} />
          <MetricCard label="Sources Online"    icon={<Wifi className="w-4 h-4 text-white" />}   accent="bg-[#16a34a]/20" value={onlineSources} sub="Active feeds" />
          <MetricCard label="Degraded"          icon={<AlertTriangle className="w-4 h-4 text-white" />} accent="bg-[#f59e0b]/20" value={degraded} sub="Reduced quality" />
          <MetricCard label="Grids Fused"       icon={<Layers className="w-4 h-4 text-white" />} accent="bg-[#7c3aed]/20" value={status?.feature_store_grids ?? '—'} sub="1km² grids" />
          <MetricCard label="Anomalies"         icon={<Zap className="w-4 h-4 text-white" />}    accent="bg-[#dc2626]/20" value={status?.anomaly_count ?? 0} sub="Detected" />
          <MetricCard label="Offline"           icon={<WifiOff className="w-4 h-4 text-white" />} accent="bg-[#374151]" value={offline} sub="Feed failures" />
        </div>

        {/* Pipeline flow visualization */}
        <div className="mt-3 flex items-center gap-1.5 text-[9px] font-semibold text-[#6b7280] overflow-x-auto pb-1">
          {[
            { label: 'Ingestion', icon: '📥', colour: 'bg-[#1e3a5f] border-[#2563eb]/40 text-[#60a5fa]' },
            '→',
            { label: 'Validation', icon: '✅', colour: 'bg-[#1a3320] border-[#16a34a]/40 text-[#4ade80]' },
            '→',
            { label: 'Cleaning', icon: '🧹', colour: 'bg-[#2d2010] border-[#f59e0b]/40 text-[#fbbf24]' },
            '→',
            { label: 'Spatial Fusion', icon: '🗺️', colour: 'bg-[#2d1050] border-[#7c3aed]/40 text-[#c4b5fd]' },
            '→',
            { label: 'Feature Eng.', icon: '⚙️', colour: 'bg-[#1a2040] border-[#3b82f6]/40 text-[#93c5fd]' },
            '→',
            { label: 'Quality Score', icon: '📊', colour: 'bg-[#1a1a1a] border-[#9ca3af]/30 text-[#d1d5db]' },
            '→',
            { label: 'Feature Store', icon: '🏪', colour: 'bg-[#1e3a5f] border-[#2563eb]/40 text-[#60a5fa]' },
          ].map((item, i) =>
            typeof item === 'string' ? (
              <span key={i} className="shrink-0 text-[#374151]">▶</span>
            ) : (
              <div key={i} className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded border ${item.colour}`}>
                <span>{item.icon}</span>
                <span className="uppercase tracking-wider text-[8px]">{item.label}</span>
              </div>
            )
          )}
        </div>
      </div>

      {/* ── Tab bar ───────────────────────────────────────────────────────── */}
      <div className="shrink-0 flex items-center gap-1 px-5 pt-3 pb-0 border-b border-[#374151] bg-[#111827]">
        {TAB_ITEMS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 text-[11px] font-semibold border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-[#2563eb] text-[#60a5fa]'
                : 'border-transparent text-[#6b7280] hover:text-[#9ca3af]'
            }`}
          >
            {tab.icon}{tab.label}
            {tab.key === 'anomalies' && (status?.anomaly_count ?? 0) > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-[#ef4444]/20 text-[#f87171] text-[9px] rounded-full border border-[#ef4444]/30">
                {status!.anomaly_count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab content ───────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto custom-scroll p-5">
        {loading && (
          <div className="flex items-center justify-center h-40 gap-3">
            <div className="w-6 h-6 rounded-full border-2 border-[#374151] border-t-[#2563eb] animate-spin" />
            <p className="text-[12px] text-[#6b7280]">Running data fusion pipeline…</p>
          </div>
        )}

        {/* ─── Sources Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === 'sources' && (
          <div className="space-y-3">
            <p className="text-[10px] text-[#6b7280] uppercase tracking-wider font-bold mb-4">
              {status?.sources.length ?? 0} Registered Data Sources
            </p>
            {(status?.sources ?? []).map(src => (
              <div key={src.key}
                className={`border rounded-lg overflow-hidden transition-all ${scoreBg(src.quality_score)}`}>
                {/* Source header row */}
                <button
                  onClick={() => setExpandedSource(expandedSource === src.key ? null : src.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[18px] shrink-0">{TYPE_ICON[src.type] || '🔌'}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-[12px] font-bold text-[#f9fafb]">{src.name}</p>
                        <span className="text-[8px] uppercase tracking-wider bg-[#374151] text-[#9ca3af] px-1.5 py-0.5 rounded border border-[#4b5563]">
                          {src.type}
                        </span>
                        {src.pluggable && (
                          <span className="text-[8px] uppercase tracking-wider bg-[#2563eb]/10 text-[#60a5fa] px-1.5 py-0.5 rounded border border-[#2563eb]/30">
                            Pluggable
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {statusIcon(src.status)}
                        <span className={`text-[10px] ${src.status === 'Online' ? 'text-[#4ade80]' : src.status === 'Degraded' ? 'text-[#fbbf24]' : 'text-[#f87171]'}`}>
                          {src.status}
                        </span>
                        <span className="text-[10px] text-[#6b7280]">↻ {src.update_frequency}</span>
                        <span className="text-[10px] text-[#6b7280]">⏱ {src.latency_ms}ms</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <ScoreGauge score={src.quality_score} label="Quality" />
                    {expandedSource === src.key
                      ? <ChevronDown className="w-4 h-4 text-[#6b7280]" />
                      : <ChevronRight className="w-4 h-4 text-[#6b7280]" />}
                  </div>
                </button>

                {expandedSource === src.key && (
                  <div className="border-t border-[#374151]/50 px-4 py-3 grid grid-cols-2 gap-x-8 gap-y-2 text-[11px]">
                    <div><span className="text-[#6b7280]">Records Processed:</span> <span className="text-[#f9fafb] font-semibold">{src.records_processed.toLocaleString()}</span></div>
                    <div><span className="text-[#6b7280]">Failed Records:</span>    <span className="text-[#f87171] font-semibold">{src.failed_records}</span></div>
                    <div><span className="text-[#6b7280]">Missing Data:</span>      <span className="text-[#fbbf24] font-semibold">{src.missing_pct}%</span></div>
                    <div><span className="text-[#6b7280]">Last Updated:</span>      <span className="text-[#9ca3af]">{new Date(src.last_updated).toLocaleTimeString()}</span></div>
                    <div className="col-span-2">
                      <span className="text-[#6b7280]">Parameters: </span>
                      <span className="text-[#93c5fd]">{src.parameters.join(', ')}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ─── Quality Tab ─────────────────────────────────────────────── */}
        {!loading && activeTab === 'quality' && quality && (
          <div className="grid grid-cols-2 gap-6">
            {/* Left: Score gauges */}
            <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-5">
              <div className="flex items-center justify-between mb-5">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">Data Quality Scores</p>
                <div className="flex items-center gap-2">
                  <span className={`text-[22px] font-black ${scoreColour(quality.overall_health)}`}>{quality.overall_health}</span>
                  <span className={`text-[14px] font-bold px-2 py-0.5 rounded border ${scoreBg(quality.overall_health)} ${scoreColour(quality.overall_health)}`}>
                    Grade {quality.grade}
                  </span>
                </div>
              </div>
              <div className="space-y-3">
                {Object.entries(quality.sources).map(([key, src]) => (
                  <div key={key}>
                    <div className="flex items-center justify-between mb-1 text-[11px]">
                      <span className="text-[#d1d5db] font-semibold capitalize">{key.replace('_', ' ')}</span>
                      <span className={`font-bold ${scoreColour(src.quality_score)}`}>{src.quality_score}%</span>
                    </div>
                    <QualityBar score={src.quality_score} />
                  </div>
                ))}
              </div>
              <div className="mt-5 pt-4 border-t border-[#374151]">
                <div className="flex gap-4 flex-wrap">
                  {[['≥90', 'Excellent', '#4ade80'], ['≥75', 'Good', '#fbbf24'], ['≥60', 'Fair', '#f97316'], ['<60', 'Poor', '#f87171']].map(([range, label, colour]) => (
                    <div key={range} className="flex items-center gap-1.5 text-[10px]">
                      <div className="w-2 h-2 rounded-full" style={{ background: colour }} />
                      <span className="text-[#6b7280]">{range} = {label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Source detail cards */}
            <div className="space-y-3">
              {Object.entries(quality.sources).map(([key, src]) => (
                <div key={key} className={`border rounded-lg px-4 py-3 ${scoreBg(src.quality_score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[12px] font-bold text-[#f9fafb] capitalize">{key.replace(/_/g, ' ')}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold ${scoreColour(src.quality_score)}`}>{src.quality_score}%</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded border ${src.status === 'Online' ? 'bg-[#16a34a]/15 text-[#4ade80] border-[#16a34a]/30' : 'bg-[#f59e0b]/15 text-[#fbbf24] border-[#f59e0b]/30'}`}>
                        {src.status}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div><span className="text-[#6b7280]">Records:</span> <span className="text-[#f9fafb]">{src.records_processed.toLocaleString()}</span></div>
                    <div><span className="text-[#6b7280]">Failed:</span> <span className="text-[#f87171]">{src.failed_records}</span></div>
                    <div><span className="text-[#6b7280]">Missing:</span> <span className="text-[#fbbf24]">{src.missing_pct}%</span></div>
                  </div>
                  {src.errors.length > 0 && (
                    <div className="mt-2 space-y-0.5">
                      {src.errors.map((e, i) => (
                        <p key={i} className="text-[9px] text-[#f87171] flex items-start gap-1">
                          <XCircle className="w-2.5 h-2.5 shrink-0 mt-0.5" />{e}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Features Tab ────────────────────────────────────────────── */}
        {!loading && activeTab === 'features' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-[12px] font-bold text-[#f9fafb]">Feature Store Statistics</p>
                <p className="text-[10px] text-[#6b7280] mt-0.5">Aggregated across all {status?.feature_store_grids ?? 400} fused 1km² grid cells</p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#4ade80] bg-[#16a34a]/10 border border-[#16a34a]/30 px-3 py-1.5 rounded">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Feature store published
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {Object.entries(stats).map(([key, stat]) => (
                <div key={key} className="bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[11px] font-bold text-[#e5e7eb]">{FEATURE_LABELS[key] || key}</p>
                    <span className="text-[9px] text-[#6b7280] bg-[#111827] px-1.5 py-0.5 rounded border border-[#374151]">
                      {stat.count} grids
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-[9px] text-[#6b7280] uppercase tracking-wider">Min</p>
                      <p className="text-[13px] font-bold text-[#4ade80]">{stat.min}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#6b7280] uppercase tracking-wider">Mean</p>
                      <p className="text-[13px] font-bold text-[#60a5fa]">{stat.mean}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-[#6b7280] uppercase tracking-wider">Max</p>
                      <p className="text-[13px] font-bold text-[#f87171]">{stat.max}</p>
                    </div>
                  </div>
                  {/* Mini range bar */}
                  <div className="mt-2.5 h-1 bg-[#374151] rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-[#4ade80] via-[#60a5fa] to-[#f87171] opacity-60 rounded-full" style={{ width: '100%' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Downstream consumers notice */}
            <div className="mt-6 bg-[#1f2937] border border-[#2563eb]/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-[#60a5fa] shrink-0 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-[#93c5fd] mb-1.5">Feature Store Architecture — Downstream Consumers</p>
                  <p className="text-[10px] text-[#6b7280] mb-3">
                    This feature store is the single source of truth consumed by all downstream AI agents. All agents read from this unified, validated, and enriched feature vector — never from raw data directly.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: 'Forecast Agent', colour: 'bg-[#2563eb]/10 border-[#2563eb]/30 text-[#60a5fa]' },
                      { label: 'Source Attribution Agent', colour: 'bg-[#7c3aed]/10 border-[#7c3aed]/30 text-[#c4b5fd]' },
                      { label: 'Enforcement Agent', colour: 'bg-[#dc2626]/10 border-[#dc2626]/30 text-[#f87171]' },
                      { label: 'Health Advisory Agent', colour: 'bg-[#16a34a]/10 border-[#16a34a]/30 text-[#4ade80]' },
                    ].map(c => (
                      <span key={c.label} className={`text-[10px] font-semibold px-2.5 py-1 rounded border ${c.colour}`}>
                        ↓ {c.label}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── Anomalies Tab ───────────────────────────────────────────── */}
        {!loading && activeTab === 'anomalies' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#6b7280]">
                {status?.anomaly_count ?? 0} Anomalies Detected
              </p>
              {(status?.anomaly_count ?? 0) === 0 && (
                <div className="flex items-center gap-2 text-[10px] text-[#4ade80] bg-[#16a34a]/10 border border-[#16a34a]/30 px-3 py-1.5 rounded">
                  <CheckCircle2 className="w-3.5 h-3.5" />All systems nominal
                </div>
              )}
            </div>
            {(status?.anomalies ?? []).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 gap-3 text-[#4b5563]">
                <CheckCircle2 className="w-10 h-10 text-[#16a34a]/50" />
                <p className="text-[12px]">No anomalies detected in this pipeline run</p>
              </div>
            ) : (
              <div className="space-y-3">
                {(status?.anomalies ?? []).map((a, i) => (
                  <div key={i} className={`border rounded-lg px-4 py-3 ${a.severity === 'High' ? 'bg-[#ef4444]/5 border-[#ef4444]/30' : a.severity === 'Medium' ? 'bg-[#f59e0b]/5 border-[#f59e0b]/30' : 'bg-[#3b82f6]/5 border-[#3b82f6]/30'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${severityBadge(a.severity)}`}>
                            {a.severity}
                          </span>
                          <p className="text-[12px] font-bold text-[#f9fafb]">{a.type}</p>
                          <span className="text-[9px] text-[#6b7280] bg-[#374151] px-1.5 py-0.5 rounded capitalize">
                            {a.source}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#9ca3af]">{a.detail}</p>
                        <div className="flex items-center gap-3 mt-2 text-[9px] text-[#6b7280]">
                          <span>Detected: {new Date(a.detected_at).toLocaleTimeString()}</span>
                          {a.auto_resolved && (
                            <span className="text-[#4ade80] flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />Auto-resolved
                            </span>
                          )}
                          {!a.auto_resolved && (
                            <span className="text-[#f87171] flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" />Requires attention
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ─── Sync Log Tab ────────────────────────────────────────────── */}
        {!loading && activeTab === 'sync' && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-4">
              Synchronisation Log — Last Pipeline Run
            </p>
            <div className="bg-[#1f2937] border border-[#374151] rounded-lg overflow-hidden">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[#374151] text-[9px] uppercase tracking-wider text-[#6b7280]">
                    <th className="text-left px-4 py-2.5">Source</th>
                    <th className="text-left px-4 py-2.5">Status</th>
                    <th className="text-left px-4 py-2.5">Latency</th>
                    <th className="text-left px-4 py-2.5">Synced At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#374151]">
                  {(status?.sync_log ?? []).map((entry, i) => (
                    <tr key={i} className="hover:bg-[#374151]/20 transition-colors">
                      <td className="px-4 py-2.5 font-semibold text-[#e5e7eb] capitalize">{entry.source.replace('_', ' ')}</td>
                      <td className="px-4 py-2.5">
                        <span className={`flex items-center gap-1.5 ${entry.status === 'Online' ? 'text-[#4ade80]' : entry.status === 'Degraded' ? 'text-[#fbbf24]' : 'text-[#f87171]'}`}>
                          {statusIcon(entry.status)}{entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[#9ca3af]">{entry.latency_ms}ms</td>
                      <td className="px-4 py-2.5 text-[#6b7280]">{new Date(entry.synced_at).toLocaleTimeString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Temporal fusion note */}
            <div className="mt-4 bg-[#1f2937] border border-[#374151] rounded-lg p-4 text-[10px] text-[#6b7280]">
              <p className="font-bold text-[#9ca3af] mb-2 flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-[#60a5fa]" />Temporal Fusion — Multi-Resolution Alignment
              </p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'CAAQMS', freq: '15 min', aligned: '15 min buckets' },
                  { label: 'Weather', freq: '1 hour', aligned: 'Hourly interpolation' },
                  { label: 'Satellite (S5P)', freq: '1 day', aligned: 'Daily mosaic resampled hourly' },
                  { label: 'Traffic', freq: '5 min', aligned: 'Hourly weighted average' },
                  { label: 'GIS / Registry', freq: 'Daily', aligned: 'Static layer (24h TTL)' },
                  { label: 'MODIS', freq: '1–2 days', aligned: 'Bi-daily mosaic' },
                ].map(r => (
                  <div key={r.label} className="flex items-center justify-between bg-[#111827] rounded px-3 py-1.5 border border-[#374151]">
                    <span className="font-semibold text-[#9ca3af]">{r.label}</span>
                    <span className="text-[#6b7280]">⟶ {r.aligned}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DataPipelinePage;
