/**
 * Abstract Base / Interface for Blockchain Adapters
 * All chain adapters (Mock, EVM, BTC, etc.) must implement this contract.
 */
class IBlockchainAdapter {
  constructor(chain = 'ethereum') {
    this.chain = chain.toLowerCase();
  }

  /**
   * Get raw native transactions for an address
   * @param {string} address
   * @returns {Promise<Array<Object>>}
   */
  async getTransactions(address) {
    throw new Error('Method getTransactions() must be implemented by adapter subclass');
  }

  /**
   * Get raw ERC20 / SPL token transfers for an address
   * @param {string} address
   * @returns {Promise<Array<Object>>}
   */
  async getTokenTransfers(address) {
    throw new Error('Method getTokenTransfers() must be implemented by adapter subclass');
  }

  /**
   * Get native balance for an address
   * @param {string} address
   * @returns {Promise<Object>}
   */
  async getBalance(address) {
    throw new Error('Method getBalance() must be implemented by adapter subclass');
  }

  /**
   * Get block data by block number
   * @param {number|string} blockNumber
   * @returns {Promise<Object>}
   */
  async getBlock(blockNumber) {
    throw new Error('Method getBlock() must be implemented by adapter subclass');
  }
}

module.exports = IBlockchainAdapter;
