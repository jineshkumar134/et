import React from 'react';
import { useConfig } from '../../context/ConfigContext';
import { Wind, Menu } from 'lucide-react';

interface TopBarProps {
  onToggleMobileSidebar: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onToggleMobileSidebar }) => {
  const { config, metadata } = useConfig();

  const cityName    = metadata?.city_name || config?.city || '—';
  const horizon     = config?.horizon === 'current' ? 'Live' : (config?.horizon || '—');
  const stations    = (metadata as any)?.monitoring_stations ?? '—';
  const lastUpdated = metadata?.last_updated
    ? new Date(metadata.last_updated).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—';

  return (
    <header className="h-[52px] bg-[#1F2937] border-b border-[#374151] flex items-center justify-between px-4 md:px-6 shrink-0">

      {/* Left: Hamburger (mobile) + Platform title */}
      <div className="flex items-center gap-3">
        {/* Mobile hamburger — hidden on md+ screens */}
        <button
          onClick={onToggleMobileSidebar}
          className="flex md:hidden items-center justify-center w-8 h-8 rounded hover:bg-[#374151] text-[#9CA3AF] hover:text-white transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <Wind className="w-4 h-4 text-[#2563EB]" strokeWidth={1.75} />
          <span className="text-[13px] font-600 text-[#F9FAFB] tracking-wide">
            Urban Air Quality Intelligence Platform
          </span>
          <span className="text-[11px] text-[#4B5563] font-400 ml-1 hidden lg:block">
            · AI-powered Decision Support System
          </span>
        </div>
      </div>

      {/* Right: Status chips — hide some on mobile */}
      <div className="flex items-center gap-1 text-[11px]">
        <Chip label="City" value={cityName} />
        <Divider />
        <div className="hidden sm:flex items-center gap-1">
          <Chip label="Forecast" value={horizon} />
          <Divider />
          <Chip label="Stations" value={String(stations)} />
          <Divider />
          <Chip label="Updated" value={lastUpdated} />
          <Divider />
        </div>
        {/* System status — always visible */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111827] border border-[#374151]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
          <span className="text-[#16A34A] font-600">Online</span>
        </div>
      </div>
    </header>
  );
};

const Chip: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#111827] border border-[#374151]">
    <span className="text-[#6B7280] font-500">{label}</span>
    <span className="text-[#F9FAFB] font-600">{value}</span>
  </div>
);

const Divider: React.FC = () => (
  <span className="w-px h-4 bg-[#374151] mx-0.5" />
);

export default TopBar;
