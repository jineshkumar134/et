class WalletRepositoryMemory {
  constructor() {
    this.store = new Map(); // key: chain:address
  }

  _makeKey(chain, address) {
    const c = String(chain || 'ETH').toUpperCase();
    const a = String(address || '').toLowerCase();
    return `${c}:${a}`;
  }

  async create(data) {
    const key = this._makeKey(data.chain, data.address);
    if (this.store.has(key)) {
      const err = new Error(`Duplicate key error: Wallet ${key} already exists`);
      err.code = 11000;
      throw err;
    }

    const record = {
      ...data,
      address: String(data.address).toLowerCase(),
      chain: String(data.chain || 'ETH').toUpperCase(),
      balance: data.balance || '0',
      firstSeen: data.firstSeen || new Date(),
      lastSeen: data.lastSeen || new Date(),
      tags: data.tags || [],
      walletType: data.walletType || 'UNKNOWN',
      entityName: data.entityName || '',
      entityType: data.entityType || '',
      clusterId: data.clusterId || '',
      intelligenceConfidence: data.intelligenceConfidence || 0,
      sourceType: data.sourceType || 'SYNTHETIC_DEMO',
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    };

    this.store.set(key, record);
    return { ...record };
  }

  async findByAddress(address) {
    const normalized = String(address).toLowerCase();
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
    return record ? { ...record } : null;
  }

  async update(chain, address, updateData) {
    const key = this._makeKey(chain, address);
    const existing = this.store.get(key);

    if (!existing) {
      return await this.create({ chain, address, ...updateData });
    }

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };

    this.store.set(key, updated);
    return { ...updated };
  }

  async list(filter = {}, options = {}) {
    let items = Array.from(this.store.values());

    if (filter.walletType) {
      items = items.filter((i) => i.walletType === filter.walletType);
    }
    if (filter.chain) {
      items = items.filter((i) => i.chain === String(filter.chain).toUpperCase());
    }

    items.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    const skip = options.skip || 0;
    const limit = options.limit || 50;

    return items.slice(skip, skip + limit).map((i) => ({ ...i }));
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = WalletRepositoryMemory;
