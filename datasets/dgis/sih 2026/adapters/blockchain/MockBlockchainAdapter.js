const IBlockchainAdapter = require('./IBlockchainAdapter');

/**
 * Deterministic Mock Blockchain Adapter
 * Returns synthetic mock transaction graphs for testing without live APIs.
 */
class MockBlockchainAdapter extends IBlockchainAdapter {
  constructor(chain = 'ethereum') {
    super(chain);

    // Deterministic synthetic transactions dataset
    this.syntheticTransactions = [
      {
        txHash: '0xtest001',
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        value: '10',
        amount: '10',
        asset: 'ETH',
        tokenContract: null,
        timestamp: '2026-09-07T10:00:00Z',
        blockNumber: 100,
        chain: 'ethereum',
        dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
        isSynthetic: true,
        metadata: { memo: 'Initial synthetic transfer' }
      },
      {
        txHash: '0xtest002',
        from: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        to: '0x1111111111111111111111111111111111111111',
        value: '8',
        amount: '8',
        asset: 'ETH',
        tokenContract: null,
        timestamp: '2026-09-07T10:07:00Z',
        blockNumber: 101,
        chain: 'ethereum',
        dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
        isSynthetic: true,
        metadata: { memo: 'Deposit to Exchange Demo A' }
      }
    ];

    // Synthetic token transfers dataset
    this.syntheticTokenTransfers = [
      {
        txHash: '0xtest_usdt_001',
        from: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        to: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
        tokenContract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
        tokenSymbol: 'USDT',
        tokenDecimals: 6,
        tokenAmount: '150000000',
        timestamp: '2026-09-07T09:30:00Z',
        blockNumber: 99,
        chain: 'ethereum',
        dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
        isSynthetic: true
      }
    ];
  }

  async getTransactions(address) {
    const normalized = String(address || '').toLowerCase();
    return this.syntheticTransactions.filter(
      (tx) => tx.from.toLowerCase() === normalized || tx.to.toLowerCase() === normalized
    );
  }

  async getTokenTransfers(address) {
    const normalized = String(address || '').toLowerCase();
    return this.syntheticTokenTransfers.filter(
      (tx) => tx.from.toLowerCase() === normalized || tx.to.toLowerCase() === normalized
    );
  }

  async getBalance(address) {
    const normalized = String(address || '').toLowerCase();
    const mockBalances = {
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa': '5.0',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb': '2.0',
      '0x1111111111111111111111111111111111111111': '8.0'
    };

    return {
      address: normalized,
      balance: mockBalances[normalized] || '0.0',
      asset: 'ETH',
      chain: this.chain,
      dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
      isSynthetic: true
    };
  }

  async getBlock(blockNumber) {
    const bn = Number(blockNumber);
    return {
      chain: this.chain,
      blockNumber: bn,
      hash: `0xblock${bn}`,
      timestamp: bn === 100 ? '2026-09-07T10:00:00Z' : '2026-09-07T10:07:00Z',
      txCount: 1,
      dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
      isSynthetic: true
    };
  }
}

module.exports = MockBlockchainAdapter;
