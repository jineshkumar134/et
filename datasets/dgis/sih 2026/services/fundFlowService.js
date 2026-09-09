const tracingService = require('./tracingService');
const FundFlowAnalyzer = require('../intelligence/fundflow/fundFlowAnalyzer');

class FundFlowService {
  /**
   * Performs multi-hop wallet tracing and analyzes fund-flow relationship intelligence
   * @param {Object} params - Tracing configuration options
   * @returns {Promise<Object>} Fund-Flow Analysis Result
   */
  async analyzeFundFlow({
    chain = 'ethereum',
    startAddress,
    maxDepth = 5,
    maxTransactions = 100,
    timeWindowHours = 24
  }) {
    if (!startAddress) {
      throw new Error('startAddress is required for fund-flow analysis');
    }

    // Step 1: Execute Phase 4 BFS Tracing
    const traceResult = await tracingService.traceWallet({
      chain,
      startAddress,
      maxDepth,
      maxTransactions,
      timeWindowHours
    });

    // Step 2: Analyze Fund-Flow Intelligence signals from trace result
    return FundFlowAnalyzer.analyzeTrace(traceResult);
  }

  /**
   * Analyzes fund-flow intelligence directly from an existing Phase 4 trace result
   * @param {Object} traceResult
   * @returns {Object} Fund-Flow Analysis Result
   */
  analyzeTraceResult(traceResult) {
    return FundFlowAnalyzer.analyzeTrace(traceResult);
  }
}

module.exports = new FundFlowService();
