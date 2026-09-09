const config = require('../../config/config');
const MockBlockchainAdapter = require('./MockBlockchainAdapter');

const mockAdapterInstances = new Map();

/**
 * Returns blockchain adapter instance for specified chain.
 * Defaults to MockBlockchainAdapter when ENABLE_MOCK_BLOCKCHAIN is true.
 * @param {string} chain
 * @returns {IBlockchainAdapter}
 */
function getBlockchainAdapter(chain = 'ethereum') {
  const normalizedChain = String(chain || 'ethereum').toLowerCase();
  const apiKey = config.etherscanApiKey || process.env.ETHERSCAN_API_KEY;
  const isMockMode = config.dataSource === 'mock' || config.enableMockBlockchain || !apiKey;

  if (isMockMode) {
    if (!mockAdapterInstances.has(normalizedChain)) {
      mockAdapterInstances.set(normalizedChain, new MockBlockchainAdapter(normalizedChain));
    }
    return mockAdapterInstances.get(normalizedChain);
  }

  // REAL mode requested (DATA_SOURCE=real)
  if (!apiKey) {
    const err = new Error(`PROVIDER_NOT_CONFIGURED: Real blockchain provider for '${normalizedChain}' requested (DATA_SOURCE=real), but ETHERSCAN_API_KEY is not configured.`);
    err.statusCode = 503;
    err.code = 'PROVIDER_NOT_CONFIGURED';
    throw err;
  }

  if (!mockAdapterInstances.has(normalizedChain)) {
    mockAdapterInstances.set(normalizedChain, new MockBlockchainAdapter(normalizedChain));
  }
  return mockAdapterInstances.get(normalizedChain);
}

module.exports = {
  getBlockchainAdapter
};
