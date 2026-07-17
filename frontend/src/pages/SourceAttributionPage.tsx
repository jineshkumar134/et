import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchSourceAttributions, fetchGridAttribution } from '../api/aqi';
import type { SourceAttribution } from '../api/aqi';
import { SourceAttributionMap } from '../components/map/SourceAttributionMap';
import { useConfig } from '../context/ConfigContext';
import {
  Compass, PieChart, Clock, Eye, Filter, Layers,
  ListTodo, Radio, Award, CheckCircle2
} from 'lucide-react';

export const SourceAttributionPage: React.FC = () => {
  const { config, loading: configLoading } = useConfig();
  const [searchParams] = useSearchParams();
  const [attributions, setAttributions] = useState<SourceAttribution[]>([]);
  const [selectedAttr, setSelectedAttr] = useState<SourceAttribution | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Filters
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterPollutant, setFilterPollutant] = useState<string>('');
  const [filterTimeRange, setFilterTimeRange] = useState<string>('today');
  
  // Satellite layers toggle
  const [satelliteOverlay, setSatelliteOverlay] = useState(false);

  useEffect(() => {
    const loadAttributions = async () => {
      if (!config) return;
      try {
        setLoading(true);
        const data = await fetchSourceAttributions(
          { city: config.city, resolution: config.resolution },
          { source: filterSource, pollutant: filterPollutant, timeRange: filterTimeRange }
        );
        setAttributions(data);
        
        // Handle pre-selected grid cell from search query
        const gridParam = searchParams.get('grid');
        if (gridParam) {
          handleGridSelect(parseInt(gridParam));
        }
      } catch (err) {
        console.error('Error fetching source attribution spatial layers', err);
      } finally {
        setLoading(false);
      }
    };
    loadAttributions();
  }, [config?.city, config?.resolution, filterSource, filterPollutant, filterTimeRange]);

  const handleGridSelect = async (gridId: number) => {
    if (!config) return;
    try {
      setInspectorLoading(true);
      const detail = await fetchGridAttribution(
        gridId,
        { city: config.city, resolution: config.resolution },
        filterTimeRange
      );
      setSelectedAttr(detail);
    } catch (err) {
      console.error('Error fetching grid source attribution detail', err);
    } finally {
      setInspectorLoading(false);
    }
  };

  const getAQIColor = (aqi: number) => {
    if (aqi <= 50) return '#16a34a';
    if (aqi <= 100) return '#84cc16';
    if (aqi <= 200) return '#f59eb';
    if (aqi <= 300) return '#ea580c';
    return '#dc2626';
  };

  if (configLoading || !config) {
    return (
      <div className="h-[calc(100vh-52px)] flex items-center justify-center bg-[#111827]">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#111827] font-sans">
      
      {/* ── 1. GIS Filter Strip (Government toolbar style) ── */}
      <div className="h-12 bg-[#1f2937] border-b border-[#374151] flex items-center justify-between px-6 shrink-0 z-[1001] shadow-sm">
        <div className="flex items-center gap-4 text-xs font-semibold text-[#9ca3af]">
          
          {/* Source Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Source:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2.5 py-1 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All Sources</option>
              <option value="Traffic">Traffic</option>
              <option value="Industry">Industry</option>
              <option value="Construction">Construction</option>
              <option value="Waste Burning">Waste Burning</option>
              <option value="Dust">Dust</option>
            </select>
          </div>

          <span className="h-4 w-px bg-[#374151]" />

          {/* Pollutant Filter */}
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Pollutant:</span>
            <select
              value={filterPollutant}
              onChange={(e) => setFilterPollutant(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2.5 py-1 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All Pollutants</option>
              <option value="PM2.5">PM2.5</option>
              <option value="PM10">PM10</option>
              <option value="NO2">NO₂</option>
              <option value="CO">CO</option>
              <option value="SO2">SO₂</option>
            </select>
          </div>

          <span className="h-4 w-px bg-[#374151]" />

          {/* Time Range Filter */}
          <div className="flex items-center gap-2">
            <Clock className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Time Range:</span>
            <select
              value={filterTimeRange}
              onChange={(e) => setFilterTimeRange(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2.5 py-1 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="today">Today</option>
              <option value="yesterday">Yesterday</option>
              <option value="last_week">Last Week</option>
            </select>
          </div>
        </div>

        {/* Toggle satellite layers */}
        <button
          onClick={() => setSatelliteOverlay(!satelliteOverlay)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-all ${
            satelliteOverlay
              ? 'bg-[#2563eb]/20 border-[#2563eb] text-[#93c5fd]'
              : 'bg-[#111827] border-[#374151] text-[#9ca3af] hover:text-[#f9fafb]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          Satellite Overlay
        </button>
      </div>

      {/* ── 2. Split Workspace Layout (Map 70%, Inspector 30%) ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Map Area */}
        <div className="w-[70%] h-full relative">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-[#e8edf2]">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-[#2563eb] rounded-full animate-spin" />
            </div>
          ) : (
            <SourceAttributionMap
              attributions={attributions}
              selectedAttr={selectedAttr}
              onGridClick={handleGridSelect}
              filterSource={filterSource}
              satelliteOverlay={satelliteOverlay}
            />
          )}
        </div>

        {/* Right Inspector Panel */}
        <div className="w-[30%] bg-[#1f2937] border-l border-[#374151] flex flex-col h-full overflow-hidden shrink-0 shadow-lg">
          
          <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between shrink-0">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[#f9fafb]">
              Attribution Inspector
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {inspectorLoading && (
              <div className="h-64 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#374151] border-t-[#2563eb] rounded-full animate-spin" />
              </div>
            )}

            {!inspectorLoading && !selectedAttr && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6b7280]">
                <Eye className="w-12 h-12 opacity-35 mb-3" strokeWidth={1.5} />
                <p className="text-[13px] font-bold">Select Grid Cell</p>
                <p className="text-[12px] leading-relaxed max-w-[200px] mt-1.5">
                  Click any cell on the map to review source attribution breakdown and satellite evidence metrics.
                </p>
              </div>
            )}

            {!inspectorLoading && selectedAttr && (
              <div className="p-5 space-y-6 fade-in text-[#f9fafb]">
                
                {/* Sector header details */}
                <div>
                  <h3 className="text-[15px] font-bold text-[#f9fafb]">
                    Grid Sector {selectedAttr.grid_id + 1}
                  </h3>
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider">AQI</p>
                      <p className="text-xl font-bold mt-0.5" style={{ color: getAQIColor(selectedAttr.current_aqi) }}>
                        {selectedAttr.current_aqi}
                      </p>
                    </div>
                    <div className="border-l border-[#374151] pl-4">
                      <p className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider">Dominant</p>
                      <p className="text-[13px] font-bold mt-0.5 text-[#f9fafb]">{selectedAttr.dominant_pollutant}</p>
                    </div>
                    <div className="border-l border-[#374151] pl-4">
                      <p className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider">Wind Speed</p>
                      <p className="text-[12px] font-bold mt-0.5 text-[#f9fafb]">{selectedAttr.wind_speed_mps.toFixed(1)} m/s</p>
                    </div>
                  </div>
                </div>

                {/* 1. Source Contribution Breakdown */}
                <div className="space-y-3.5">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5 border-b border-[#374151] pb-1.5">
                    <PieChart className="w-3.5 h-3.5" />
                    Source Contribution Breakdown
                  </h4>
                  <div className="space-y-3">
                    {selectedAttr.contributions.map((c, i) => (
                      <div key={i} className="text-xs space-y-1.5">
                        <div className="flex justify-between text-[#9ca3af] font-medium">
                          <span>{c.source}</span>
                          <span className="font-semibold text-[#f9fafb]">{c.percentage}%</span>
                        </div>
                        <div className="w-full bg-[#111827] h-2 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
                            style={{ width: `${c.percentage}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Confidence Gauge */}
                <div className="bg-[#111827] border border-[#374151] rounded-lg p-3.5 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider">XAI Model Confidence</span>
                    <p className="text-[20px] font-extrabold text-[#f9fafb] mt-0.5">{selectedAttr.confidence}%</p>
                  </div>
                  <Award className="w-6 h-6 text-[#10b981]" strokeWidth={1.75} />
                </div>

                {/* 3. Supporting Evidence Checklist */}
                <div className="space-y-2.5">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5 border-b border-[#374151] pb-1.5">
                    <ListTodo className="w-3.5 h-3.5" />
                    Traceable Evidence
                  </h4>
                  <div className="space-y-2">
                    {selectedAttr.evidence.map((ev, i) => (
                      <div key={i} className="flex gap-2.5 p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-xs leading-normal">
                        <CheckCircle2 className="w-4 h-4 text-[#10b981] mt-0.5 shrink-0" strokeWidth={2} />
                        <span className="text-[#9ca3af]">{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4. Nearby GIS Emission Sources */}
                <div className="space-y-2.5">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5 border-b border-[#374151] pb-1.5">
                    <Compass className="w-3.5 h-3.5" />
                    GIS Proximity Analysis
                  </h4>
                  <div className="space-y-2">
                    {selectedAttr.nearby_sources.slice(0, 4).map((src, i) => (
                      <div key={i} className="flex justify-between items-center p-2.5 bg-[#111827] border border-[#374151] rounded-lg text-xs">
                        <div>
                          <p className="font-semibold text-[#f9fafb]">{src.name}</p>
                          <span className="text-[10px] text-[#6b7280] font-medium">{src.type}</span>
                        </div>
                        <span className="text-[11px] text-[#9ca3af] font-semibold">{src.distance_km} km</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default SourceAttributionPage;
