// src/pages/Cases.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionCases } from '../api/investigationApi';
import { formatApiError } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import ScoreBadge from '../components/ScoreBadge';
import { ChevronRight, RefreshCw, Search } from 'lucide-react';

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN'); } catch { return String(ts); }
}

// Safe string extraction for VASP name (backend topCandidate.vasp is null or object or string)
function vaspName(topCandidate) {
  if (!topCandidate) return '—';
  const v = topCandidate.vasp;
  if (!v) return topCandidate.label || topCandidate.destinationAddress?.slice(0, 10) + '…' || '—';
  if (typeof v === 'string') return v;
  return v.name || v.vaspId || '—';
}

export default function Cases() {
  const [cases,   setCases]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError(null);
    try {
      setCases(getSessionCases());
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState message="Loading cases…" />;
  if (error)   return <ErrorState message={error} />;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">All Cases</h1>
          <p className="text-sm text-[#8b949e] mt-1">{cases.length} investigation(s) in this session.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="flex items-center gap-1.5 rounded-lg border border-[#30363d] px-3 py-2 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
          <button onClick={() => navigate('/investigate')} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs text-white hover:bg-blue-500 transition-colors">
            <Search className="h-3.5 w-3.5" /> New
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
        {cases.length === 0 ? (
          <div className="px-5 py-16 text-center space-y-2">
            <p className="text-[#8b949e] text-sm">No investigations found in this session.</p>
            <p className="text-[#484f58] text-xs">Start a new investigation to see results here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e] text-left text-xs">
                  <th className="px-5 py-3 font-medium">Case ID</th>
                  <th className="px-5 py-3 font-medium">Suspect Wallet</th>
                  <th className="px-5 py-3 font-medium">Top VASP</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const score  = c.topCandidate?.overallScore ?? c.topCandidate?.score ?? null;
                  const band   = c.topCandidate?.band ?? c.topCandidate?.interpretation?.level ?? null;
                  const wallet = c.suspect?.address
                              ?? (Array.isArray(c.targetWallets) ? c.targetWallets[0] : null)
                              ?? '—';
                  return (
                    <tr
                      key={c.caseId}
                      onClick={() => navigate(`/cases/${c.caseId}`)}
                      className="border-b border-[#30363d] hover:bg-[#1c2230] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-blue-400">{c.caseId}</td>
                      <td className="px-5 py-3 font-mono text-xs text-[#8b949e] max-w-[140px] truncate">{String(wallet)}</td>
                      <td className="px-5 py-3 text-[#e6edf3] text-xs max-w-[160px] truncate">{vaspName(c.topCandidate)}</td>
                      <td className="px-5 py-3">
                        {score !== null ? <ScoreBadge score={score} band={band} /> : <span className="text-[#484f58] text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${
                          c.status === 'COMPLETED' ? 'text-green-400' :
                          c.status === 'FAILED'    ? 'text-red-400'   : 'text-yellow-400'
                        }`}>{c.status || '—'}</span>
                      </td>
                      <td className="px-5 py-3 text-[#8b949e] text-xs">{fmt(c.createdAt)}</td>
                      <td className="px-5 py-3"><ChevronRight className="h-4 w-4 text-[#8b949e]" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
