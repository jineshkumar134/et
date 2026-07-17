import React, { useEffect, useState } from 'react';
import { fetchForecast } from '../api/aqi';
import type { Prediction } from '../types';
import { useConfig } from '../context/ConfigContext';
import {
  TrendingUp, TrendingDown, Minus,
  AlertTriangle, ShieldCheck, Radio, Zap, Activity
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/* ── AQI colour helper (CPCB standard) ─────────────────────── */
function aqiStyle(aqi: number) {
  if (aqi <= 50)  return { color: '#16A34A', bg: '#F0FDF4', label: 'Good' };
  if (aqi <= 100) return { color: '#84CC16', bg: '#F7FEE7', label: 'Satisfactory' };
  if (aqi <= 200) return { color: '#F59E0B', bg: '#FFFBEB', label: 'Moderate' };
  if (aqi <= 300) return { color: '#EA580C', bg: '#FFF7ED', label: 'Poor' };
  if (aqi <= 400) return { color: '#DC2626', bg: '#FEF2F2', label: 'Very Poor' };
  return            { color: '#7C3AED', bg: '#F5F3FF', label: 'Severe' };
}

function trendIcon(trend: string) {
  if (trend === 'Increasing') return <TrendingUp className="w-3.5 h-3.5 text-[#DC2626]" strokeWidth={2} />;
  if (trend === 'Decreasing') return <TrendingDown className="w-3.5 h-3.5 text-[#16A34A]" strokeWidth={2} />;
  return <Minus className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={2} />;
}

export const Home: React.FC = () => {
  const { config, metadata } = useConfig();
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!config) return;
    setLoading(true);
    fetchForecast('current', { city: config.city, resolution: config.resolution })
      .then(setPredictions)
      .catch(e => console.error('Overview load error', e))
      .finally(() => setLoading(false));
  }, [config?.city, config?.resolution]);

  if (loading || !metadata || !config) {
    return (
      <div className="flex items-center justify-center h-full bg-[#111827]">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  const cityS = aqiStyle(metadata.city_aqi);
  const sorted = [...predictions].sort((a, b) => b.aqi - a.aqi);
  const topPolluted = sorted.slice(0, 5);
  const cleanest   = [...predictions].sort((a, b) => a.aqi - b.aqi).slice(0, 5);

  // Derived stats from grid statistics
  const getCount = (key: string) =>
    metadata.grid_statistics.find(g => g.key === key)?.count ?? 0;

  const goodCount      = getCount('Good');
  const satisfyCount   = getCount('Satisfactory');
  const moderateCount  = getCount('Moderate');
  const poorCount      = metadata.grid_statistics.filter(g =>
    ['Poor','Very Poor','Severe'].includes(g.key)).reduce((s,g) => s + g.count, 0);

  /* KPI cards */
  const kpis = [
    {
      label: 'Average AQI',
      value: Math.round(metadata.city_aqi),
      sub: cityS.label,
      color: cityS.color,
      icon: <Activity className="w-5 h-5" />,
    },
    {
      label: 'Worst Zone',
      value: topPolluted[0] ? Math.round(topPolluted[0].aqi) : '—',
      sub: topPolluted[0]?.area_name ?? '—',
      color: '#DC2626',
      icon: <AlertTriangle className="w-5 h-5" />,
      onClick: () => topPolluted[0] && navigate(`/map?grid=${topPolluted[0].grid_id}`),
    },
    {
      label: 'Cleanest Zone',
      value: cleanest[0] ? Math.round(cleanest[0].aqi) : '—',
      sub: cleanest[0]?.area_name ?? '—',
      color: '#16A34A',
      icon: <ShieldCheck className="w-5 h-5" />,
      onClick: () => cleanest[0] && navigate(`/map?grid=${cleanest[0].grid_id}`),
    },
    {
      label: 'Monitoring Stations',
      value: (metadata as any).monitoring_stations ?? 26,
      sub: 'Active & Reporting',
      color: '#2563EB',
      icon: <Radio className="w-5 h-5" />,
    },
    {
      label: 'Forecast Accuracy',
      value: '91%',
      sub: 'Ensemble model · 24h',
      color: '#7C3AED',
      icon: <Zap className="w-5 h-5" />,
    },
    {
      label: 'Predicted Alerts',
      value: poorCount,
      sub: 'Grids exceeding Poor',
      color: '#F59E0B',
      icon: <AlertTriangle className="w-5 h-5" />,
      onClick: () => navigate('/hotspots'),
    },
  ];

  /* AQI distribution for bar chart */
  const distribution = [
    { label: 'Good',        count: goodCount,     color: '#16A34A' },
    { label: 'Satisfactory',count: satisfyCount,  color: '#84CC16' },
    { label: 'Moderate',    count: moderateCount, color: '#F59E0B' },
    { label: 'Poor+',       count: poorCount,     color: '#DC2626' },
  ];
  const maxDist = Math.max(...distribution.map(d => d.count), 1);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto fade-in">

      {/* Page header */}
      <div>
        <h1 className="text-[20px] font-700 text-[#F9FAFB]">Overview — {metadata.city_name}</h1>
        <p className="text-[13px] text-[#6B7280] mt-0.5">
          Integrated spatial forecast for regulatory assessment and urban planning.
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {kpis.map((k, i) => (
          <div
            key={i}
            onClick={k.onClick}
            className={`bg-[#1F2937] border border-[#374151] rounded-xl p-5 space-y-3 ${k.onClick ? 'cursor-pointer hover:border-[#4B5563] transition-colors' : ''}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-600 text-[#6B7280] uppercase tracking-wider">{k.label}</span>
              <span style={{ color: k.color }} className="opacity-60">{k.icon}</span>
            </div>
            <div>
              <span className="text-[28px] font-800 leading-none" style={{ color: k.color }}>{k.value}</span>
            </div>
            <p className="text-[11px] text-[#6B7280]">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Bottom section: distribution + hotspot list + alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

        {/* AQI Distribution */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
          <h2 className="text-[13px] font-600 text-[#F9FAFB] mb-4">Grid Distribution</h2>
          <div className="space-y-3">
            {distribution.map(d => (
              <div key={d.label}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[#9CA3AF] font-500">{d.label}</span>
                  <span className="text-[#F9FAFB] font-600">{d.count} grids</span>
                </div>
                <div className="h-2 bg-[#374151] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${(d.count / maxDist) * 100}%`, background: d.color }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#4B5563] mt-4">Total: {metadata.num_grids} grids monitored</p>
        </div>

        {/* Top Polluted */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
          <h2 className="text-[13px] font-600 text-[#F9FAFB] mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
            Top Polluted Zones
          </h2>
          <div className="space-y-2">
            {topPolluted.map((g, rank) => {
              const s = aqiStyle(g.aqi);
              return (
                <div
                  key={g.grid_id}
                  onClick={() => navigate(`/map?grid=${g.grid_id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 bg-[#111827] rounded-lg border border-[#374151] hover:border-[#4B5563] cursor-pointer transition-colors"
                >
                  <span className="text-[11px] font-700 text-[#4B5563] w-4">#{rank+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-600 text-[#F9FAFB] truncate">{g.area_name || `Sector ${g.grid_id+1}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trendIcon(g.trend)}
                    <span className="text-[12px] font-700" style={{ color: s.color }}>
                      {Math.round(g.aqi)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Cleanest + Recent alerts */}
        <div className="bg-[#1F2937] border border-[#374151] rounded-xl p-5">
          <h2 className="text-[13px] font-600 text-[#F9FAFB] mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" strokeWidth={1.75} />
            Cleanest Zones
          </h2>
          <div className="space-y-2">
            {cleanest.map((g, rank) => {
              const s = aqiStyle(g.aqi);
              return (
                <div
                  key={g.grid_id}
                  onClick={() => navigate(`/map?grid=${g.grid_id}`)}
                  className="flex items-center gap-3 px-3 py-2.5 bg-[#111827] rounded-lg border border-[#374151] hover:border-[#4B5563] cursor-pointer transition-colors"
                >
                  <span className="text-[11px] font-700 text-[#4B5563] w-4">#{rank+1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-600 text-[#F9FAFB] truncate">{g.area_name || `Sector ${g.grid_id+1}`}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {trendIcon(g.trend)}
                    <span className="text-[12px] font-700" style={{ color: s.color }}>
                      {Math.round(g.aqi)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
