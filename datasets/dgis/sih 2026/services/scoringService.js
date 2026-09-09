const tracingService = require('./tracingService');
const fundFlowService = require('./fundFlowService');
const attributionService = require('./attributionService');
const { scoreCandidate } = require('../intelligence/scoring/scorer');
const { rankCandidates } = require('../intelligence/scoring/ranker');

class ScoringService {
  /**
   * Executes the full BIVAE investigation pipeline:
   * Phase 4 (BFS Tracing) -> Phase 5 (Fund-Flow Analysis) -> Phase 6 (VASP Attribution) -> Phase 7 (Scoring & Ranking)
   * 
   * @param {Object} options
   * @param {string} options.chain - Blockchain network (e.g. 'ethereum')
   * @param {string} options.startAddress - Target suspect wallet address
   * @param {number} [options.maxDepth=5] - Maximum BFS search depth
   * @returns {Promise<Object>} Ranked candidates with explainable score breakdowns
   */
  async analyzeAndScore(options = {}) {
    const { chain = 'ethereum', startAddress, maxDepth = 5 } = options;

    if (!startAddress) {
      throw new Error('startAddress is required for scoring');
    }

    const normStart = String(startAddress).trim().toLowerCase();

    // Step 1: Execute Phase 4 BFS Tracing
    const traceResult = await tracingService.traceWallet({
      chain,
      startAddress: normStart,
      maxDepth
    });

    // Step 2: Execute Phase 5 Fund Flow Analysis
    const fundFlowResult = fundFlowService.analyzeTraceResult(traceResult);
    const relationships = fundFlowResult.relationships || [];

    // Map relationships for fast lookup by intermediate node or destination node
    const relMap = new Map();
    for (const rel of relationships) {
      if (rel.wallet) relMap.set(rel.wallet.toLowerCase(), rel);
    }

    const visitedNodes = traceResult.visitedNodes || [];
    const depthMap = traceResult.depthMap || {};
    const candidatesMap = new Map();

    // Step 3 & 4: Evaluate every discovered destination node for Phase 6 Attribution & Phase 7 Scoring
    for (const node of visitedNodes) {
      const normNode = String(node).trim().toLowerCase();
      if (normNode === normStart) continue; // Skip starting suspect wallet

      // Phase 6: Attribution
      const attrResult = await attributionService.attributeWallet(chain, normNode);

      // Extract hop depth
      const hopCount = depthMap[normNode] !== undefined ? depthMap[normNode] : 2;

      // Extract fund flow metrics from matching relationship if present
      const rel = relMap.get(normNode) || relationships[0] || {};
      const amountContinuity = rel.amountContinuity !== undefined ? rel.amountContinuity : 0.8;
      const timeProximityScore = rel.timeProximityScore !== undefined ? rel.timeProximityScore : 0.95;
      const timeDifferenceMinutes = rel.timeDifferenceMinutes !== undefined ? rel.timeDifferenceMinutes : 7;
      const intelligenceConfidence = attrResult.intelligenceConfidence !== undefined ? attrResult.intelligenceConfidence : 0;

      // Phase 7: Score Candidate
      const scored = scoreCandidate({
        hopCount,
        amountContinuity,
        timeProximityScore,
        timeDifferenceMinutes,
        intelligenceConfidence,
        vasp: attrResult.vasp ? {
          name: attrResult.entityName || attrResult.vasp.name,
          vaspId: attrResult.vasp.vaspId,
          type: attrResult.vasp.type || 'CEX',
          walletType: attrResult.vasp.walletType || 'DEPOSIT_WALLET',
          attributionType: attrResult.vasp.attributionType || 'DIRECT',
          intelligenceConfidence,
          sourceType: attrResult.sourceType || 'SYNTHETIC_DEMO'
        } : (attrResult.entityName ? { name: attrResult.entityName, vaspId: null, type: 'CEX', walletType: 'UNKNOWN', attributionType: 'DIRECT', intelligenceConfidence, sourceType: 'SYNTHETIC_DEMO' } : null),
        chain,
        destinationAddress: normNode,
        sourceType: attrResult.sourceType || 'SYNTHETIC_DEMO',
        isSynthetic: attrResult.isSynthetic !== undefined ? attrResult.isSynthetic : true
      });

      candidatesMap.set(normNode, scored);
    }

    // Fallback if no target nodes found besides startAddress
    if (candidatesMap.size === 0) {
      const directAttr = await attributionService.attributeWallet(chain, normStart);
      const scoredDirect = scoreCandidate({
        hopCount: 1,
        amountContinuity: 1.0,
        timeProximityScore: 1.0,
        timeDifferenceMinutes: 0,
        intelligenceConfidence: directAttr.intelligenceConfidence || 0,
        vasp: directAttr.vasp ? {
          name: directAttr.entityName || directAttr.vasp.name,
          type: directAttr.vasp.type || 'CEX',
          walletType: directAttr.vasp.walletType || 'DEPOSIT_WALLET',
          attributionType: directAttr.vasp.attributionType || 'DIRECT'
        } : null,
        chain,
        destinationAddress: normStart,
        sourceType: directAttr.sourceType || 'SYNTHETIC_DEMO',
        isSynthetic: directAttr.isSynthetic !== undefined ? directAttr.isSynthetic : true
      });
      candidatesMap.set(normStart, scoredDirect);
    }

    const unrankedList = Array.from(candidatesMap.values());
    const rankedCandidates = rankCandidates(unrankedList);

    const topCand = rankedCandidates[0] || null;

    return {
      chain: String(chain).toLowerCase(),
      startAddress: normStart,
      totalCandidates: rankedCandidates.length,
      topCandidate: topCand,
      candidates: rankedCandidates,
      pipeline: {
        tracingCompleted: true,
        fundFlowCompleted: true,
        attributionCompleted: true,
        scoringCompleted: true
      },
      sourceType: topCand?.sourceType || 'SYNTHETIC_DEMO',
      isSynthetic: topCand?.isSynthetic !== undefined ? topCand.isSynthetic : true,
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = new ScoringService();
