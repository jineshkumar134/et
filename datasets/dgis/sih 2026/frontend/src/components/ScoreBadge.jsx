// src/components/ScoreBadge.jsx
// Displays a confidence band label with appropriate colour.
//
// Actual backend band values (from interpretation.level):
//   HIGH, MEDIUM, LOW, VERY_LOW, INSUFFICIENT_ATTRIBUTION_PATH, STRONG_ATTRIBUTION_PATH, etc.
// Also accepts numeric score as fallback.

export default function ScoreBadge({ score, band }) {
  // Normalise band to display label + colour
  const normBand = String(band || '').toUpperCase();

  let label, colorCls;

  if (normBand.includes('HIGH') || normBand.includes('STRONG')) {
    label    = 'HIGH';
    colorCls = 'bg-green-500/15 text-green-400 border-green-500/30';
  } else if (normBand.includes('MEDIUM') || normBand.includes('MODERATE')) {
    label    = 'MEDIUM';
    colorCls = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30';
  } else if (normBand.includes('LOW') || normBand.includes('WEAK') || normBand.includes('INSUFFICIENT')) {
    label    = 'LOW';
    colorCls = 'bg-red-500/15 text-red-400 border-red-500/30';
  } else if (score !== undefined && score !== null) {
    // Fallback: derive from numeric score
    const n = Number(score);
    if (n >= 75)      { label = 'HIGH';   colorCls = 'bg-green-500/15 text-green-400 border-green-500/30'; }
    else if (n >= 50) { label = 'MEDIUM'; colorCls = 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'; }
    else              { label = 'LOW';    colorCls = 'bg-red-500/15 text-red-400 border-red-500/30'; }
  } else {
    label    = 'UNKNOWN';
    colorCls = 'bg-gray-500/15 text-gray-400 border-gray-500/30';
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${colorCls}`}>
      {label}
      {score !== undefined && score !== null && (
        <span className="opacity-70">({score})</span>
      )}
    </span>
  );
}
