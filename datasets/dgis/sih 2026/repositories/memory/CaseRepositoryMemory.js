const { saveFile, loadFile } = require('./fsStore');

class CaseRepositoryMemory {
  constructor() {
    this.store = new Map();
    this._load();
  }

  _load() {
    const list = loadFile('cases', []);
    for (const item of list) {
      if (item && item.caseId) {
        this.store.set(item.caseId, item);
      }
    }
  }

  _save() {
    const list = Array.from(this.store.values());
    saveFile('cases', list);
  }

  async create(data) {
    if (!data.caseId) {
      throw new Error('caseId is required');
    }
    this._load(); // refresh from disk
    if (this.store.has(data.caseId)) {
      const err = new Error(`Duplicate key error: Case ${data.caseId} already exists`);
      err.code = 11000;
      throw err;
    }

    const record = {
      ...data,
      status: data.status || 'PENDING',
      currentStage: data.currentStage || 'CASE_CREATION',
      error: data.error || null,
      targetWallets: data.targetWallets || [],
      notes: data.notes || '',
      chain: data.chain || 'ETH',
      investigationScope: data.investigationScope || 'FULL_TRACE',
      maxDepth: data.maxDepth || 3,
      maxTransactions: data.maxTransactions || 100,
      timeWindowHours: data.timeWindowHours || 72,
      candidateCount: data.candidateCount || 0,
      candidates: data.candidates || [],
      sahyogRequestId: data.sahyogRequestId || null,
      sourceSystem: data.sourceSystem || 'INTERNAL',
      integrationMode: data.integrationMode || 'SANDBOX',
      dataProvenance: data.dataProvenance || {
        blockchainSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
        attributionSource: 'VASP_INTELLIGENCE_DATABASE',
        dataMode: 'DEMO',
        generatedAt: new Date()
      },
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    };

    this.store.set(data.caseId, record);
    this._save();
    return { ...record };
  }

  async findById(id) {
    this._load();
    for (const record of this.store.values()) {
      if (record._id === id || record.caseId === id) {
        return { ...record };
      }
    }
    return null;
  }

  async findByCaseId(caseId) {
    this._load();
    const record = this.store.get(caseId);
    return record ? { ...record } : null;
  }

  async findBySahyogRequestId(requestId) {
    if (!requestId) return null;
    this._load();
    for (const record of this.store.values()) {
      if (record.sahyogRequestId === requestId) {
        return { ...record };
      }
    }
    return null;
  }

  async update(caseId, updateData) {
    this._load();
    const existing = this.store.get(caseId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };

    this.store.set(caseId, updated);
    this._save();
    return { ...updated };
  }

  async list(filter = {}, options = {}) {
    this._load();
    let items = Array.from(this.store.values());

    if (filter.status) {
      items = items.filter((i) => i.status === filter.status);
    }

    items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const skip = options.skip || 0;
    const limit = options.limit || 50;

    return items.slice(skip, skip + limit).map((i) => ({ ...i }));
  }

  async count(filter = {}) {
    const items = await this.list(filter, { limit: Number.MAX_SAFE_INTEGER });
    return items.length;
  }

  async clear() {
    this.store.clear();
    this._save();
  }
}

module.exports = CaseRepositoryMemory;
