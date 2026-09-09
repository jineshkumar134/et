class TransactionRepositoryMemory {
  constructor() {
    this.store = new Map(); // key: chain:txHash
  }

  _makeKey(chain, txHash) {
    const c = String(chain || 'ETH').toUpperCase();
    const h = String(txHash || '').toLowerCase();
    return `${c}:${h}`;
  }

  async create(data) {
    const key = this._makeKey(data.chain, data.txHash);
    if (this.store.has(key)) {
      const err = new Error(`Duplicate key error: Transaction ${key} already exists`);
      err.code = 11000;
      throw err;
    }

    const record = {
      ...data,
      txHash: String(data.txHash).toLowerCase(),
      chain: String(data.chain || 'ETH').toUpperCase(),
      from: String(data.from).toLowerCase(),
      to: String(data.to).toLowerCase(),
      amount: String(data.amount),
      asset: data.asset || 'ETH',
      tokenContract: data.tokenContract || '',
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      blockNumber: data.blockNumber || 0,
      direction: data.direction || 'OUTGOING',
      metadata: data.metadata || {},
      createdAt: data.createdAt || new Date()
    };

    this.store.set(key, record);
    return { ...record };
  }

  async findByHash(chain, txHash) {
    const key = this._makeKey(chain, txHash);
    const record = this.store.get(key);
    return record ? { ...record } : null;
  }

  async findByAddress(chain, address, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    const limit = options.limit || 100;

    const results = [];
    for (const tx of this.store.values()) {
      if (
        tx.chain === normalizedChain &&
        (tx.from === normalizedAddress || tx.to === normalizedAddress)
      ) {
        results.push({ ...tx });
      }
    }

    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return results.slice(0, limit);
  }

  async findOutgoing(chain, fromAddress, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(fromAddress).toLowerCase();
    const limit = options.limit || 100;

    const results = [];
    for (const tx of this.store.values()) {
      if (tx.chain === normalizedChain && tx.from === normalizedAddress) {
        results.push({ ...tx });
      }
    }

    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return results.slice(0, limit);
  }

  async findIncoming(chain, toAddress, options = {}) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(toAddress).toLowerCase();
    const limit = options.limit || 100;

    const results = [];
    for (const tx of this.store.values()) {
      if (tx.chain === normalizedChain && tx.to === normalizedAddress) {
        results.push({ ...tx });
      }
    }

    results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return results.slice(0, limit);
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = TransactionRepositoryMemory;
