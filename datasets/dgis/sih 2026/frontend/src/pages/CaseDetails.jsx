// src/pages/CaseDetails.jsx
// Renders a full investigation case detail view.
// Data comes from:
//   - GET /api/v1/cases/:caseId/summary  (lightweight summary + topCandidate)
//   - GET /api/v1/investigations/:caseId (full result: candidates, fundFlow, tracing, provenance)
//   - GET /api/v1/cases/:caseId/graph    (nodes, edges, highlightedPath)
//   - GET /api/v1/cases/:caseId/evidence (evidence bundles, fingerprint)
//   - GET /api/v1/cases/:caseId/evidence/audit (audit trail)

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCaseSummary,
  getCaseGraph,
  getCaseEvidence,
  getCaseAudit,
  getFullInvestigation,
  exportJsonUrl,
  exportCsvUrl,
  exportGraphUrl,
  exportCandidatesUrl,
} from '../api/caseApi';
import { formatApiError } from '../api/client';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import ScoreBadge from '../components/ScoreBadge';
import CandidateCard from '../components/CandidateCard';
import FundFlowGraph from '../components/FundFlowGraph';
import AuditTimeline from '../components/AuditTimeline';
import { Download, Hash, Database, ClipboardList, BarChart2, GitBranch, Shield, ArrowLeft } from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────

function fmt(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleString('en-IN'); } catch { return String(ts); }
}

