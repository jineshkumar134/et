/**
 * Ranks candidate VASP attribution results deterministically.
 * Order:
 * 1. overallScore DESC
 * 2. intelligenceConfidence DESC
 * 3. hopCount ASC (shorter path first)
 * 4. destinationAddress / entityName ASC (deterministic string tie-breaker)
 * 
 * @param {Array<Object>} candidates - List of scored candidate objects
 * @returns {Array<Object>} Ranked candidates array with rank property added
 */
function rankCandidates(candidates = []) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return [];
  }

  // Clone candidates array so we don't mutate original objects unpredictably
  const sorted = candidates.map(c => ({ ...c })).sort((a, b) => {
    // 1. overallScore DESC
    const scoreA = a.overallScore || 0;
    const scoreB = b.overallScore || 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }

    // 2. intelligenceConfidence DESC
    const confA = a.intelligenceConfidence || 0;
    const confB = b.intelligenceConfidence || 0;
    if (confB !== confA) {
      return confB - confA;
    }

    // 3. hopCount ASC (fewer hops preferred)
    const hopsA = a.breakdown?.hopEfficiency?.score !== undefined ? (100 - a.breakdown.hopEfficiency.score) : 999;
    const hopsB = b.breakdown?.hopEfficiency?.score !== undefined ? (100 - b.breakdown.hopEfficiency.score) : 999;
    if (hopsA !== hopsB) {
      return hopsA - hopsB;
    }

    // 4. Deterministic string tie-breaker: destinationAddress ASC or entityName ASC
    const addrA = String(a.destinationAddress || a.vasp?.name || '').toLowerCase();
    const addrB = String(b.destinationAddress || b.vasp?.name || '').toLowerCase();
    return addrA.localeCompare(addrB);
  });

  return sorted.map((candidate, index) => ({
    rank: index + 1,
    ...candidate
  }));
}

module.exports = {
  rankCandidates
};
