class VaspRepositoryMemory {
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
      const err = new Error(`Duplicate key error: VASP ${key} already exists`);
      err.code = 11000;
      throw err;
    }

    let chainNorm = String(data.chain || 'ETH').toUpperCase().trim();
    if (chainNorm === 'ETHEREUM') chainNorm = 'ETH';

    const record = {
      ...data,
      vaspId: data.vaspId || `VASP_${data.name ? data.name.replace(/\s+/g, '_').toUpperCase() : 'DEMO'}`,
      name: data.name || data.vasp || 'VASP Demo',
      vasp: data.vasp || data.name || 'VASP Demo',
      type: data.type || 'CEX',
      jurisdiction: data.jurisdiction || 'GLOBAL',
      address: String(data.address).toLowerCase().trim(),
      chain: chainNorm,
      walletType: data.walletType || 'DEPOSIT_WALLET',
      attributionType: data.attributionType || 'DIRECT',
      confidence: data.confidence !== undefined ? data.confidence : 80,
      sourceType: data.sourceType || 'SYNTHETIC_DEMO',
      isSynthetic: data.isSynthetic !== undefined ? data.isSynthetic : true,
      clusterId: data.clusterId || '',
      leaContactEmail: data.leaContactEmail || '',
      subpoenaGuide: data.subpoenaGuide || '',
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
    if (filter.type) {
      items = items.filter((i) => i.type === filter.type);
    }
    if (filter.walletType) {
      items = items.filter((i) => i.walletType === filter.walletType);
    }
    items.sort((a, b) => a.name.localeCompare(b.name));
    const limit = options.limit || 100;
    return items.slice(0, limit).map((i) => ({ ...i }));
  }

  async findByCluster(clusterId) {
    if (!clusterId) return [];
    return Array.from(this.store.values())
      .filter((i) => i.clusterId === clusterId)
      .map((i) => ({ ...i }));
  }

  async search(query = {}, options = {}) {
    let items = Array.from(this.store.values());

    if (query.name || query.vasp) {
      const q = String(query.name || query.vasp).toLowerCase();
      items = items.filter((i) => i.name.toLowerCase().includes(q) || i.vasp.toLowerCase().includes(q));
    }
    if (query.vaspId) {
      items = items.filter((i) => i.vaspId === query.vaspId);
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

  async delete(chain, address) {
    const key = this._makeKey(chain, address);
    const deleted = this.store.delete(key);
    return { deletedCount: deleted ? 1 : 0 };
  }

  async list(filter = {}, options = {}) {
    return await this.findAll(filter, options);
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = VaspRepositoryMemory;
