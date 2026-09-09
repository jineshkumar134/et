// src/components/Navbar.jsx
import { Shield, Activity, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getHealth } from '../api/investigationApi';

export default function Navbar() {
  const [apiStatus, setApiStatus] = useState('checking');

  useEffect(() => {
    getHealth()
      .then(() => setApiStatus('up'))
      .catch(() => setApiStatus('down'));
  }, []);

  return (
    <header className="sticky top-0 z-50 border-b border-[#30363d] bg-[#0d1117]/95 backdrop-blur">
      <div className="mx-auto max-w-screen-xl flex items-center justify-between px-4 py-3">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-[#e6edf3] leading-none">BIVAE</p>
            <p className="text-[10px] text-[#8b949e] leading-none mt-0.5">
              Blockchain Intelligence &amp; VASP Attribution Engine
            </p>
          </div>
        </Link>

        {/* Badges */}
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-500/40 bg-yellow-500/10 px-2.5 py-1 text-xs font-medium text-yellow-400">
            <AlertTriangle className="h-3 w-3" /> DEMO MODE
          </span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              apiStatus === 'up'
                ? 'border-green-500/40 bg-green-500/10 text-green-400'
                : apiStatus === 'down'
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-gray-500/40 bg-gray-500/10 text-gray-400'
            }`}
          >
            <Activity className="h-3 w-3" />
            API {apiStatus === 'checking' ? '…' : apiStatus === 'up' ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
