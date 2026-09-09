// src/components/AuditTimeline.jsx
import { Clock } from 'lucide-react';

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString(); } catch { return ts; }
}

export default function AuditTimeline({ entries = [] }) {
  if (!entries.length) {
    return <p className="text-sm text-[#8b949e]">No audit entries available.</p>;
  }
  return (
    <ol className="relative border-l border-[#30363d] space-y-5 ml-3">
      {entries.map((entry, i) => (
        <li key={i} className="pl-6 relative">
          <span className="absolute -left-[9px] top-1 flex h-4 w-4 items-center justify-center rounded-full border border-blue-500/50 bg-blue-500/20">
            <Clock className="h-2.5 w-2.5 text-blue-400" />
          </span>
          <p className="text-sm font-medium text-[#e6edf3]">{entry.action || entry.stage || entry.event || 'Event'}</p>
          <p className="text-xs text-[#8b949e]">{fmt(entry.timestamp || entry.ts)}</p>
          {entry.detail && <p className="text-xs text-[#8b949e] mt-0.5">{entry.detail}</p>}
        </li>
      ))}
    </ol>
  );
}
