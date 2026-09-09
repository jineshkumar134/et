/**
 * Constructs structured JSON-serializable Fund-Flow Analysis result object
 */
function createFlowResult({ startAddress, chain, relationships = [] }) {
  const normAddress = String(startAddress || '').toLowerCase();
  const normChain = String(chain || 'ethereum').toLowerCase();

  let fullMatches = 0;
  let partialMatches = 0;
  let weakMatches = 0;
  let noMatches = 0;
  let notComparable = 0;

  for (const rel of relationships) {
    switch (rel.relationship) {
      case 'FULL_FLOW_MATCH':
        fullMatches++;
        break;
      case 'PARTIAL_FLOW_MATCH':
        partialMatches++;
        break;
      case 'WEAK_FLOW_MATCH':
        weakMatches++;
        break;
      case 'NO_FLOW_MATCH':
        noMatches++;
        break;
      default:
        notComparable++;
        break;
    }
  }

  return {
    startAddress: normAddress,
    chain: normChain,
    relationships: relationships.map(r => ({ ...r })),
    summary: {
      relationshipsAnalyzed: relationships.length,
      fullMatches,
      partialMatches,
      weakMatches,
      noMatches,
      notComparable
    }
  };
}

module.exports = {
  createFlowResult
};
