import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiClient } from '../api/client';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Settings, Play, Heart,
  Activity, Users, Server,
  Sparkles, CheckSquare, Square, Calendar
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface SimulationSummary {
  avg_aqi_before: number;
  avg_aqi_after: number;
  aqi_reduction_pct: number;
  pm25_before: number;
  pm25_after: number;
  pm10_before: number;
  pm10_after: number;
  no2_before: number;
  no2_after: number;
  so2_before: number;
  so2_after: number;
  co_before: number;
  co_after: number;
}

interface SimulationResult {
  simulation_id: string;
  city: string;
  interventions: string[];
  intervention_names: string[];
  confidence: number;
  summary: SimulationSummary;
  health_impact: {
    affected_population: number;
    hospital_visits_prevented: number;
    asthma_attacks_prevented: number;
    copd_flareups_prevented: number;
    school_safety_improvement: string;
  };
  policy_score: {
    impact: number;
    cost: number;
    feasibility: number;
    priority: number;
    recommendation: string;
  };
  resources: {
    inspectors_required: number;
    police_personnel: number;
    water_tankers: number;
    estimated_budget_inr: number;
  };
  environmental_benefit: {
    co2_reduction_tons: number;
    particulate_matter_tons: number;
    carbon_savings_index: number;
  };
  timeline: { horizon: string; simulated_aqi: number; percent_improvement: number }[];
  grid_changes: {
    grid_id: number;
    lat: number;
    lon: number;
    before_aqi: number;
    after_aqi: number;
    reduction_pct: number;
    is_hotspot_resolved: boolean;
  }[];
}

interface ComparisonResult {
  scenario_index: number;
  simulation_id: string;
  interventions: string[];
  intervention_names: string[];
  aqi_reduction_pct: number;
  avg_aqi_after: number;
  hospital_visits_prevented: number;
  estimated_budget_inr: number;
  overall_score: number;
  recommendation: string;
}

// ─── Intervention Definitions ────────────────────────────────────────────────
const INTERVENTIONS = [
  { key: 'truck_ban',          name: '🚫 Heavy Vehicle Ban',          cat: 'Traffic' },
  { key: 'odd_even',           name: '🚗 Odd-Even Policy',            cat: 'Traffic' },
  { key: 'construction_halt',  name: '🏗️ Pause Construction Work',     cat: 'Construction' },
  { key: 'water_sprinkling',   name: '💧 Road Water Sprinkling',      cat: 'Construction' },
  { key: 'industrial_curb',    name: '🏭 industrial Emission Curb',   cat: 'Industrial' },
  { key: 'precipitation',      name: '🌧️ Simulate Rainfall',          cat: 'Weather' },
  { key: 'green_corridors',    name: '🌳 Green Corridors & Trees',     cat: 'Urban Planning' }
];

