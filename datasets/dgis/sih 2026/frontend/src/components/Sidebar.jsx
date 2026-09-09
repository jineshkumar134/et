// src/components/Sidebar.jsx
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Search, FolderOpen, Globe } from 'lucide-react';

const links = [
  { to: '/',              label: 'Dashboard',        Icon: LayoutDashboard },
  { to: '/investigate',   label: 'New Investigation', Icon: Search },
  { to: '/cases',         label: 'Cases',             Icon: FolderOpen },
  { to: '/sahyog',        label: 'SAHYOG Sandbox',    Icon: Globe },
];

export default function Sidebar() {
  return (
    <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-[#30363d] bg-[#161b22] min-h-screen pt-6 pb-10 px-3">
      <nav className="space-y-1">
        {links.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400 font-medium'
                  : 'text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#1c2230]'
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 px-3">
        <p className="text-[10px] text-[#484f58] leading-snug">
          SIH 2026 · BIVAE v1.0
          <br />SANDBOX MODE — NOT for production
        </p>
      </div>
    </aside>
  );
}
