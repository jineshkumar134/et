import React, { useState } from 'react';
import { useConfig } from '../context/ConfigContext';
import {
  FileBarChart, Download, Clock, HeartPulse, School,
  Hospital, HardHat, Baby, UserCheck, AlertCircle, CheckCircle2
} from 'lucide-react';
import { fetchForecast } from '../api/aqi';
import { useEffect } from 'react';

/* ─── Shared helpers ─────────────────────────────────────────── */
function aqiLabel(aqi: number) {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}
function aqiColor(aqi: number) {
  if (aqi <= 50)  return '#16A34A';
  if (aqi <= 100) return '#84CC16';
  if (aqi <= 200) return '#F59E0B';
  if (aqi <= 300) return '#EA580C';
  if (aqi <= 400) return '#DC2626';
  return '#7C3AED';
}

const PageShell: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <div className="p-6 space-y-6 max-w-[1200px] mx-auto fade-in">
    <div>
      <h1 className="text-[20px] font-700 text-[#F9FAFB]">{title}</h1>
      <p className="text-[13px] text-[#6B7280] mt-0.5">{subtitle}</p>
    </div>
    {children}
  </div>
);

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-[#1F2937] border border-[#374151] rounded-xl ${className}`}>{children}</div>
);





/* ─── HEALTH ADVISORY ────────────────────────────────────────── */
interface HealthGroup {
  label:   string;
  icon:    React.ReactNode;
  limit:   number;          // AQI above this → advisory triggered
  advice:  string;
  caution: string;
}

const HEALTH_GROUPS: HealthGroup[] = [
  {
    label: 'Schools & Children',
    icon: <School className="w-5 h-5" strokeWidth={1.75} />,
    limit: 100,
    advice: 'Restrict outdoor physical activities. Keep windows closed during peak hours.',
    caution: 'Avoid prolonged outdoor exposure. N95 masks recommended for commutes.',
  },
  {
    label: 'Hospitals & Clinics',
    icon: <Hospital className="w-5 h-5" strokeWidth={1.75} />,
    limit: 150,
    advice: 'Alert respiratory and cardiology wards. Monitor indoor air quality.',
    caution: 'Increase observation frequency for COPD and asthma patients.',
  },
  {
    label: 'Outdoor Workers',
    icon: <HardHat className="w-5 h-5" strokeWidth={1.75} />,
    limit: 100,
    advice: 'Provide N95 masks at all outdoor worksites.',
    caution: 'Mandatory breaks in sheltered areas every 2 hours during Poor AQI periods.',
  },
  {
    label: 'Children under 12',
    icon: <Baby className="w-5 h-5" strokeWidth={1.75} />,
    limit: 50,
    advice: 'No outdoor play. Keep children indoors with purifiers running.',
    caution: 'Consult paediatrician if any breathing difficulty is observed.',
  },
  {
    label: 'Senior Citizens (60+)',
    icon: <UserCheck className="w-5 h-5" strokeWidth={1.75} />,
    limit: 100,
    advice: 'Avoid morning walks and outdoor exercise. Use N95 masks outdoors.',
    caution: 'Have inhalers and emergency medication readily accessible.',
  },
];

