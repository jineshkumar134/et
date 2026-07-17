import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchForecast, fetchGridDetail } from '../api/aqi';
import type { Prediction, GridDetail } from '../types';
import { MapWrapper } from '../components/map/MapWrapper';
import { AQITrendChart } from '../components/charts/AQITrendChart';
import { PollutantBarChart } from '../components/charts/PollutantBarChart';
import { useConfig } from '../context/ConfigContext';
import {
  Eye, TrendingUp, TrendingDown, Minus,
  Wind, Compass, BarChart3, Layers, Clock
} from 'lucide-react';

function aqiStyle(aqi: number) {
  if (aqi <= 50)  return { color: '#16A34A', label: 'Good' };
  if (aqi <= 100) return { color: '#84CC16', label: 'Satisfactory' };
  if (aqi <= 200) return { color: '#F59E0B', label: 'Moderate' };
  if (aqi <= 300) return { color: '#EA580C', label: 'Poor' };
  if (aqi <= 400) return { color: '#DC2626', label: 'Very Poor' };
  return            { color: '#7C3AED', label: 'Severe' };
}

function TrendBadge({ trend }: { trend: string }) {
  if (trend === 'Increasing')
    return <span className="flex items-center gap-1 text-[11px] text-[#DC2626] font-600"><TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /> Worsening</span>;
  if (trend === 'Decreasing')
    return <span className="flex items-center gap-1 text-[11px] text-[#16A34A] font-600"><TrendingDown className="w-3.5 h-3.5" strokeWidth={2} /> Improving</span>;
  return <span className="flex items-center gap-1 text-[11px] text-[#9CA3AF] font-600"><Minus className="w-3.5 h-3.5" strokeWidth={2} /> Stable</span>;
}

