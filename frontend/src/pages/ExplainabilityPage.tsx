import React, { useEffect, useState, useCallback } from 'react';
import { useConfig } from '../context/ConfigContext';
import { apiClient } from '../api/client';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Brain, RefreshCw, Compass
} from 'lucide-react';

// ─── Interfaces ──────────────────────────────────────────────────────────────
interface FeatureImportance {
  feature: string;
  weight: number;
  percentage: number;
}

interface VulnerableGroup {
  group: string;
  risk: string;
  reason: string;
  action: string;
  confidence: number;
}

interface SourceAttribution {
  source: string;
  percentage: number;
  evidence: string;
  supporting_datasets: string[];
  confidence: number;
}

interface ExplanationPayload {
  grid_id: number;
  city: string;
  ward: string;
  coordinates: { lat: number; lon: number };
  current_aqi: number;
  forecast_24h: number;
  forecast_48h: number;
  forecast_72h: number;
  dominant_pollutant: string;
  forecast_confidence: number;
  feature_importance: FeatureImportance[];
  uncertainty_analysis: {
    best_case: number;
    expected: number;
    worst_case: number;
  };
  what_if_scenarios: {
    action: string;
    aqi_reduction_pct: number;
    expected_aqi: number;
  }[];
  natural_language_explanation: string;
  source_attribution: SourceAttribution[];
  enforcement_reasoning: {
    priority_level: string;
    priority_score: number;
    reasons_for_deployment: string[];
    recommendation: string;
    confidence: number;
  };
  health_reasoning: {
    risk_level: string;
    dominant_pollutant: string;
    vulnerable_groups_alert: VulnerableGroup[];
  };
  supporting_evidence: {
    caaqms_stations: string[];
    weather_forecast: string;
    satellite_data: string[];
    traffic_layers: string;
    gis_layers: string[];
    govt_registry: string;
  };
  decision_path: {
    step: number;
    node: string;
    detail: string;
    status: string;
  }[];
}

