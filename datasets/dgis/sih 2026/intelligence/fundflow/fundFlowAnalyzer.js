const FlowMatcher = require('./flowMatcher');
const { createFlowResult } = require('./flowResult');

class FundFlowAnalyzer {
  /**
   * Analyzes fund-flow intelligence and relationship signals across Phase 4 trace results
   * @param {Object} traceResult - Output from Phase 4 BFS Tracer
   * @returns {Object} Structured Fund-Flow Analysis Result
   */
  static analyzeTrace(traceResult) {
    if (!traceResult || typeof traceResult !== 'object') {
      throw new Error('Invalid traceResult provided to FundFlowAnalyzer');
    }

    const startAddress = String(traceResult.startAddress || '').toLowerCase();
    const chain = String(traceResult.chain || 'ethereum').toLowerCase();

    const edges = traceResult.graph?.edges || [];

    // Map incoming and outgoing edges for each wallet node
    const incomingEdgesMap = new Map();
    const outgoingEdgesMap = new Map();
    const allWalletsSet = new Set();

    for (const edge of edges) {
      if (!edge || !edge.from || !edge.to) continue;

      const fromAddr = String(edge.from).toLowerCase();
      const toAddr = String(edge.to).toLowerCase();

      allWalletsSet.add(fromAddr);
      allWalletsSet.add(toAddr);

      if (!outgoingEdgesMap.has(fromAddr)) outgoingEdgesMap.set(fromAddr, []);
      outgoingEdgesMap.get(fromAddr).push(edge);

      if (!incomingEdgesMap.has(toAddr)) incomingEdgesMap.set(toAddr, []);
      incomingEdgesMap.get(toAddr).push(edge);
    }

    // Also collect wallets from paths if available
    if (Array.isArray(traceResult.paths)) {
      for (const p of traceResult.paths) {
        if (Array.isArray(p.nodes)) {
          for (const n of p.nodes) {
            allWalletsSet.add(String(n).toLowerCase());
          }
        }
      }
    }

    const relationships = [];
    const processedPairs = new Set(); // key: incTxHash:outTxHash:wallet

    // Identify intermediate wallet nodes (nodes that have both incoming and outgoing edges)
    for (const walletAddr of allWalletsSet) {
      const incList = incomingEdgesMap.get(walletAddr) || [];
      const outList = outgoingEdgesMap.get(walletAddr) || [];

      if (incList.length === 0 || outList.length === 0) {
        continue;
      }

      // For each outgoing transaction from this intermediate wallet
      for (const outTx of outList) {
        // Find best matching incoming transaction to this wallet
        let bestMatch = null;
        let bestScore = -1;

        for (const incTx of incList) {
          const pairKey = `${incTx.txHash}:${outTx.txHash}:${walletAddr}`;
          if (processedPairs.has(pairKey)) continue;

          const match = FlowMatcher.matchFlow(incTx, outTx, walletAddr);
          if (!match) continue;

          // Ranking score: prefer asset match, valid ordering, higher proximity score & continuity
          let rankScore = 0;
          if (match.assetMatch) rankScore += 100;
          if (match.validOrdering) rankScore += 50;
          rankScore += match.timeProximityScore * 10;
          if (match.relationship === 'FULL_FLOW_MATCH') rankScore += 20;
          if (match.relationship === 'PARTIAL_FLOW_MATCH') rankScore += 10;

          if (rankScore > bestScore) {
            bestScore = rankScore;
            bestMatch = { match, pairKey };
          }
        }

        if (bestMatch && bestMatch.match) {
          processedPairs.add(bestMatch.pairKey);
          relationships.push(bestMatch.match);
        }
      }
    }

    // Sort relationships deterministically by intermediate wallet then timestamp
    relationships.sort((a, b) => {
      const wComp = a.wallet.localeCompare(b.wallet);
      if (wComp !== 0) return wComp;
      return new Date(a.outgoingTimestamp) - new Date(b.outgoingTimestamp);
    });

    return createFlowResult({
      startAddress,
      chain,
      relationships
    });
  }
}

module.exports = FundFlowAnalyzer;