export const ForecastMapPage: React.FC = () => {
  const { config, metadata } = useConfig();
  const [searchParams] = useSearchParams();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [selectedGrid, setSelectedGrid] = useState<GridDetail | null>(null);
  const [activeHorizon, setActiveHorizon] = useState<'current'|'24h'|'48h'|'72h'>('current');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    fetchForecast(activeHorizon, { city: config.city, resolution: config.resolution })
      .then(data => {
        setPredictions(data);
        const preSelected = searchParams.get('grid');
        if (preSelected) handleGridClick(parseInt(preSelected));
      })
      .catch(e => console.error('Map forecast error', e))
      .finally(() => setLoading(false));
  }, [activeHorizon, config?.city, config?.resolution]);

  const handleGridClick = async (gridId: number) => {
    if (!config) return;
    setDetailLoading(true);
    try {
      const detail = await fetchGridDetail(gridId, { city: config.city, resolution: config.resolution });
      setSelectedGrid(detail);
    } catch (e) {
      console.error('Grid detail error', e);
    } finally {
      setDetailLoading(false);
    }
  };

  const getActiveAQI = (g: GridDetail) => {
    if (activeHorizon === '24h') return g.aqi_24h;
    if (activeHorizon === '48h') return g.aqi_48h;
    if (activeHorizon === '72h') return g.aqi_72h;
    return g.current_aqi;
  };

  if (!config || !metadata) {
    return (
      <div className="h-[calc(100vh-52px)] flex items-center justify-center bg-[#111827]">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  const activeStyle = selectedGrid ? aqiStyle(getActiveAQI(selectedGrid)) : null;

  return (
    <div className="h-[calc(100vh-52px)] flex overflow-hidden bg-[#111827]">

      {/* ── Map area (70%) ── */}
      <div className="flex-1 relative flex flex-col">

        {/* Floating horizon selector */}
        <div className="absolute top-3 left-3 z-[1000] bg-white border border-[#E5E7EB] rounded-lg shadow-md px-3 py-1.5 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />
          <div className="flex gap-1">
            {(['current','24h','48h','72h'] as const).map(h => (
              <button
                key={h}
                onClick={() => setActiveHorizon(h)}
                className={`px-3 py-1 rounded text-[11px] font-600 transition-colors ${
                  activeHorizon === h
                    ? 'bg-[#2563EB] text-white'
                    : 'text-[#6B7280] hover:text-[#374151] hover:bg-[#F9FAFB]'
                }`}
              >
                {h === 'current' ? 'Current' : h}
              </button>
            ))}
          </div>
        </div>

        {/* City label */}
        <div className="absolute top-3 right-3 z-[1000] bg-white border border-[#E5E7EB] rounded-lg shadow-md px-3 py-1.5">
          <span className="text-[11px] font-600 text-[#374151]">{metadata.city_name}</span>
          <span className="text-[10px] text-[#9CA3AF] ml-1">· {predictions.length} grids</span>
        </div>

        {/* Map */}
        <div className="flex-1">
          {!loading ? (
            <MapWrapper predictions={predictions} activeHorizon={activeHorizon} onGridClick={handleGridClick} />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-[#E8EDF2]">
              <div className="w-8 h-8 rounded-full border-2 border-[#D1D5DB] border-t-[#2563EB] animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* ── Right inspector panel (30%) ── */}
      <div className="w-[340px] xl:w-[380px] bg-[#1F2937] border-l border-[#374151] flex flex-col overflow-hidden shrink-0">

        {/* Panel header */}
        <div className="px-5 py-3.5 border-b border-[#374151] flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
          <span className="text-[13px] font-600 text-[#F9FAFB]">Grid Inspector</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {detailLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
            </div>
          )}

          {!detailLoading && !selectedGrid && (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Eye className="w-10 h-10 text-[#374151] mb-3" strokeWidth={1.25} />
              <p className="text-[13px] font-600 text-[#6B7280]">No grid selected</p>
              <p className="text-[12px] text-[#4B5563] mt-1 leading-relaxed max-w-[200px]">
                Click any coloured grid cell on the map to inspect forecasts and spatial data.
              </p>
            </div>
          )}

          {!detailLoading && selectedGrid && (
            <div className="p-5 space-y-5 fade-in">

              {/* Grid header */}
              <div>
                <h3 className="text-[14px] font-700 text-[#F9FAFB]">
                  {selectedGrid.area_name || `Grid ${selectedGrid.grid_id + 1}`}
                </h3>
                <p className="text-[11px] text-[#6B7280] mt-0.5 font-mono">
                  {selectedGrid.lat.toFixed(4)}°N, {selectedGrid.lon.toFixed(4)}°E
                </p>
                <div className="mt-1">
                  <TrendBadge trend={selectedGrid.trend} />
                </div>
              </div>

              {/* AQI badge */}
              <div className="bg-[#111827] rounded-xl p-4 flex items-center justify-between border border-[#374151]">
                <div>
                  <p className="text-[10px] font-600 text-[#6B7280] uppercase tracking-wider">Predicted AQI</p>
                  <p className="text-[36px] font-800 leading-none mt-1" style={{ color: activeStyle?.color }}>
                    {Math.round(getActiveAQI(selectedGrid))}
                  </p>
                  <span
                    className="inline-block mt-1.5 text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: activeStyle?.color + '20', color: activeStyle?.color }}
                  >
                    {activeStyle?.label}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-600 text-[#6B7280] uppercase tracking-wider">Confidence</p>
                  <p className="text-[22px] font-700 text-[#F9FAFB] mt-1">{Math.round(selectedGrid.confidence)}%</p>
                  <div className="w-20 h-1.5 bg-[#374151] rounded-full overflow-hidden mt-2 ml-auto">
                    <div className="h-full bg-[#16A34A] rounded-full" style={{ width: `${selectedGrid.confidence}%` }} />
                  </div>
                </div>
              </div>

              {/* Pollutant breakdown */}
              <div>
                <h4 className="text-[11px] font-600 text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Wind className="w-3.5 h-3.5" strokeWidth={1.75} /> Pollutants
                </h4>
                <PollutantBarChart data={selectedGrid} />
              </div>

              {/* 7-day trend */}
              <div>
                <h4 className="text-[11px] font-600 text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <BarChart3 className="w-3.5 h-3.5" strokeWidth={1.75} /> 7-Day AQI History
                </h4>
                <AQITrendChart data={selectedGrid.time_series} />
              </div>

              {/* Spatial characteristics */}
              <div>
                <h4 className="text-[11px] font-600 text-[#6B7280] uppercase tracking-wider flex items-center gap-1.5 mb-3">
                  <Compass className="w-3.5 h-3.5" strokeWidth={1.75} /> Spatial Characteristics
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Road Density',   value: `${Math.round(selectedGrid.road_density * 100)}%` },
                    { label: 'Industrial',     value: `${Math.round(selectedGrid.industrial_area_pct * 100)}%` },
                    { label: 'Green Cover',    value: `${Math.round(selectedGrid.green_cover_pct * 100)}%` },
                    { label: 'Elevation',      value: `${Math.round(selectedGrid.elevation)} m` },
                  ].map(item => (
                    <div key={item.label} className="bg-[#111827] border border-[#374151] rounded-lg p-3">
                      <p className="text-[10px] text-[#6B7280] uppercase tracking-wider">{item.label}</p>
                      <p className="text-[14px] font-700 text-[#F9FAFB] mt-0.5">{item.value}</p>
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

export default ForecastMapPage;
