import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Map, Flame, PieChart, ShieldAlert,
  HeartPulse, FileBarChart, Settings, Wind, Database, MessageSquare,
  ChevronLeft, ChevronRight, X
} from 'lucide-react';
import { useConfig } from '../../context/ConfigContext';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS = [
  { label: 'Overview',           path: '/',                 icon: LayoutDashboard },
  { label: 'Forecast Map',       path: '/map',              icon: Map             },
  { label: 'Hotspots',           path: '/hotspots',         icon: Flame           },
  { label: 'Source Attribution', path: '/source-analysis',  icon: PieChart        },
  { label: 'Enforcement',        path: '/enforcement',      icon: ShieldAlert     },
  { label: 'Health Advisory',    path: '/health-advisory',  icon: HeartPulse      },
  { label: 'Data Pipeline',      path: '/data-pipeline',    icon: Database        },
  { label: 'Explainability',     path: '/explainability',   icon: Wind            },
  { label: 'Digital Twin',       path: '/digital-twin',     icon: Settings        },
  { label: 'AI Copilot',         path: '/copilot',          icon: MessageSquare   },
  { label: 'Reports',            path: '/reports',          icon: FileBarChart    },
  { label: 'Settings',           path: '/setup',            icon: Settings        },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile
}) => {
  const { config, metadata } = useConfig();

  return (
    <aside className={`
      ${collapsed ? 'w-16' : 'w-60'} 
      ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
      fixed md:static inset-y-0 left-0 z-50 flex flex-col h-full bg-[#1F2937] border-r border-[#374151] shrink-0 
      transition-all duration-300 ease-in-out
    `}>

      {/* Brand */}
      <div className="px-4 py-4 border-b border-[#374151] flex items-center justify-between">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-7 h-7 rounded bg-[#2563EB] flex items-center justify-center shrink-0">
            <Wind className="w-4 h-4 text-white" />
          </div>
          {!collapsed && (
            <div className="transition-opacity duration-200">
              <p className="text-[11px] font-700 text-white leading-tight tracking-wide whitespace-nowrap">
                Urban Air Quality
              </p>
              <p className="text-[9px] text-[#6B7280] font-500 tracking-wider uppercase whitespace-nowrap">
                Intelligence Platform
              </p>
            </div>
          )}
        </div>

        {/* Collapse controls */}
        <div className="flex items-center">
          {/* Desktop collapse */}
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="hidden md:flex items-center justify-center w-6 h-6 rounded hover:bg-[#374151] text-[#9CA3AF] hover:text-white transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          
          {/* Mobile close drawer */}
          <button
            onClick={onCloseMobile}
            title="Close menu"
            className="flex md:hidden items-center justify-center w-6 h-6 rounded hover:bg-[#374151] text-[#9CA3AF] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => (
          <NavLink
            key={path}
            to={path}
            end={path === '/'}
            onClick={() => onCloseMobile()} // Auto-close drawer on mobile link click
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-md text-[13px] font-500 transition-colors duration-150 relative group ${
                isActive
                  ? 'bg-[#1D4ED8]/20 text-[#93C5FD] border-l-2 border-[#2563EB] pl-[10px]'
                  : 'text-[#9CA3AF] hover:bg-[#374151]/50 hover:text-[#F9FAFB] border-l-2 border-transparent pl-[10px]'
              }`
            }
          >
            <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span className={`
              ${collapsed ? 'opacity-0 w-0 pointer-events-none' : 'opacity-100'} 
              transition-all duration-200 ml-1.5 whitespace-nowrap
            `}>
              {label}
            </span>
            
            {/* Tooltip for collapsed desktop menu */}
            {collapsed && (
              <span className="absolute left-16 bg-[#111827] border border-[#374151] text-white text-[10px] px-2 py-1 rounded shadow-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-[1000] whitespace-nowrap">
                {label}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Status Footer */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-[#374151]">
          <div className="bg-[#111827] rounded-md px-3 py-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[#6B7280] uppercase tracking-wider font-600">Active City</span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                <span className="text-[10px] text-[#16A34A] font-600">Online</span>
              </div>
            </div>
            <p className="text-[12px] text-[#F9FAFB] font-600">
              {metadata?.city_name || config?.city || '—'}
            </p>
            {config && (
              <div className="flex gap-2 text-[10px] text-[#6B7280]">
                <span className="bg-[#1F2937] px-1.5 py-0.5 rounded border border-[#374151]">
                  {config.resolution}
                </span>
                <span className="bg-[#1F2937] px-1.5 py-0.5 rounded border border-[#374151]">
                  {config.horizon === 'current' ? 'Live' : config.horizon}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};

export default Sidebar;