export const DigitalTwinPage: React.FC = () => {
  const { config } = useConfig();
  const city = config?.city || 'bengaluru';

  // State
  const [selectedInterventions, setSelectedInterventions] = useState<string[]>(['truck_ban']);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [comparisons, setComparisons] = useState<ComparisonResult[]>([]);
  const [aiRecs, setAiRecs] = useState<any>(null);
  
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<'results' | 'compare' | 'recommendations'>('results');

  // Leaflet Map states
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const gridLayerRef = useRef<any>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await apiClient.get('/api/simulation/history');
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  const loadAiRecommendations = useCallback(async () => {
    try {
      const res = await apiClient.get(`/api/simulation/recommendations?city=${city}`);
      setAiRecs(res.data);
    } catch (err) {
      console.error(err);
    }
  }, [city]);

  useEffect(() => {
    loadHistory();
    loadAiRecommendations();
  }, [loadHistory, loadAiRecommendations]);

  const runSimulation = async () => {
    if (selectedInterventions.length === 0) return;
    setLoading(true);
    try {
      const res = await apiClient.post('/api/simulate', {
        city,
        interventions: selectedInterventions
      });
      setSimResult(res.data);
      loadHistory();
      setActiveRightTab('results');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCompare = async () => {
    setComparing(true);
    try {
      // Compare current selection against individual single interventions
      const bundles = [
        selectedInterventions,
        ['truck_ban'],
        ['construction_halt'],
        ['precipitation']
      ];
      const res = await apiClient.post('/api/compare', {
        city,
        scenarios: bundles
      });
      setComparisons(res.data.comparisons);
      setActiveRightTab('compare');
    } catch (err) {
      console.error(err);
    } finally {
      setComparing(false);
    }
  };

  const toggleIntervention = (key: string) => {
    setSelectedInterventions(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  // City Centers Dictionary
  const CITY_CENTERS: Record<string, [number, number]> = {
    delhi: [28.6139, 77.2090],
    mumbai: [19.0760, 72.8777],
    bengaluru: [12.9716, 77.5946],
    chennai: [13.0827, 80.2707],
    kolkata: [22.5726, 88.3639],
    hyderabad: [17.3850, 78.4867],
    ahmedabad: [23.0225, 72.5714],
    pune: [18.5204, 73.8567]
  };

  // Map effect (initialize and track city shifts)
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapRef.current) return;

    const center = CITY_CENTERS[city.toLowerCase()] || CITY_CENTERS.bengaluru;

    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current, {
        center,
        zoom: 11,
        zoomControl: false
      });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap CARTO',
        opacity: 0.7
      }).addTo(map);

      mapInstanceRef.current = map;
    } else {
      mapInstanceRef.current.setView(center, 11);
    }
  }, [city]);

  // Update map grids when simResult changes
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !simResult) return;

    const map = mapInstanceRef.current;
    if (gridLayerRef.current) {
      gridLayerRef.current.clearLayers();
    } else {
      gridLayerRef.current = L.layerGroup().addTo(map);
    }

    const latStep = 0.015;
    const lonStep = 0.015;

    // Draw cells
    simResult.grid_changes.slice(0, 100).forEach(grid => {
      const bounds = [
        [grid.lat - latStep/2, grid.lon - lonStep/2],
        [grid.lat + latStep/2, grid.lon + lonStep/2]
      ];

      const diff = grid.before_aqi - grid.after_aqi;
      const fillColour = diff > 40 ? '#10b981' : (diff > 15 ? '#3b82f6' : '#6b7280');

      const rect = L.rectangle(bounds, {
        color: '#374151',
        weight: 0.5,
        fillColor: fillColour,
        fillOpacity: 0.45
      });

      rect.bindTooltip(
        `<div style="font-size:10px;font-family:sans-serif;color:#374151">
          Grid ID: ${grid.grid_id}<br/>
          Before AQI: <b>${Math.round(grid.before_aqi)}</b><br/>
          After AQI: <b>${Math.round(grid.after_aqi)}</b> (-${Math.round(grid.reduction_pct)}%)
        </div>`,
        { sticky: true }
      );
      gridLayerRef.current.addLayer(rect);
    });

    // Center map to grids
    if (simResult.grid_changes.length > 0) {
      const lats = simResult.grid_changes.map(g => g.lat);
      const lons = simResult.grid_changes.map(g => g.lon);
      map.fitBounds([
        [Math.min(...lats), Math.min(...lons)],
        [Math.max(...lats), Math.max(...lons)]
      ]);
    }
  }, [simResult]);

  return (
    <div className="h-[calc(100vh-52px)] flex bg-[#111827] text-[#f9fafb] font-sans overflow-hidden">
      
      {/* ─── Left Sidebar Panel: Interventions Configuration ───────────────── */}
      <div className="w-[300px] border-r border-[#374151] bg-[#1f2937] flex flex-col shrink-0 overflow-y-auto custom-scroll p-4 space-y-4">
        <div>
          <p className="text-[12px] font-bold text-[#f9fafb]">Digital Twin Simulator</p>
          <p className="text-[10px] text-[#6b7280]">Select policy scenarios to execute on the city twin</p>
        </div>

        {/* Categories */}
        {['Traffic', 'Construction', 'Industrial', 'Weather', 'Urban Planning'].map(cat => (
          <div key={cat} className="space-y-1.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">{cat} Scenarios</p>
            {INTERVENTIONS.filter(i => i.cat === cat).map(item => {
              const active = selectedInterventions.includes(item.key);
              return (
                <button
                  key={item.key}
                  onClick={() => toggleIntervention(item.key)}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded text-[11px] border transition-colors ${
                    active
                      ? 'bg-[#2563eb]/10 border-[#2563eb]/40 text-[#93c5fd]'
                      : 'bg-[#111827]/40 border-[#374151] text-[#9ca3af] hover:text-[#e5e7eb]'
                  }`}
                >
                  <span>{item.name}</span>
                  {active ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
                </button>
              );
            })}
          </div>
        ))}

        <div className="pt-2 space-y-2">
          <button
            onClick={runSimulation}
            disabled={loading || selectedInterventions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-[12px] font-bold py-2 rounded transition-colors"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            {loading ? 'Running Digital Twin…' : 'Run Simulation'}
          </button>

          <button
            onClick={handleCompare}
            disabled={comparing || selectedInterventions.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#111827] hover:bg-[#374151]/40 text-[#9ca3af] hover:text-[#f9fafb] text-[11px] py-1.5 rounded border border-[#374151] transition-colors"
          >
            Compare Interventions
          </button>
        </div>

        {/* History log list */}
        {history.length > 0 && (
          <div className="border-t border-[#374151] pt-3 mt-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-2 flex items-center gap-1">
              <Calendar className="w-3 h-3" />Previous Simulations
            </p>
            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scroll">
              {history.map((h, idx) => (
                <div key={idx} className="bg-[#111827]/40 border border-[#374151] p-2 rounded text-[10px]">
                  <div className="flex justify-between font-bold text-[#e5e7eb]">
                    <span>ID: {h.simulation_id}</span>
                    <span className="text-[#4ade80]">{h.aqi_reduction_pct}% Red.</span>
                  </div>
                  <p className="text-[9px] text-[#6b7280] truncate mt-0.5">{h.intervention_names.join(', ')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Center Panel: Map (Before/After overlay) ──────────────────────── */}
      <div className="flex-1 relative flex flex-col min-w-0">
        {/* Map Area */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full" />
          
          {/* Map info card floating */}
          <div className="absolute top-4 left-4 z-[1000] bg-[#1f2937]/90 border border-[#374151] rounded-lg p-3 max-w-[240px] shadow-xl text-[10px]">
            <p className="font-bold text-[#e5e7eb] mb-1.5 flex items-center gap-1">
              <Server className="w-3.5 h-3.5 text-[#60a5fa]" />Twin Grid Coverage Map
            </p>
            <p className="text-[#9ca3af] leading-relaxed">
              Displaying grid difference attributions. Green grids indicate hotspots resolved (AQI reduction &gt; 40 pts).
            </p>
          </div>
        </div>

        {/* Timeline Chart Panel */}
        {simResult && (
          <div className="h-44 border-t border-[#374151] bg-[#1f2937] p-4 flex flex-col shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Simulated Mitigation Timeline</p>
            <div className="flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={simResult.timeline}>
                  <XAxis dataKey="horizon" tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                  <Tooltip contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', fontSize: 10 }} />
                  <Area type="monotone" dataKey="simulated_aqi" stroke="#3b82f6" fill="rgba(59, 130, 246, 0.2)" name="Simulated AQI" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ─── Right Panel: Results, Comparison, & Recommendations (360px) ───── */}
      <div className="w-[380px] border-l border-[#374151] bg-[#1f2937] flex flex-col shrink-0 overflow-hidden">
        
        {/* Right sub-tabs */}
        <div className="shrink-0 flex border-b border-[#374151] text-[11px] font-semibold">
          {[
            { key: 'results',  label: 'Results' },
            { key: 'compare',  label: 'Compare' },
            { key: 'recommendations', label: 'Recommendations' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveRightTab(tab.key as any)}
              className={`flex-1 py-3 text-center border-b-2 transition-colors ${
                activeRightTab === tab.key
                  ? 'border-[#2563eb] text-[#60a5fa]'
                  : 'border-transparent text-[#6b7280] hover:text-[#9ca3af]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab contents */}
        <div className="flex-1 overflow-y-auto custom-scroll p-4 space-y-4">
          
          {/* ─── Results Tab ─── */}
          {activeRightTab === 'results' && (
            simResult ? (
              <div className="space-y-4">
                {/* Score gauge cards */}
                <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-3">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Policy Score</p>
                    <span className="text-[10px] text-[#4ade80] font-semibold">{simResult.policy_score.recommendation}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[10px]">
                    {[
                      { label: 'Impact', val: simResult.policy_score.impact, col: 'text-[#4ade80]' },
                      { label: 'Feasibility', val: simResult.policy_score.feasibility, col: 'text-[#60a5fa]' },
                      { label: 'Cost', val: simResult.policy_score.cost, col: 'text-[#fbbf24]' },
                      { label: 'Priority', val: simResult.policy_score.priority, col: 'text-[#c4b5fd]' }
                    ].map(s => (
                      <div key={s.label} className="bg-[#111827] border border-[#374151] rounded p-2">
                        <p className="text-[#6b7280]">{s.label}</p>
                        <p className={`text-[13px] font-bold ${s.col} mt-0.5`}>{s.val}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AQI reductions */}
                <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">AQI & Pollutants Mitigation</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#111827] rounded p-2.5 flex flex-col justify-center">
                      <span className="text-[9px] text-[#6b7280]">AQI reduction</span>
                      <div className="flex items-baseline gap-1 mt-1">
                        <span className="text-[18px] font-black text-[#f9fafb]">{simResult.summary.avg_aqi_after}</span>
                        <span className="text-[10px] text-[#4ade80] font-semibold">-{simResult.summary.aqi_reduction_pct}%</span>
                      </div>
                    </div>
                    <div className="bg-[#111827] rounded p-2.5 text-[9px] space-y-1 text-[#9ca3af]">
                      <div>PM2.5: <b className="text-white">{simResult.summary.pm25_before} ➔ {simResult.summary.pm25_after}</b></div>
                      <div>PM10:  <b className="text-white">{simResult.summary.pm10_before} ➔ {simResult.summary.pm10_after}</b></div>
                      <div>NO₂:   <b className="text-white">{simResult.summary.no2_before} ➔ {simResult.summary.no2_after}</b></div>
                    </div>
                  </div>
                </div>

                {/* Health impact details */}
                <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Health Benefit Projections</p>
                  <div className="space-y-2 text-[10px] text-[#9ca3af]">
                    <div className="flex justify-between items-center bg-[#111827]/60 p-2 rounded">
                      <span className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" />Protected Residents</span>
                      <b className="text-white">{simResult.health_impact.affected_population.toLocaleString()}</b>
                    </div>
                    <div className="flex justify-between items-center bg-[#111827]/60 p-2 rounded">
                      <span className="flex items-center gap-1.5"><Heart className="w-3.5 h-3.5" />Hospital Admissions Saved</span>
                      <b className="text-[#4ade80]">{simResult.health_impact.hospital_visits_prevented}</b>
                    </div>
                    <div className="flex justify-between items-center bg-[#111827]/60 p-2 rounded">
                      <span className="flex items-center gap-1.5"><Activity className="w-3.5 h-3.5" />Prevented Asthma Cases</span>
                      <b className="text-[#60a5fa]">{simResult.health_impact.asthma_attacks_prevented}</b>
                    </div>
                  </div>
                </div>

                {/* Resource required panel */}
                <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Estimated Deployment Resources</p>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-[#9ca3af]">
                    <div className="bg-[#111827] p-2 rounded">
                      <div>Inspectors</div>
                      <b className="text-white text-[13px]">{simResult.resources.inspectors_required}</b>
                    </div>
                    <div className="bg-[#111827] p-2 rounded">
                      <div>Police force</div>
                      <b className="text-white text-[13px]">{simResult.resources.police_personnel}</b>
                    </div>
                    <div className="bg-[#111827] p-2 rounded">
                      <div>Water tankers</div>
                      <b className="text-white text-[13px]">{simResult.resources.water_tankers}</b>
                    </div>
                    <div className="bg-[#111827] p-2 rounded">
                      <div>Estimated Budget</div>
                      <b className="text-[#fbbf24] text-[12px]">₹{simResult.resources.estimated_budget_inr.toLocaleString()}</b>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[#6b7280] text-[11px] gap-2">
                <Settings className="w-8 h-8 opacity-40 animate-spin" />
                <p>Click "Run Simulation" to view digital twin parameters.</p>
              </div>
            )
          )}

          {/* ─── Compare Tab ─── */}
          {activeRightTab === 'compare' && (
            comparisons.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Strategy Comparison Matrices</p>
                {comparisons.map((c, i) => (
                  <div key={i} className="border border-[#374151] rounded-lg p-3 bg-[#111827]/40">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[11px] font-bold text-[#f9fafb] truncate max-w-[200px]">
                        Scenario {c.scenario_index}: {c.intervention_names.join(' + ')}
                      </span>
                      <span className="text-[10px] text-[#4ade80] font-bold">-{c.aqi_reduction_pct}%</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-[9px] text-[#9ca3af]">
                      <div>Post AQI: <b className="text-white">{c.avg_aqi_after}</b></div>
                      <div>Saved Admissions: <b className="text-[#60a5fa]">{c.hospital_visits_prevented}</b></div>
                      <div>Budget: <b className="text-[#fbbf24]">₹{c.estimated_budget_inr.toLocaleString()}</b></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-[#6b7280] text-[11px]">
                <p className="text-center">Select your intervention and click "Compare Interventions" to evaluate strategies side-by-side.</p>
              </div>
            )
          )}

          {/* ─── Recommendations Tab ─── */}
          {activeRightTab === 'recommendations' && aiRecs && (
            <div className="space-y-4 text-[11px]">
              <div className="bg-[#2563eb]/10 border border-[#2563eb]/30 rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#60a5fa] flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-4 h-4" />AI-Optimized Strategy Recommendation
                </p>
                <p className="text-[13px] font-bold text-[#f9fafb]">{aiRecs.recommended_strategy}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[9px] bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/30 px-2 py-0.5 rounded uppercase font-semibold">
                    Optimal Bundle
                  </span>
                  <span className="text-[10px] text-[#4ade80] font-bold">-{aiRecs.expected_aqi_reduction_pct}% Expected AQI</span>
                </div>
                <div className="border-t border-[#374151] pt-3 mt-3 space-y-1.5 text-[10px] text-[#9ca3af]">
                  {aiRecs.recommended_intervention_names.map((name: string, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-white">
                      <span>✓</span>
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resource requirement projection */}
              <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">AI Budget & Resource Estimate</p>
                <div className="grid grid-cols-2 gap-2 text-[#9ca3af]">
                  <div>Inspectors: <b className="text-white">{aiRecs.resources.inspectors_required}</b></div>
                  <div>Police unit: <b className="text-white">{aiRecs.resources.police_personnel}</b></div>
                  <div>Budget: <b className="text-[#fbbf24]">₹{aiRecs.resources.estimated_budget_inr.toLocaleString()}</b></div>
                </div>
              </div>

              {/* Individual strategy rank */}
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Individual Strategy Rankings</p>
                <div className="space-y-1.5">
                  {aiRecs.top_individual_strategies.map((s: any, i: number) => (
                    <div key={i} className="flex justify-between items-center bg-[#111827]/30 border border-[#374151]/50 px-2.5 py-1.5 rounded">
                      <span className="text-[#9ca3af]">{s.name}</span>
                      <span className="text-[#4ade80] font-bold">-{s.reduction}%</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

    </div>
  );
};

export default DigitalTwinPage;
