class WalletIntelligenceRepositoryMemory {
  constructor() {
    this.store = new Map(); // key: chain:address
  }

  _makeKey(chain, address) {
    let c = String(chain || 'ETH').toUpperCase().trim();
    if (c === 'ETHEREUM') c = 'ETH';
    if (c === 'BITCOIN') c = 'BTC';
    const a = String(address || '').toLowerCase().trim();
    return `${c}:${a}`;
  }

  async create(data) {
    const key = this._makeKey(data.chain, data.address);
    if (this.store.has(key)) {
      const err = new Error(`Duplicate key error: WalletIntelligence ${key} already exists`);
      err.code = 11000;
      throw err;
    }

    let chainNorm = String(data.chain || 'ETH').toUpperCase().trim();
    if (chainNorm === 'ETHEREUM') chainNorm = 'ETH';

    const record = {
      ...data,
      address: String(data.address).toLowerCase().trim(),
      chain: chainNorm,
      entityName: data.entityName || '',
      walletType: data.walletType || 'UNKNOWN',
      entityType: data.entityType || 'UNKNOWN',
      clusterId: data.clusterId || '',
      confidence: data.confidence !== undefined ? data.confidence : 0,
      sourceType: data.sourceType || 'SYNTHETIC_DEMO',
      isSynthetic: data.isSynthetic !== undefined ? data.isSynthetic : true,
      tags: data.tags || [],
      metadata: data.metadata || {},
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    };

    this.store.set(key, record);
    return { ...record };
  }

  async findByAddress(address) {
    const normalized = String(address).toLowerCase().trim();
    for (const record of this.store.values()) {
      if (record.address === normalized) {
        return { ...record };
      }
    }
    return null;
  }

  async findByChainAndAddress(chain, address) {
    const key = this._makeKey(chain, address);
    const record = this.store.get(key);
    if (record) return { ...record };
    return await this.findByAddress(address);
  }

  async findAll(filter = {}, options = {}) {
    let items = Array.from(this.store.values());

    if (filter.entityType) {
      items = items.filter((i) => i.entityType === filter.entityType);
    }
    if (filter.walletType) {
      items = items.filter((i) => i.walletType === filter.walletType);
    }

    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const limit = options.limit || 100;
    return items.slice(0, limit).map((i) => ({ ...i }));
  }

  async findByEntityType(entityType) {
    return Array.from(this.store.values())
      .filter((i) => i.entityType === entityType)
      .map((i) => ({ ...i }));
  }

  async findByCluster(clusterId) {
    if (!clusterId) return [];
    return Array.from(this.store.values())
      .filter((i) => i.clusterId === clusterId)
      .map((i) => ({ ...i }));
  }

  async search(query = {}, options = {}) {
    let items = Array.from(this.store.values());

    if (query.entityName) {
      const q = String(query.entityName).toLowerCase();
      items = items.filter((i) => i.entityName.toLowerCase().includes(q));
    }
    if (query.entityType) {
      items = items.filter((i) => i.entityType === query.entityType);
    }
    if (query.walletType) {
      items = items.filter((i) => i.walletType === query.walletType);
    }
    if (query.clusterId) {
      items = items.filter((i) => i.clusterId === query.clusterId);
    }

    const limit = options.limit || 50;
    return items.slice(0, limit).map((i) => ({ ...i }));
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = WalletIntelligenceRepositoryMemory;
