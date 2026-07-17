import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchHealthAdvisories,
  sendNotification,
} from '../api/aqi';
import type { HealthAdvisory, HealthPayload } from '../api/aqi';
import { HealthRiskMap } from '../components/map/HealthRiskMap';
import { useConfig } from '../context/ConfigContext';
import {
  HeartPulse, Users, School, Building2, AlertTriangle,
  Languages, Bell, Copy, ChevronDown, ChevronRight,
  Thermometer, Droplets, Filter, RefreshCw, ShieldCheck,
  Activity, MapPin, CheckCircle2, Zap, Info
} from 'lucide-react';

// ─── Language Metadata ──────────────────────────────────────────────────────
const LANGUAGES = [
  { key: 'english',   label: 'English',    native: 'English'   },
  { key: 'hindi',     label: 'Hindi',      native: 'हिन्दी'     },
  { key: 'kannada',   label: 'Kannada',    native: 'ಕನ್ನಡ'      },
  { key: 'tamil',     label: 'Tamil',      native: 'தமிழ்'      },
  { key: 'telugu',    label: 'Telugu',     native: 'తెలుగు'      },
  { key: 'bengali',   label: 'Bengali',    native: 'বাংলা'       },
  { key: 'marathi',   label: 'Marathi',    native: 'मराठी'       },
  { key: 'gujarati',  label: 'Gujarati',   native: 'ગુજરાતી'    },
  { key: 'malayalam', label: 'Malayalam',  native: 'മലയാളം'     },
  { key: 'punjabi',   label: 'Punjabi',    native: 'ਪੰਜਾਬੀ'      },
];

// ─── Risk Level Styling ─────────────────────────────────────────────────────
const RISK_STYLE: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  'Very Low': { bg: 'bg-[#16a34a]/10', text: 'text-[#4ade80]', border: 'border-[#16a34a]/30', badge: 'bg-[#16a34a]/20 text-[#4ade80]' },
  'Low':      { bg: 'bg-[#84cc16]/10', text: 'text-[#a3e635]', border: 'border-[#84cc16]/30', badge: 'bg-[#84cc16]/20 text-[#a3e635]' },
  'Moderate': { bg: 'bg-[#f59e0b]/10', text: 'text-[#fcd34d]', border: 'border-[#f59e0b]/30', badge: 'bg-[#f59e0b]/20 text-[#fcd34d]' },
  'High':     { bg: 'bg-[#ef4444]/10', text: 'text-[#f87171]', border: 'border-[#ef4444]/30', badge: 'bg-[#ef4444]/20 text-[#f87171]' },
  'Severe':   { bg: 'bg-[#7c3aed]/10', text: 'text-[#c4b5fd]', border: 'border-[#7c3aed]/30', badge: 'bg-[#7c3aed]/20 text-[#c4b5fd]' },
};

