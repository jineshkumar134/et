// src/pages/Dashboard.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSessionCases } from '../api/investigationApi';
import { getFullInvestigation } from '../api/caseApi';
import { formatApiError } from '../api/client';
import StatCard from '../components/StatCard';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import ScoreBadge from '../components/ScoreBadge';
import { Search, ChevronRight, RefreshCw } from 'lucide-react';

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN'); } catch { return String(ts); }
}

export default function Dashboard() {
  const [cases,   setCases]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // Backend has no list endpoint — read session-stored cases
      const sessionCases = getSessionCases();
      setCases(sessionCases);
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <LoadingState message="Loading dashboard…" />;
  if (error)   return <ErrorState message={error} />;

  const total     = cases.length;
  const completed = cases.filter((c) => c.status === 'COMPLETED').length;
  const highConf  = cases.filter((c) => {
    const score = c.topCandidate?.overallScore ?? c.topCandidate?.score ?? 0;
    return score >= 75;
  }).length;

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Dashboard</h1>
          <p className="text-sm text-[#8b949e] mt-1">Blockchain intelligence investigation overview</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 rounded-lg border border-[#30363d] px-3 py-2 text-xs text-[#8b949e] hover:text-[#e6edf3] transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Investigations" value={total}     color="blue" />
        <StatCard label="Completed"            value={completed} color="green" />
        <StatCard label="High Confidence"      value={highConf}  color="purple" />
        <StatCard label="Data Mode"            value="DEMO"      color="orange" sub="Synthetic only" />
      </div>

      {/* CTA */}
      <button
        onClick={() => navigate('/investigate')}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-500 transition-colors"
      >
        <Search className="h-4 w-4" /> New Investigation
      </button>

      {/* Cases table */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#30363d]">
          <h2 className="font-semibold text-[#e6edf3]">Recent Investigations</h2>
        </div>
        {cases.length === 0 ? (
          <div className="px-5 py-16 text-center space-y-2">
            <p className="text-[#8b949e] text-sm">No investigations yet.</p>
            <p className="text-[#484f58] text-xs">
              Start a new investigation to begin blockchain analysis.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#30363d] text-[#8b949e] text-left text-xs">
                  <th className="px-5 py-3 font-medium">Case ID</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Top VASP</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Created</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {cases.map((c) => {
                  const caseId = c.caseId;
                  // topCandidate can be lightweight summary or full object
                  const score  = c.topCandidate?.overallScore ?? c.topCandidate?.score ?? null;
                  const band   = c.topCandidate?.band ?? c.topCandidate?.interpretation?.level ?? null;
                  const vasp   = c.topCandidate?.vasp?.name
                              ?? c.topCandidate?.vasp
                              ?? c.topCandidate?.label
                              ?? '—';
                  return (
                    <tr
                      key={caseId}
                      onClick={() => navigate(`/cases/${caseId}`)}
                      className="border-b border-[#30363d] hover:bg-[#1c2230] cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 font-mono text-xs text-blue-400">{caseId}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-medium ${
                          c.status === 'COMPLETED' ? 'text-green-400' :
                          c.status === 'FAILED'    ? 'text-red-400'   : 'text-yellow-400'
                        }`}>
                          {c.status || '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-[#e6edf3] text-xs max-w-[180px] truncate">{String(vasp)}</td>
                      <td className="px-5 py-3">
                        {score !== null ? <ScoreBadge score={score} band={band} /> : <span className="text-[#484f58] text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3 text-[#8b949e] text-xs">{fmt(c.createdAt)}</td>
                      <td className="px-5 py-3">
                        <ChevronRight className="h-4 w-4 text-[#8b949e]" />
                      </td>
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
