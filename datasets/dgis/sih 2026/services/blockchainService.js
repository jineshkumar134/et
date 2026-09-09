const { getBlockchainAdapter } = require('../adapters/blockchain/adapterFactory');
const { normalizeTransaction } = require('../normalization/transactionNormalizer');

class BlockchainService {
  /**
   * Retrieves and normalizes native transactions and token transfers for a target wallet address
   * @param {string} chain - Blockchain network identifier (e.g., 'ethereum')
   * @param {string} address - Target wallet address
   * @returns {Promise<Array<Object>>} Normalized transactions array
   */
  async getNormalizedTransactions(chain, address) {
    if (!address) {
      throw new Error('Wallet address is required to fetch transactions');
    }

    const adapter = getBlockchainAdapter(chain);
    const normalizedAddress = String(address).trim().toLowerCase();

    // Fetch raw transactions and token transfers from adapter
    const [rawTxs, rawTokenTransfers] = await Promise.all([
      adapter.getTransactions(normalizedAddress),
      adapter.getTokenTransfers(normalizedAddress)
    ]);

    const allRaw = [...rawTxs, ...rawTokenTransfers];

    // Normalize each transaction with direction relative to target address
    const normalizedList = allRaw.map((rawTx) => normalizeTransaction(rawTx, normalizedAddress));

    // Sort by timestamp descending
    normalizedList.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    return normalizedList;
  }

  /**
   * Gets native balance for address
   */
  async getBalance(chain, address) {
    const adapter = getBlockchainAdapter(chain);
    return await adapter.getBalance(address);
  }

  /**
   * Gets block data by number
   */
  async getBlock(chain, blockNumber) {
    const adapter = getBlockchainAdapter(chain);
    return await adapter.getBlock(blockNumber);
  }
}

module.exports = new BlockchainService();