// ─── Population Category Icons ──────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  'Children':        '👶',
  'Senior Citizens': '👴',
  'Pregnant Women':  '🤰',
  'Outdoor Workers': '👷',
  'Asthma Patients': '🫁',
  'COPD Patients':   '🏥',
  'Heart Patients':  '❤️',
  'Cyclists':        '🚴',
  'Joggers':         '🏃',
  'General Public':  '👥',
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
const StatCard: React.FC<{
  label: string; value: string | number; sub?: string;
  icon: React.ReactNode; colour: string;
}> = ({ label, value, sub, icon, colour }) => (
  <div className={`flex items-center gap-3 bg-[#1f2937] border border-[#374151] rounded-lg px-4 py-3`}>
    <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${colour}`}>
      {icon}
    </div>
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280]">{label}</p>
      <p className="text-[16px] font-bold text-[#f9fafb] leading-tight">{value}</p>
      {sub && <p className="text-[10px] text-[#6b7280] mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─── Notification Channel Button ─────────────────────────────────────────────
const CopyButton: React.FC<{ text: string; label: string }> = ({ text, label }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1.5 text-[10px] text-[#9ca3af] hover:text-[#f9fafb] bg-[#374151] hover:bg-[#4b5563] px-2 py-1 rounded transition-colors"
    >
      {copied ? <CheckCircle2 className="w-3 h-3 text-[#4ade80]" /> : <Copy className="w-3 h-3" />}
      {copied ? 'Copied!' : label}
    </button>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export const HealthAdvisoryPage: React.FC = () => {
  const { config } = useConfig();

  // Data state
  const [payload, setPayload] = useState<HealthPayload | null>(null);
  const [selectedAdvisory, setSelectedAdvisory] = useState<HealthAdvisory | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifLoading, setNotifLoading] = useState(false);

  // Filters
  const [language, setLanguage] = useState('english');
  const [filterRisk, setFilterRisk] = useState('');

  // Map overlay toggles
  const [showSchools,     setShowSchools]     = useState(true);
  const [showHospitals,   setShowHospitals]   = useState(true);
  const [showOldAgeHomes, setShowOldAgeHomes] = useState(true);
  const [showParks,       setShowParks]       = useState(false);
  const [showSensitive,   setShowSensitive]   = useState(false);

  // Inspector panel UI
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const [notifChannels, setNotifChannels] = useState<string[]>(['sms', 'whatsapp', 'push']);
  const [notifResult, setNotifResult] = useState<any>(null);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const loadData = useCallback(async () => {
    if (!config) return;
    setLoading(true);
    try {
      const data = await fetchHealthAdvisories(
        { city: config.city, resolution: config.resolution },
        { lang: language, riskLevel: filterRisk || undefined }
      );
      setPayload(data);
      if (!selectedAdvisory && data.advisories.length > 0) {
        setSelectedAdvisory(data.advisories[0]);
      }
    } catch (err) {
      console.error('Health advisory fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [config, language, filterRisk]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGridSelect = (adv: HealthAdvisory) => {
    setSelectedAdvisory(adv);
    setNotifResult(null);
    setShowNotifPanel(false);
    setExpandedCat(null);
  };

  const handleSendNotifications = async () => {
    if (!selectedAdvisory || !config) return;
    setNotifLoading(true);
    try {
      const result = await sendNotification(
        selectedAdvisory.grid_id,
        config.city,
        language,
        notifChannels
      );
      setNotifResult(result);
      setShowNotifPanel(true);
    } catch (err) {
      console.error('Notification error:', err);
    } finally {
      setNotifLoading(false);
    }
  };

  const summary = payload?.summary;
  const adv = selectedAdvisory;
  const riskStyle = adv ? (RISK_STYLE[adv.risk_level] || RISK_STYLE['Low']) : RISK_STYLE['Low'];

  const formatPop = (n: number) => n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(0)}K` : n.toString();

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#111827] font-sans">

      {/* ── 1. Header Stats Strip ─────────────────────────────────────────── */}
      <div className="shrink-0 bg-[#1f2937] border-b border-[#374151] px-5 py-3">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="grid grid-cols-6 gap-3">
            <StatCard
              label="Health Risk" icon={<HeartPulse className="w-4 h-4 text-white" />}
              colour="bg-[#ef4444]/20"
              value={summary ? (summary.emergency_alerts > 0 ? 'Severe' : summary.high_severe_count > 10 ? 'High' : 'Moderate') : '—'}
              sub="Current worst"
            />
            <StatCard
              label="High + Severe" icon={<AlertTriangle className="w-4 h-4 text-white" />}
              colour="bg-[#dc2626]/20"
              value={summary?.high_severe_count ?? '—'}
              sub="Grid zones"
            />
            <StatCard
              label="Pop. Exposed" icon={<Users className="w-4 h-4 text-white" />}
              colour="bg-[#7c3aed]/20"
              value={summary ? formatPop(summary.total_population_exposed) : '—'}
              sub="Citizens at risk"
            />
            <StatCard
              label="Schools at Risk" icon={<School className="w-4 h-4 text-white" />}
              colour="bg-[#2563eb]/20"
              value={summary?.schools_at_risk ?? '—'}
              sub="Advisories issued"
            />
            <StatCard
              label="Hospitals Alert" icon={<Building2 className="w-4 h-4 text-white" />}
              colour="bg-[#059669]/20"
              value={summary?.hospitals_on_alert ?? '—'}
              sub="On standby"
            />
            <StatCard
              label="Emergency Alerts" icon={<Zap className="w-4 h-4 text-white" />}
              colour="bg-[#b45309]/20"
              value={summary?.emergency_alerts ?? '—'}
              sub="Severe zones"
            />
          </div>

          {/* Right: Language + Refresh */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-[#111827] border border-[#374151] rounded px-2.5 py-1.5">
              <Languages className="w-3.5 h-3.5 text-[#6b7280]" />
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="bg-transparent text-[12px] text-[#f9fafb] focus:outline-none"
              >
                {LANGUAGES.map(l => (
                  <option key={l.key} value={l.key}>{l.native} ({l.label})</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadData}
              className="flex items-center gap-1.5 text-[12px] bg-[#2563eb] hover:bg-[#1d4ed8] text-white px-3 py-1.5 rounded transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Filter Strip */}
        <div className="flex items-center gap-4 mt-2.5 text-[11px] text-[#9ca3af]">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Risk Level:</span>
            <select
              value={filterRisk}
              onChange={(e) => setFilterRisk(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2 py-0.5 text-[11px] text-[#f9fafb] focus:outline-none"
            >
              <option value="">All Levels</option>
              {['Very Low','Low','Moderate','High','Severe'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <span className="h-4 w-px bg-[#374151]" />

          {/* Overlay Toggles */}
          <div className="flex items-center gap-3">
            <span className="text-[#6b7280]">Overlays:</span>
            {[
              { key: 'schools',       label: '🏫 Schools',      val: showSchools,     set: setShowSchools },
              { key: 'hospitals',     label: '🏥 Hospitals',    val: showHospitals,   set: setShowHospitals },
              { key: 'old_age_homes', label: '🏠 Old Age',      val: showOldAgeHomes, set: setShowOldAgeHomes },
              { key: 'parks',         label: '🌳 Parks',        val: showParks,       set: setShowParks },
              { key: 'sensitive',     label: '⚠ Sensitive',     val: showSensitive,   set: setShowSensitive },
            ].map(({ key, label, val, set }) => (
              <button
                key={key}
                onClick={() => set(!val)}
                className={`px-2 py-0.5 rounded border text-[10px] transition-colors ${
                  val
                    ? 'border-[#2563eb]/60 bg-[#2563eb]/10 text-[#93c5fd]'
                    : 'border-[#374151] bg-transparent text-[#6b7280] hover:text-[#9ca3af]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 2. Main Workspace ─────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Left: Map (70%) */}
        <div className="flex-[7] relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 z-[1100] bg-[#111827]/80 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563eb] animate-spin" />
                <p className="text-[12px] text-[#9ca3af]">Computing health advisories…</p>
              </div>
            </div>
          )}
          <div className="w-full h-full relative">
            <HealthRiskMap
              advisories={payload?.advisories ?? []}
              facilities={payload?.facilities ?? null}
              selectedGridId={adv?.grid_id ?? null}
              onGridSelect={handleGridSelect}
              showSchools={showSchools}
              showHospitals={showHospitals}
              showOldAgeHomes={showOldAgeHomes}
              showParks={showParks}
              showSensitiveZones={showSensitive}
            />
          </div>
        </div>

        {/* Right: Ward Inspector + Notification Panel (30%) */}
        <div className="flex-[3] flex flex-col border-l border-[#374151] bg-[#1f2937] overflow-hidden min-w-[340px] max-w-[420px]">

          {/* Inspector Header */}
          <div className={`shrink-0 px-4 py-3 border-b border-[#374151] ${adv ? riskStyle.bg : 'bg-[#1f2937]'}`}>
            {adv ? (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#6b7280]" />
                      <p className="text-[13px] font-bold text-[#f9fafb]">{adv.ward}</p>
                      <span className="text-[9px] text-[#6b7280]">Grid {adv.grid_id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${riskStyle.badge} ${riskStyle.border}`}>
                        {adv.risk_level} Risk
                      </span>
                      <span className="text-[10px] text-[#6b7280]">{adv.confidence}% confidence</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[22px] font-black text-[#f9fafb]">{adv.current_aqi}</p>
                    <p className="text-[9px] text-[#6b7280]">AQI NOW</p>
                  </div>
                </div>

                {/* Forecast mini-row */}
                <div className="flex gap-3 mt-2.5">
                  {[
                    { label: '24h', val: adv.forecast_aqi_24h },
                    { label: '48h', val: adv.forecast_aqi_48h },
                    { label: '72h', val: adv.forecast_aqi_72h },
                  ].map(f => (
                    <div key={f.label} className="flex-1 bg-[#111827]/60 rounded px-2 py-1 text-center">
                      <p className="text-[9px] text-[#6b7280]">{f.label}</p>
                      <p className="text-[13px] font-bold text-[#f9fafb]">{f.val}</p>
                    </div>
                  ))}
                  <div className="flex-1 bg-[#111827]/60 rounded px-2 py-1 text-center">
                    <p className="text-[9px] text-[#6b7280]">Pollutant</p>
                    <p className="text-[11px] font-bold text-[#60a5fa]">{adv.dominant_pollutant}</p>
                  </div>
                </div>

                {/* Weather note */}
                {adv.weather_note && (
                  <div className="mt-2 bg-[#111827]/40 border border-[#374151] rounded px-2.5 py-1.5 flex items-start gap-2">
                    <Info className="w-3 h-3 text-[#f59e0b] shrink-0 mt-0.5" />
                    <p className="text-[10px] text-[#fcd34d] leading-snug">{adv.weather_note}</p>
                  </div>
                )}

                {/* Temp & Humidity */}
                <div className="flex gap-3 mt-2">
                  <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                    <Thermometer className="w-3 h-3 text-[#f87171]" />
                    {adv.temperature_c}°C
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                    <Droplets className="w-3 h-3 text-[#60a5fa]" />
                    {adv.humidity_pct}% RH
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-[#9ca3af]">
                    <Users className="w-3 h-3 text-[#a78bfa]" />
                    {formatPop(adv.population_exposed)} residents
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3 py-2">
                <Activity className="w-5 h-5 text-[#6b7280]" />
                <p className="text-[12px] text-[#9ca3af]">Click a grid cell on the map to view health advisory</p>
              </div>
            )}
          </div>

          {/* Inspector Body — scrollable */}
          {adv && (
            <div className="flex-1 overflow-y-auto custom-scroll divide-y divide-[#374151]">

              {/* Population Category Advisories */}
              <div className="px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />Population Advisories
                </p>
                <div className="space-y-1">
                  {adv.population_advisories.map(pa => (
                    <div key={pa.category} className="border border-[#374151] rounded overflow-hidden">
                      <button
                        onClick={() => setExpandedCat(expandedCat === pa.category ? null : pa.category)}
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-[#374151]/40 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-[13px]">{CAT_ICONS[pa.category] || '👤'}</span>
                          <span className="text-[11px] font-semibold text-[#e5e7eb]">{pa.category}</span>
                        </div>
                        {expandedCat === pa.category
                          ? <ChevronDown className="w-3.5 h-3.5 text-[#6b7280]" />
                          : <ChevronRight className="w-3.5 h-3.5 text-[#6b7280]" />}
                      </button>
                      {expandedCat === pa.category && (
                        <div className={`px-3 pb-2.5 pt-1 ${riskStyle.bg} border-t border-[#374151]`}>
                          <p className="text-[10px] text-[#d1d5db] leading-relaxed mb-1.5">
                            <span className="font-semibold text-[#f9fafb]">⚠ </span>{pa.precautions}
                          </p>
                          <p className="text-[10px] leading-relaxed">
                            <span className={`font-bold ${riskStyle.text}`}>→ Action: </span>
                            <span className="text-[#9ca3af]">{pa.action}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Nearby Facilities */}
              {adv.nearby_facilities.length > 0 && (
                <div className="px-4 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] mb-2 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />Nearby Facilities & Directives
                  </p>
                  <div className="space-y-2">
                    {adv.nearby_facilities.map((fac, i) => {
                      const typeEmoji: Record<string, string> = {
                        'School': '🏫', 'Hospital': '🏥',
                        'Old Age Home': '🏠', 'Public Park': '🌳', 'CAAQMS Station': '📡'
                      };
                      return (
                        <div key={i} className="bg-[#111827]/60 border border-[#374151] rounded px-3 py-2">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px]">{typeEmoji[fac.type] || '📍'}</span>
                              <span className="text-[11px] font-semibold text-[#e5e7eb]">{fac.name}</span>
                            </div>
                            <span className="text-[9px] text-[#6b7280] shrink-0">{fac.distance_km} km</span>
                          </div>
                          <p className={`text-[10px] leading-snug ${riskStyle.text}`}>{fac.directive}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notification Panel */}
              <div className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#6b7280] flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5" />Generate Notifications
                  </p>
                </div>

                {/* Channel selector */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {['sms','whatsapp','push','ivr','email_subject','display_board'].map(ch => (
                    <button
                      key={ch}
                      onClick={() => setNotifChannels(prev =>
                        prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]
                      )}
                      className={`px-2 py-0.5 rounded border text-[10px] transition-colors ${
                        notifChannels.includes(ch)
                          ? 'border-[#2563eb]/60 bg-[#2563eb]/10 text-[#93c5fd]'
                          : 'border-[#374151] text-[#6b7280] hover:text-[#9ca3af]'
                      }`}
                    >
                      {ch === 'email_subject' ? 'Email' : ch.toUpperCase().replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSendNotifications}
                  disabled={notifLoading || notifChannels.length === 0}
                  className="w-full flex items-center justify-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-50 text-white text-[12px] font-semibold px-4 py-2 rounded transition-colors"
                >
                  {notifLoading
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />Generating…</>
                    : <><Bell className="w-3.5 h-3.5" />Generate Templates</>
                  }
                </button>

                {/* Notification results */}
                {showNotifPanel && notifResult && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-[10px] text-[#4ade80]">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Templates generated for {notifResult.ward}</span>
                    </div>
                    {Object.entries(notifResult.notifications).map(([ch, text]) => (
                      <div key={ch} className="bg-[#111827] border border-[#374151] rounded p-2.5">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280]">
                            {ch.replace('_', ' ')}
                          </span>
                          <CopyButton text={text as string} label="Copy" />
                        </div>
                        <p className="text-[10px] text-[#d1d5db] leading-relaxed whitespace-pre-wrap break-words max-h-24 overflow-y-auto">
                          {text as string}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthAdvisoryPage;
