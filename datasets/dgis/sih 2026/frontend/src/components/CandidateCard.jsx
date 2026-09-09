// src/components/CandidateCard.jsx
// Backend topCandidate shape (actual):
// {
//   rank, candidateId, chain, destinationAddress,
//   vasp: null,           ← NULL in demo (no VASP DB match)
//   overallScore, rawOverallScore,
//   interpretation: { level, label, description },
//   breakdown: { hopEfficiency, fundContinuity, timeProximity, attributionConfidence },
//   explanation: { summary, factors: [{ factor, result, score, explanation }] },
//   intelligenceConfidence, sourceType, isSynthetic
// }
import ScoreBadge from './ScoreBadge';
import { Building2, Link } from 'lucide-react';

function safeStr(val) {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function CandidateCard({ candidate, rank }) {
  if (!candidate) return null;

  const {
    vasp,
    overallScore,
    destinationAddress,
    breakdown = {},
    explanation = {},
    interpretation = {},
    intelligenceConfidence,
    sourceType,
  } = candidate;

  // vasp can be null (no match) or an object { name, vaspId, attributionType, ... }
  const vaspName   = vasp?.name     || 'Unknown Entity';
  const vaspId     = vasp?.vaspId   || destinationAddress?.slice(0, 14) + '…' || '—';
  const vaspType   = vasp?.attributionType || 'UNKNOWN';

  // Score band from interpretation.level
  const band       = interpretation?.level || null;
  const bandLabel  = interpretation?.label || null;

  return (
    <div className="rounded-xl border border-[#30363d] bg-[#1c2230] p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600/20 shrink-0">
            <Building2 className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <p className="font-semibold text-[#e6edf3]">
              {rank && <span className="text-[#8b949e] mr-1">#{rank}</span>}
              {vaspName}
            </p>
            <p className="text-xs text-[#8b949e]">{vaspId}</p>
          </div>
        </div>
        <ScoreBadge score={overallScore} band={band} />
      </div>

      {/* Attribution type + confidence */}
      <div className="flex gap-2 flex-wrap text-xs">
        <span className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[#8b949e]">
          Type: {vaspType}
        </span>
        <span className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[#8b949e]">
          Intel: {intelligenceConfidence ?? 0}%
        </span>
        <span className="rounded border border-[#30363d] bg-[#0d1117] px-2 py-0.5 text-[#8b949e]">
          Source: {sourceType || 'NONE'}
        </span>
      </div>

      {/* Score breakdown */}
      {Object.keys(breakdown).length > 0 && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            ['Hop Efficiency',    breakdown.hopEfficiency?.score],
            ['Fund Continuity',   breakdown.fundContinuity?.score],
            ['Time Proximity',    breakdown.timeProximity?.score],
            ['Attribution Conf.', breakdown.attributionConfidence?.score],
          ].map(([label, val]) => (
            <div key={label} className="rounded-lg bg-[#0d1117] border border-[#30363d] p-2">
              <p className="text-[#8b949e] mb-0.5">{label}</p>
              <p className="font-mono font-bold text-[#e6edf3]">{val ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* Explanation factors */}
      {explanation.factors?.length > 0 && (
        <div className="space-y-1 border-t border-[#30363d] pt-2 text-xs">
          {explanation.factors.map((f, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="text-blue-400 font-medium shrink-0">{f.factor}:</span>
              <span className="text-[#8b949e]">{f.result}</span>
            </div>
          ))}
        </div>
      )}

      {/* Band label */}
      {bandLabel && (
        <p className="text-xs text-[#8b949e] border-t border-[#30363d] pt-2">
          {interpretation.description || bandLabel}
        </p>
      )}

      {/* Address */}
      {destinationAddress && (
        <div className="flex items-center gap-2 text-xs text-[#8b949e]">
          <Link className="h-3 w-3 shrink-0" />
          <span className="font-mono truncate">{destinationAddress}</span>
        </div>
      )}
    </div>
  );
}