export const ExplainabilityPage: React.FC = () => {
  const { config } = useConfig();
  const [selectedGridId, setSelectedGridId] = useState<number>(0);
  const [explanation, setExplanation] = useState<ExplanationPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // What-If Simulator states
  const [trafficReduction, setTrafficReduction] = useState(0); // 0% to 100%
  const [constructionStopped, setConstructionStopped] = useState(false);
  const [doubleWind, setDoubleWind] = useState(false);
  const [rainExpected, setRainExpected] = useState(false);

  const city = config?.city || 'bengaluru';

  const loadExplanation = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/explain/grid/${selectedGridId}?city=${city}`);
      setExplanation(response.data);
      // Reset simulator values on grid switch
      setTrafficReduction(0);
      setConstructionStopped(false);
      setDoubleWind(false);
      setRainExpected(false);
    } catch (err) {
      console.error('Error fetching XAI parameters:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedGridId, city]);

  useEffect(() => {
    loadExplanation();
  }, [loadExplanation]);

  // Compute what-if simulated AQI dynamically based on user selections
  const getSimulatedAQI = () => {
    if (!explanation) return 0;
    let baseAQI = explanation.forecast_24h;
    let totalRedPct = 0;

    if (trafficReduction > 0) {
      // Traffic is ~32% of total contribution. Scale reduction percentage accordingly
      totalRedPct += (trafficReduction / 100) * 18;
    }
    if (constructionStopped) {
      totalRedPct += 11;
    }
    if (doubleWind) {
      totalRedPct += 22;
    }
    if (rainExpected) {
      totalRedPct += 34;
    }

    const reduction = (totalRedPct / 100) * baseAQI;
    return Math.max(0, Math.round(baseAQI - reduction));
  };

  const simulatedAQI = getSimulatedAQI();
  const aqiDeltaPct = explanation && explanation.forecast_24h > 0
    ? Math.round(((simulatedAQI - explanation.forecast_24h) / explanation.forecast_24h) * 100)
    : 0;

  // Custom Tooltip for Chart
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[#1f2937] border border-[#374151] p-2.5 rounded shadow-lg text-[11px] text-[#f9fafb]">
          <p className="font-semibold">{payload[0].name}</p>
          <p className="text-[#60a5fa] mt-1">Impact Weight: {payload[0].value}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#111827] font-sans overflow-hidden">
      
      {/* ─── 1. Header Strip ──────────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#1f2937] border-b border-[#374151] px-5 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#2563eb]/20 border border-[#2563eb]/30 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-[#60a5fa]" />
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#f9fafb]">Explainability & AI Reasoning Agent</p>
            <p className="text-[10px] text-[#6b7280]">SHAP / LIME Feature Attributions • What-If Simulators</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded px-3 py-1.5">
            <Compass className="w-3.5 h-3.5 text-[#6b7280]" />
            <span className="text-[11px] text-[#9ca3af]">Select Grid Zone:</span>
            <select
              value={selectedGridId}
              onChange={(e) => setSelectedGridId(Number(e.target.value))}
              className="bg-transparent text-[11px] font-bold text-[#f9fafb] focus:outline-none cursor-pointer"
            >
              {Array.from({ length: 400 }, (_, i) => (
                <option key={i} value={i}>Grid {i} ({i % 20 === 0 ? 'Core Ward' : `Zone ${i}`})</option>
              ))}
            </select>
          </div>

          <button
            onClick={loadExplanation}
            className="flex items-center gap-1.5 text-[11px] bg-[#374151] hover:bg-[#4b5563] text-[#e5e7eb] px-3 py-1.5 rounded transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            Sync Reasoner
          </button>
        </div>
      </div>

      {/* ─── 2. Workspace ─────────────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[#9ca3af]">
          <div className="w-7 h-7 rounded-full border-2 border-[#374151] border-t-[#2563eb] animate-spin" />
          <p className="text-[12px]">Computing localized Shapley attributions…</p>
        </div>
      ) : explanation ? (
        <div className="flex-1 flex overflow-hidden">
          
          {/* Left Column: Natural Language, Confidence, Decision path (40%) */}
          <div className="flex-[4] border-r border-[#374151] bg-[#1f2937] overflow-y-auto custom-scroll p-4 space-y-4">
            
            {/* Summary block */}
            <div className="bg-[#111827] border border-[#374151] rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">AI Reasoning Summary</span>
                <span className="text-[9px] text-[#6b7280]">Ward: {explanation.ward}</span>
              </div>
              <p className="text-[11px] text-[#d1d5db] leading-relaxed">
                "{explanation.natural_language_explanation}"
              </p>
            </div>

            {/* Target model confidence metrics */}
            <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Model Inference Confidence</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: 'Forecast', val: explanation.forecast_confidence },
                  { label: 'Attribution', val: explanation.source_attribution[0].confidence },
                  { label: 'Enforcement', val: explanation.enforcement_reasoning.confidence },
                  { label: 'Health Risk', val: explanation.health_reasoning.vulnerable_groups_alert[0].confidence }
                ].map(c => (
                  <div key={c.label} className="bg-[#111827] border border-[#374151] rounded p-2">
                    <p className="text-[9px] text-[#6b7280]">{c.label}</p>
                    <p className="text-[14px] font-bold text-[#4ade80] mt-0.5">{c.val}%</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision Tree path */}
            <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">AI Decision Trace Path</p>
              <div className="relative pl-4 border-l border-[#374151] space-y-3.5">
                {explanation.decision_path.map((step, i) => (
                  <div key={i} className="relative">
                    <div className={`absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                      step.status === 'ALERT'   ? 'bg-[#ef4444] border-[#111827]' :
                      step.status === 'ACTION'  ? 'bg-[#fbbf24] border-[#111827]' :
                                                  'bg-[#4ade80] border-[#111827]'
                    }`} />
                    <div className="text-[10px]">
                      <p className="font-bold text-[#e5e7eb]">{step.node}</p>
                      <p className="text-[#9ca3af] mt-0.5 leading-snug">{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Supporting evidence logs */}
            <div className="bg-[#111827]/40 border border-[#374151] rounded-lg p-4 text-[10px]">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Model Inputs Auditing</p>
              <div className="space-y-2">
                <div><span className="text-[#6b7280]">CAAQMS Stations:</span> <span className="text-[#e5e7eb]">{explanation.supporting_evidence.caaqms_stations.join(', ')}</span></div>
                <div><span className="text-[#6b7280]">Weather Layer:</span>    <span className="text-[#e5e7eb]">{explanation.supporting_evidence.weather_forecast}</span></div>
                <div><span className="text-[#6b7280]">Satellite Tracks:</span> <span className="text-[#e5e7eb]">{explanation.supporting_evidence.satellite_data.join(' + ')}</span></div>
                <div><span className="text-[#6b7280]">TomTom Traffic:</span>   <span className="text-[#e5e7eb]">{explanation.supporting_evidence.traffic_layers}</span></div>
                <div><span className="text-[#6b7280]">Municipal GIS:</span>   <span className="text-[#e5e7eb]">{explanation.supporting_evidence.gis_layers.join(', ')}</span></div>
                <div><span className="text-[#6b7280]">Govt Registry:</span>    <span className="text-[#e5e7eb]">{explanation.supporting_evidence.govt_registry}</span></div>
              </div>
            </div>

          </div>

          {/* Right Column: Charts & What-If Simulators (60%) */}
          <div className="flex-[6] overflow-y-auto custom-scroll p-4 space-y-4">
            
            {/* Top row: Current/Forecast stats & Uncertainty Bounds */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4 flex flex-col justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">Prediction Horizon (24h)</p>
                <div className="flex items-baseline justify-between mt-2">
                  <div>
                    <p className="text-[10px] text-[#6b7280]">Current</p>
                    <p className="text-[20px] font-bold text-[#9ca3af]">{explanation.current_aqi}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-[#6b7280]">Expected Forecast</p>
                    <p className="text-[32px] font-black text-[#f87171]">{explanation.forecast_24h}</p>
                  </div>
                </div>
                <div className="border-t border-[#374151] pt-2 mt-2 flex justify-between text-[10px] text-[#9ca3af]">
                  <span>Dominant: <strong className="text-[#60a5fa]">{explanation.dominant_pollutant}</strong></span>
                  <span>Confidence: <strong className="text-[#4ade80]">{explanation.forecast_confidence}%</strong></span>
                </div>
              </div>

              {/* Uncertainty bounds */}
              <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Uncertainty Bound Analysis</p>
                <div className="flex items-center justify-between gap-2 mt-2">
                  <div className="text-center bg-[#111827]/40 rounded p-2 flex-1">
                    <p className="text-[9px] text-[#4ade80] font-semibold">Best Case (10th pctl)</p>
                    <p className="text-[18px] font-bold text-[#e5e7eb] mt-1">{explanation.uncertainty_analysis.best_case}</p>
                  </div>
                  <div className="text-center bg-[#111827]/40 rounded p-2 flex-1 border border-[#374151]">
                    <p className="text-[9px] text-[#60a5fa] font-semibold">Expected (Mean)</p>
                    <p className="text-[18px] font-bold text-[#f9fafb] mt-1">{explanation.uncertainty_analysis.expected}</p>
                  </div>
                  <div className="text-center bg-[#111827]/40 rounded p-2 flex-1">
                    <p className="text-[9px] text-[#f87171] font-semibold">Worst Case (90th pctl)</p>
                    <p className="text-[18px] font-bold text-[#e5e7eb] mt-1">{explanation.uncertainty_analysis.worst_case}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature Importance SHAP Chart */}
            <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-4">Shapley Feature Contributions (SHAP)</p>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={explanation.feature_importance}
                    layout="vertical"
                    margin={{ top: 0, right: 10, left: 20, bottom: 0 }}
                  >
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="feature"
                      type="category"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#9ca3af', fontSize: 9 }}
                      width={120}
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                    <Bar dataKey="percentage" radius={[0, 4, 4, 0]} barSize={10}>
                      {explanation.feature_importance.map((entry, index) => {
                        const isNeg = entry.weight < 0;
                        return <Cell key={`cell-${index}`} fill={isNeg ? '#10b981' : '#3b82f6'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* What-If Simulator Panel */}
            <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4">
              <div className="flex items-center justify-between mb-3.5">
                <div>
                  <p className="text-[11px] font-bold text-[#e5e7eb]">Interactive What-If Simulation Engine</p>
                  <p className="text-[9px] text-[#6b7280]">Modify model features to simulate AQI mitigations</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-[#6b7280] block">Simulated AQI</span>
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="text-[20px] font-black text-[#f9fafb]">{simulatedAQI}</span>
                    {aqiDeltaPct < 0 && (
                      <span className="text-[10px] bg-[#16a34a]/15 text-[#4ade80] px-1.5 py-0.5 rounded font-bold">
                        {aqiDeltaPct}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3.5 bg-[#111827]/40 border border-[#374151]/50 rounded-lg p-3">
                  {/* Traffic reduction slider */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] text-[#e5e7eb] mb-1">
                      <span>Reduce Vehicular Traffic:</span>
                      <span className="text-[#3b82f6] font-bold">{trafficReduction}%</span>
                    </div>
                    <input
                      type="range" min="0" max="100" step="5"
                      value={trafficReduction}
                      onChange={(e) => setTrafficReduction(Number(e.target.value))}
                      className="w-full h-1 bg-[#374151] rounded-lg appearance-none cursor-pointer accent-[#3b82f6]"
                    />
                  </div>

                  {/* Construction check */}
                  <label className="flex items-center justify-between text-[10px] text-[#e5e7eb] cursor-pointer">
                    <span>Halt Construction Projects:</span>
                    <input
                      type="checkbox" checked={constructionStopped}
                      onChange={(e) => setConstructionStopped(e.target.checked)}
                      className="rounded border-[#374151] bg-[#111827] text-[#3b82f6] focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>

                <div className="space-y-3.5 bg-[#111827]/40 border border-[#374151]/50 rounded-lg p-3">
                  {/* Double wind speed check */}
                  <label className="flex items-center justify-between text-[10px] text-[#e5e7eb] cursor-pointer">
                    <span>Double Wind Speed (High Dispersion):</span>
                    <input
                      type="checkbox" checked={doubleWind}
                      onChange={(e) => setDoubleWind(e.target.checked)}
                      className="rounded border-[#374151] bg-[#111827] text-[#3b82f6] focus:ring-0 cursor-pointer"
                    />
                  </label>

                  {/* Rain check */}
                  <label className="flex items-center justify-between text-[10px] text-[#e5e7eb] cursor-pointer">
                    <span>Light Precipitation (5mm Rain):</span>
                    <input
                      type="checkbox" checked={rainExpected}
                      onChange={(e) => setRainExpected(e.target.checked)}
                      className="rounded border-[#374151] bg-[#111827] text-[#3b82f6] focus:ring-0 cursor-pointer"
                    />
                  </label>
                </div>
              </div>
            </div>

            {/* Bottom Row: Source Attribution reasons & Health Advisories reasons */}
            <div className="grid grid-cols-2 gap-4">
              {/* Source attribution reasoning */}
              <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-3">Source Attribution Logic</p>
                <div className="space-y-2">
                  {explanation.source_attribution.map(sa => (
                    <div key={sa.source} className="bg-[#111827]/60 border border-[#374151] rounded p-2 text-[10px]">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-[#e5e7eb]">{sa.source}</span>
                        <span className="text-[#3b82f6] font-bold">{sa.percentage}%</span>
                      </div>
                      <p className="text-[#6b7280] leading-tight mb-1.5">{sa.evidence}</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {sa.supporting_datasets.map((d, i) => (
                          <span key={i} className="text-[8px] bg-[#374151] text-[#9ca3af] px-1 rounded">
                            {d}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health and Enforcement reasoning */}
              <div className="bg-[#1f2937] border border-[#374151] rounded-lg p-4 space-y-3.5">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Health Advisory Reasoner</p>
                  <div className="bg-[#111827]/60 border border-[#374151] rounded p-2 text-[10px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e7eb]">{explanation.health_reasoning.vulnerable_groups_alert[0].group}</span>
                      <span className="text-[#ef4444] font-bold">Risk: {explanation.health_reasoning.vulnerable_groups_alert[0].risk}</span>
                    </div>
                    <p className="text-[#6b7280] leading-tight mb-1">Reason: {explanation.health_reasoning.vulnerable_groups_alert[0].reason}</p>
                    <p className="text-[#10b981] font-medium">Directive: {explanation.health_reasoning.vulnerable_groups_alert[0].action}</p>
                  </div>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Enforcement reasoning</p>
                  <div className="bg-[#111827]/60 border border-[#374151] rounded p-2 text-[10px]">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-[#e5e7eb]">Action Recommendation</span>
                      <span className="text-[#fbbf24] font-bold">Priority: {explanation.enforcement_reasoning.priority_level}</span>
                    </div>
                    <p className="text-[#6b7280] leading-tight mb-1">{explanation.enforcement_reasoning.recommendation}</p>
                    <ul className="list-disc pl-3 text-[9px] text-[#6b7280] space-y-0.5">
                      {explanation.enforcement_reasoning.reasons_for_deployment.slice(0, 2).map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[#6b7280]">
          <p className="text-[12px]">Please select a grid cell to explore reasoning parameters.</p>
        </div>
      )}
    </div>
  );
};

export default ExplainabilityPage;
