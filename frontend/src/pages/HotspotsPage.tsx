import React, { useEffect, useState } from 'react';
import { fetchForecast } from '../api/aqi';
import type { Prediction } from '../types';
import { useConfig } from '../context/ConfigContext';
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Flame, ShieldCheck, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

function aqiStyle(aqi: number) {
  if (aqi <= 50)  return { color: '#16A34A', label: 'Good',        risk: 'Low'      };
  if (aqi <= 100) return { color: '#84CC16', label: 'Satisfactory', risk: 'Low'     };
  if (aqi <= 200) return { color: '#F59E0B', label: 'Moderate',    risk: 'Medium'   };
  if (aqi <= 300) return { color: '#EA580C', label: 'Poor',        risk: 'High'     };
  if (aqi <= 400) return { color: '#DC2626', label: 'Very Poor',   risk: 'Critical' };
  return            { color: '#7C3AED', label: 'Severe',    risk: 'Emergency' };
}

function riskBadge(risk: string, color: string) {
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[10px] font-700 uppercase tracking-wider"
      style={{ background: color + '18', color }}
    >
      {risk}
    </span>
  );
}

function TrendCell({ trend }: { trend: string }) {
  if (trend === 'Increasing') return <div className="flex items-center gap-1 text-[#DC2626]"><TrendingUp className="w-3.5 h-3.5" strokeWidth={2} /><span className="text-[11px] font-600">Rising</span></div>;
  if (trend === 'Decreasing') return <div className="flex items-center gap-1 text-[#16A34A]"><TrendingDown className="w-3.5 h-3.5" strokeWidth={2} /><span className="text-[11px] font-600">Falling</span></div>;
  return <div className="flex items-center gap-1 text-[#9CA3AF]"><Minus className="w-3.5 h-3.5" strokeWidth={2} /><span className="text-[11px] font-600">Stable</span></div>;
}

export const HotspotsPage: React.FC = () => {
  const { config, metadata } = useConfig();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    fetchForecast('current', { city: config.city, resolution: config.resolution })
      .then(setPredictions)
      .catch(e => console.error('Hotspots load error', e))
      .finally(() => setLoading(false));
  }, [config?.city, config?.resolution]);

  if (loading || !metadata) {
    return (
      <div className="flex items-center justify-center h-full bg-[#111827]">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  // Filter and sort
  const hotspots = [...predictions]
    .filter(p => {
      const s = aqiStyle(p.aqi);
      const isHot = ['Moderate', 'Poor', 'Very Poor', 'Severe'].includes(s.label);
      const matchSearch = search.trim() === '' ||
        (p.area_name?.toLowerCase().includes(search.toLowerCase()) ||
         `sector ${p.grid_id + 1}`.includes(search.toLowerCase()));
      return isHot && matchSearch;
    })
    .sort((a, b) => b.aqi - a.aqi);

  // Summary stats
  const peakAQI = predictions.length ? Math.max(...predictions.map(p => p.aqi)) : 0;
  const severeCount = predictions.filter(p => aqiStyle(p.aqi).label === 'Severe').length;

  return (
    <div className="p-6 space-y-6 max-w-[1200px] mx-auto fade-in">

      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-700 text-[#F9FAFB] flex items-center gap-2">
            <Flame className="w-5 h-5 text-[#DC2626]" strokeWidth={1.75} />
            Pollution Hotspots — {metadata.city_name}
          </h1>
          <p className="text-[13px] text-[#6B7280] mt-0.5">
            Ranked list of grid sectors exceeding standard CPCB thresholds.
          </p>
        </div>
        {/* Search */}
        <div className="relative w-56 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search zones…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-[#1F2937] border border-[#374151] focus:border-[#2563EB] rounded-lg text-[12px] text-[#F9FAFB] placeholder-[#4B5563] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Summary chips */}
      <div className="flex gap-4">
        {[
          { label: 'Active Hotspots', value: hotspots.length, color: '#DC2626', icon: <AlertTriangle className="w-4 h-4" strokeWidth={1.75} /> },
          { label: 'Peak AQI',        value: Math.round(peakAQI), color: '#F59E0B', icon: <Flame className="w-4 h-4" strokeWidth={1.75} /> },
          { label: 'Severe Zones',    value: severeCount,          color: '#7C3AED', icon: <AlertTriangle className="w-4 h-4" strokeWidth={1.75} /> },
          { label: 'Monitoring',      value: '100% Online',        color: '#16A34A', icon: <ShieldCheck className="w-4 h-4" strokeWidth={1.75} /> },
        ].map((c, i) => (
          <div key={i} className="flex items-center gap-3 bg-[#1F2937] border border-[#374151] rounded-xl px-4 py-3">
            <span style={{ color: c.color }}>{c.icon}</span>
            <div>
              <p className="text-[10px] font-600 text-[#6B7280] uppercase tracking-wider">{c.label}</p>
              <p className="text-[16px] font-700 text-[#F9FAFB]">{c.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[#1F2937] border border-[#374151] rounded-xl overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#374151] bg-[#111827]">
              {['Rank', 'Zone', 'Current AQI', 'Forecast AQI', 'Category', 'Trend', 'Risk Level', 'Confidence'].map(h => (
                <th key={h} className="px-4 py-3 text-[10px] font-700 text-[#6B7280] uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#374151]/50">
            {hotspots.length > 0 ? (
              hotspots.map((g, rank) => {
                const s = aqiStyle(g.aqi);
                const f = aqiStyle(g.aqi_24h);
                return (
                  <tr
                    key={g.grid_id}
                    onClick={() => navigate(`/map?grid=${g.grid_id}`)}
                    className="hover:bg-[#374151]/20 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-[12px] font-700 text-[#4B5563]">#{rank + 1}</td>
                    <td className="px-4 py-3">
                      <p className="text-[13px] font-600 text-[#F9FAFB]">
                        {g.area_name || `Sector ${g.grid_id + 1}`}
                      </p>
                      <p className="text-[10px] text-[#6B7280] mt-0.5 font-mono">
                        {g.lat.toFixed(3)}°N, {g.lon.toFixed(3)}°E
                      </p>
                    </td>
                    <td className="px-4 py-3 text-[14px] font-800" style={{ color: s.color }}>
                      {Math.round(g.aqi)}
                    </td>
                    <td className="px-4 py-3 text-[14px] font-700" style={{ color: f.color }}>
                      {Math.round(g.aqi_24h)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded"
                        style={{ background: s.color + '18', color: s.color }}
                      >
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3"><TrendCell trend={g.trend} /></td>
                    <td className="px-4 py-3">{riskBadge(s.risk, s.color)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-[#374151] rounded-full overflow-hidden">
                          <div className="h-full bg-[#16A34A]" style={{ width: `${g.confidence}%` }} />
                        </div>
                        <span className="text-[11px] text-[#9CA3AF] font-600">{Math.round(g.confidence)}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-6 py-12 text-center text-[13px] text-[#4B5563]">
                  {search ? `No hotspots matching "${search}".` : 'No sectors currently exceed threshold levels.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

    </div>
  );
};

export default HotspotsPage;