export const HealthAdvisoryPage: React.FC = () => {
  const { config, metadata } = useConfig();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config) return;
    fetchForecast('current', { city: config.city, resolution: config.resolution })
      .then(() => setLoading(false))
      .catch(() => setLoading(false));
  }, [config?.city, config?.resolution]);

  const cityAQI = metadata?.city_aqi ?? 0;
  const catColor = aqiColor(cityAQI);
  const catLabel = aqiLabel(cityAQI);

  return (
    <PageShell
      title="Health Advisory"
      subtitle={`Population health recommendations based on current AQI forecast for ${metadata?.city_name ?? '—'}.`}
    >
      {/* Current AQI banner */}
      {!loading && (
        <Card className="p-5 flex items-center gap-4">
          <HeartPulse className="w-6 h-6 shrink-0" style={{ color: catColor }} strokeWidth={1.75} />
          <div className="flex-1">
            <p className="text-[12px] font-600 text-[#6B7280] uppercase tracking-wider">Current City AQI</p>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-[32px] font-800 leading-none" style={{ color: catColor }}>
                {Math.round(cityAQI)}
              </span>
              <span
                className="text-[11px] font-700 uppercase tracking-wider px-2 py-0.5 rounded"
                style={{ background: catColor + '18', color: catColor }}
              >
                {catLabel}
              </span>
            </div>
          </div>
          <p className="text-[12px] text-[#6B7280] max-w-xs leading-relaxed">
            Health advisories below are automatically generated from the current spatial AQI forecast.
            They update whenever the forecast model runs.
          </p>
        </Card>
      )}

      {/* Health group cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {HEALTH_GROUPS.map((g, i) => {
          const triggered = cityAQI > g.limit;
          const statusColor = triggered ? '#DC2626' : '#16A34A';
          return (
            <Card key={i} className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: statusColor + '15', color: statusColor }}
                  >
                    {g.icon}
                  </div>
                  <p className="text-[13px] font-600 text-[#F9FAFB]">{g.label}</p>
                </div>
                <span
                  className="text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: statusColor + '18', color: statusColor }}
                >
                  {triggered ? 'Advisory' : 'Normal'}
                </span>
              </div>
              <div className="border-t border-[#374151] pt-3">
                <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
                  {triggered ? g.caution : g.advice}
                </p>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-[#6B7280]">
                {triggered
                  ? <AlertCircle className="w-3 h-3 text-[#DC2626]" strokeWidth={2} />
                  : <CheckCircle2 className="w-3 h-3 text-[#16A34A]" strokeWidth={2} />
                }
                <span>Triggered when AQI &gt; {g.limit}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </PageShell>
  );
};

/* ─── REPORTS ────────────────────────────────────────────────── */
export const ComplianceReportsPage: React.FC = () => {
  const { metadata } = useConfig();
  const reports = [
    { title: 'Forecast Summary Report',          desc: 'City-wide AQI predictions, pollutant distribution, and confidence intervals.',  format: 'PDF',  size: '1.4 MB', date: 'Today' },
    { title: 'Daily AQI Bulletin',               desc: '24-hour rolling AQI statistics across all monitoring stations.',                format: 'PDF',  size: '840 KB', date: 'Today' },
    { title: 'Weekly AQI Analysis',              desc: '7-day trend analysis including peak, valley, and average AQI values.',          format: 'XLSX', size: '620 KB', date: 'This week' },
    { title: 'NCAP Compliance Matrix',           desc: 'National Clean Air Programme regulatory compliance status for all grids.',       format: 'PDF',  size: '2.1 MB', date: 'This month' },
    { title: 'Spatial Grid Data Export',         desc: 'Full grid-level AQI, pollutant, and coordinate data in machine-readable form.', format: 'CSV',  size: '3.8 MB', date: 'Today' },
    { title: 'Model Performance Summary',        desc: 'Ensemble model RMSE, MAE, and R² scores across all forecast horizons.',         format: 'PDF',  size: '480 KB', date: 'This week' },
  ];

  return (
    <PageShell
      title="Reports"
      subtitle={`Download operational reports for ${metadata?.city_name ?? '—'} from the forecasting system.`}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reports.map((r, i) => (
          <Card key={i} className="p-5 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-[#2563EB]/10 border border-[#2563EB]/20 flex items-center justify-center shrink-0">
                <FileBarChart className="w-4 h-4 text-[#2563EB]" strokeWidth={1.75} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-600 text-[#F9FAFB]">{r.title}</p>
                <p className="text-[11px] text-[#6B7280] mt-0.5 leading-relaxed">{r.desc}</p>
                <div className="flex gap-2 mt-2 text-[10px] text-[#4B5563]">
                  <span className="bg-[#374151] px-1.5 py-0.5 rounded font-600">{r.format}</span>
                  <span>{r.size}</span>
                  <span>·</span>
                  <Clock className="w-3 h-3" strokeWidth={1.75} />
                  <span>{r.date}</span>
                </div>
              </div>
            </div>
            <button className="shrink-0 p-2 rounded-lg bg-[#111827] border border-[#374151] hover:border-[#2563EB] text-[#6B7280] hover:text-[#2563EB] transition-colors">
              <Download className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </Card>
        ))}
      </div>
    </PageShell>
  );
};