/** Safe string extraction from a value that could be null/object/primitive */
function safe(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

// ── Collapsible section ────────────────────────────────────────────────────

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-[#30363d] bg-[#161b22] overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-[#1c2230] transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-[#e6edf3]">
          {Icon && <Icon className="h-4 w-4 text-blue-400" />}
          {title}
        </div>
        <span className="text-[#8b949e] text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function CaseDetails() {
  const { caseId } = useParams();
  const navigate   = useNavigate();

  const [inv,     setInv]     = useState(null);   // full investigation result
  const [graph,   setGraph]   = useState(null);   // graph data
  const [evData,  setEvData]  = useState(null);   // evidence response
  const [audit,   setAudit]   = useState([]);     // audit trail entries
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);   // always string

  useEffect(() => {
    if (!caseId) return;
    setLoading(true);
    setError(null);

    Promise.all([
      getFullInvestigation(caseId),
      getCaseGraph(caseId),
      getCaseEvidence(caseId).catch(() => null),
      getCaseAudit(caseId).catch(() => null),
    ])
      .then(([invRes, graphRes, evRes, auditRes]) => {
        setInv(invRes);
        setGraph(graphRes);
        setEvData(evRes);
        setAudit(auditRes?.auditTrail || []);
      })
      .catch((e) => setError(formatApiError(e)))
      .finally(() => setLoading(false));
  }, [caseId]);

  if (loading) return <LoadingState message="Loading case data…" />;
  if (error)   return <ErrorState message={error} />;
  if (!inv)    return <ErrorState message="Case data not found." />;

  // ── Extract data from actual backend response shapes ──────────────────────
  const top       = inv.topCandidate || null;
  const cands     = inv.candidates   || [];
  const fund      = inv.fundFlow     || {};
  const prov      = inv.provenance   || {};
  const tracing   = inv.tracing      || {};
  const suspect   = inv.suspect      || {};

  // topCandidate.vasp is null in demo (no VASP DB match)
  // Name comes from destinationAddress or label
  const topVaspName = top?.vasp?.name
                   ?? top?.label
                   ?? top?.destinationAddress?.slice(0, 14) + '…'
                   ?? 'Unknown Entity';

  // Score/band from actual response shape
  const topScore = top?.overallScore ?? null;
  const topBand  = top?.interpretation?.level ?? top?.band ?? null;
  const topExpl  = top?.explanation?.summary ?? null;

  // Fund-flow: first relationship
  const rel0 = Array.isArray(fund.relationships) ? fund.relationships[0] : null;

  // Graph
  const graphNodes        = graph?.graph?.nodes        || [];
  const graphEdges        = graph?.graph?.edges        || [];
  const highlightedPath   = graph?.highlightedPath     || [];

  // Evidence
  const bundles = evData?.evidence || [];
  const ev0     = bundles[0] || null;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <h1 className="text-2xl font-bold text-[#e6edf3]">Case Details</h1>
          <p className="font-mono text-xs text-blue-400 mt-1">{caseId}</p>
        </div>

        {/* Export links */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'JSON Export',     url: exportJsonUrl(caseId) },
            { label: 'Transactions CSV', url: exportCsvUrl(caseId) },
            { label: 'Graph JSON',       url: exportGraphUrl(caseId) },
            { label: 'Candidates JSON',  url: exportCandidatesUrl(caseId) },
          ].map(({ label, url }) => (
            <a
              key={label}
              href={url}
              download
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#30363d] bg-[#1c2230] px-3 py-1.5 text-xs text-[#8b949e] hover:text-[#e6edf3] hover:border-blue-500/50 transition-colors"
            >
              <Download className="h-3 w-3" />
              {label}
            </a>
          ))}
        </div>
      </div>

      {/* Case metadata row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Status',    value: inv.status || '—', green: inv.status === 'COMPLETED' },
          { label: 'Chain',     value: (suspect.chain || inv.chain || '—').toUpperCase() },
          { label: 'Candidates', value: String(inv.candidateCount ?? cands.length) },
          { label: 'Data Mode', value: prov.dataMode || 'DEMO' },
        ].map(({ label, value, green }) => (
          <div key={label} className="rounded-xl border border-[#30363d] bg-[#161b22] p-3">
            <p className="text-xs text-[#8b949e] mb-1">{label}</p>
            <p className={`font-semibold text-sm ${green ? 'text-green-400' : 'text-[#e6edf3]'}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Suspect wallet */}
      <div className="rounded-xl border border-[#30363d] bg-[#161b22] p-4">
        <p className="text-xs text-[#8b949e] mb-1">Suspect Wallet</p>
        <p className="font-mono text-sm text-[#e6edf3] break-all">{suspect.address || '—'}</p>
      </div>

      {/* Top VASP Attribution Banner */}
      {top && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-5">
          <p className="text-xs text-blue-300 font-medium mb-2 flex items-center gap-1">
            <Shield className="h-3.5 w-3.5" /> TOP ATTRIBUTED VASP
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xl font-bold text-[#e6edf3]">{topVaspName}</p>
              <p className="text-xs text-[#8b949e] mt-0.5 font-mono">
                {top.destinationAddress || top.vasp?.vaspId || ''}
              </p>
            </div>
            {topScore !== null && <ScoreBadge score={topScore} band={topBand} />}
          </div>

          {/* Score breakdown factors */}
          {top.breakdown && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
              {[
                ['Hop Efficiency',      top.breakdown.hopEfficiency?.score],
                ['Fund Continuity',     top.breakdown.fundContinuity?.score],
                ['Time Proximity',      top.breakdown.timeProximity?.score],
                ['Attribution Conf.',   top.breakdown.attributionConfidence?.score],
              ].map(([label, val]) => (
                <div key={label} className="rounded-lg bg-blue-900/20 border border-blue-500/20 p-2 text-xs">
                  <p className="text-blue-300/70">{label}</p>
                  <p className="font-mono font-bold text-blue-200">{val ?? '—'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Explanation factors */}
          {top.explanation?.factors?.length > 0 && (
            <div className="mt-4 space-y-1.5 border-t border-blue-500/20 pt-3">
              <p className="text-xs text-blue-300 font-medium">Why this attribution?</p>
              {top.explanation.factors.map((f, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-blue-400 font-medium shrink-0">{f.factor}:</span>
                  <span className="text-blue-200/80">{f.result} — {f.explanation}</span>
                </div>
              ))}
            </div>
          )}

          {topExpl && (
            <p className="text-sm text-blue-200 mt-3 border-t border-blue-500/20 pt-3">{topExpl}</p>
          )}
        </div>
      )}

      {/* Fund Flow Summary */}
      {rel0 && (
        <Section title="Fund Flow Analysis" icon={BarChart2}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            {[
              ['Incoming Amount',  `${rel0.incomingAmount} ${rel0.asset || 'ETH'}`],
              ['Outgoing Amount',  `${rel0.outgoingAmount} ${rel0.asset || 'ETH'}`],
              ['Continuity',       `${Math.round((rel0.amountContinuity || 0) * 100)}%`],
              ['Time Difference',  `${rel0.timeDifferenceMinutes ?? '—'} min`],
              ['Relationship',     rel0.relationship || '—'],
              ['Data Source',      rel0.dataSource || '—'],
            ].map(([label, val]) => (
              <div key={label} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-3">
                <p className="text-xs text-[#8b949e] mb-1">{label}</p>
                <p className="font-mono text-sm text-[#e6edf3]">{val}</p>
              </div>
            ))}
          </div>

          {/* Trace path */}
          {tracing.visitedNodes?.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-[#8b949e] mb-2">Transaction Path</p>
              <div className="flex flex-wrap items-center gap-2">
                {tracing.visitedNodes.map((addr, i) => (
                  <span key={i} className="flex items-center gap-1">
                    <span className="font-mono text-xs bg-[#0d1117] border border-[#30363d] rounded px-2 py-1 text-[#e6edf3]">
                      {addr.slice(0, 8)}…{addr.slice(-4)}
                    </span>
                    {i < tracing.visitedNodes.length - 1 && (
                      <span className="text-blue-400 text-sm">→</span>
                    )}
                  </span>
                ))}
              </div>
              <p className="text-xs text-[#8b949e] mt-2">
                {tracing.totalPaths ?? '—'} path(s) · {tracing.processedTransactions ?? '—'} transactions
              </p>
            </div>
          )}
        </Section>
      )}

      {/* Graph */}
      <Section title="Transaction Fund-Flow Graph" icon={GitBranch}>
        <FundFlowGraph nodes={graphNodes} edges={graphEdges} highlightedPath={highlightedPath} />
      </Section>

      {/* Candidates */}
      {cands.length > 0 && (
        <Section title={`VASP Attribution Candidates (${cands.length})`} icon={ClipboardList}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            {cands.map((c, i) => (
              <CandidateCard key={i} candidate={c} rank={c.rank || i + 1} />
            ))}
          </div>
        </Section>
      )}

      {/* Evidence Bundle */}
      {ev0 && (
        <Section title="Evidence Bundle" icon={Database}>
          <div className="space-y-3 text-sm">
            {ev0.summary && <p className="text-[#8b949e]">{ev0.summary}</p>}

            {ev0.fingerprintHash && (
              <div className="flex items-start gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 p-3">
                <Hash className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-purple-300 mb-0.5">SHA-256 Evidence Fingerprint</p>
                  <p className="font-mono text-xs text-purple-200 break-all">{ev0.fingerprintHash}</p>
                </div>
              </div>
            )}

            {ev0.disclaimer && (
              <p className="text-xs text-yellow-400 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
                {ev0.disclaimer}
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                ['Analysis Version', ev0.analysisVersion],
                ['Is Synthetic',     String(ev0.isSynthetic)],
                ['Created At',       fmt(ev0.createdAt)],
              ].map(([label, val]) => val ? (
                <div key={label} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2">
                  <p className="text-[#8b949e] mb-0.5">{label}</p>
                  <p className="text-[#e6edf3]">{val}</p>
                </div>
              ) : null)}
            </div>
          </div>
        </Section>
      )}

      {/* Audit Trail */}
      {audit.length > 0 && (
        <Section title={`Audit Trail (${audit.length} entries)`} icon={ClipboardList} defaultOpen={false}>
          <AuditTimeline entries={audit} />
        </Section>
      )}

      {/* Provenance */}
      {Object.keys(prov).length > 0 && (
        <Section title="Data Provenance" icon={Database} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-3 text-xs">
            {[
              ['Blockchain Source',    prov.blockchainSource],
              ['Attribution Source',   prov.attributionSource],
              ['Data Mode',            prov.dataMode],
              ['Is Synthetic',         String(prov.isSynthetic)],
              ['Generated At',         fmt(prov.generatedAt)],
            ].map(([label, val]) => val ? (
              <div key={label} className="rounded-lg border border-[#30363d] bg-[#0d1117] p-2">
                <p className="text-[#8b949e] mb-0.5">{label}</p>
                <p className="text-[#e6edf3]">{val}</p>
              </div>
            ) : null)}
          </div>
        </Section>
      )}
    </div>
  );
}
