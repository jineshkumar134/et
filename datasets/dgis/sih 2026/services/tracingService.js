const blockchainService = require('./blockchainService');
const BFSTracer = require('../intelligence/tracing/bfsTracer');

class TracingService {
  /**
   * Executes multi-hop wallet tracing for a starting suspect address
   * @param {Object} params
   * @param {string} params.chain - Blockchain network (e.g. 'ethereum')
   * @param {string} params.startAddress - Target suspect wallet address
   * @param {number} [params.maxDepth=5] - Maximum search depth
   * @param {number} [params.maxTransactions=100] - Maximum transactions limit
   * @param {number} [params.timeWindowHours=24] - Search time window in hours
   * @returns {Promise<Object>} Structured Trace Result
   */
  async traceWallet({
    chain = 'ethereum',
    startAddress,
    maxDepth = 5,
    maxTransactions = 100,
    timeWindowHours = 24
  }) {
    if (!startAddress) {
      throw new Error('startAddress is required for tracing');
    }

    // Define transaction fetcher linking TracingService to BlockchainService
    const fetchTransactions = async (c, addr) => {
      return await blockchainService.getNormalizedTransactions(c, addr);
    };

    return await BFSTracer.trace({
      chain,
      startAddress,
      maxDepth,
      maxTransactions,
      timeWindowHours,
      fetchTransactions
    });
  }
}

module.exports = new TracingService();
