class EvidenceRepositoryMemory {
  constructor() {
    this.store = [];
    this._idCounter = 1;
  }

  async create(data) {
    const record = {
      _id: String(this._idCounter++),
      ...data,
      caseId: data.caseId,
      summary: data.summary,
      tracePath: data.tracePath || [],
      transactionTrail: data.transactionTrail || [],
      attributionEvidence: data.attributionEvidence || {},
      fundFlow: data.fundFlow || {},
      scoring: data.scoring || {},
      topCandidate: data.topCandidate || null,
      provenance: data.provenance || {
        blockchainSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
        attributionSource: 'VASP_INTELLIGENCE_DATABASE',
        dataMode: 'DEMO',
        generatedAt: new Date()
      },
      fingerprintHash: data.fingerprintHash || null,
      analysisVersion: data.analysisVersion || '1.0.0',
      isSynthetic: data.isSynthetic !== undefined ? data.isSynthetic : true,
      disclaimer: data.disclaimer || 'Generated for authorized LEA investigation use only. All data in DEMO mode is synthetic.',
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    };

    this.store.push(record);
    return { ...record };
  }

  async findByCaseId(caseId) {
    const results = this.store.filter((e) => e.caseId === caseId);
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.map((r) => ({ ...r }));
  }

  async findLatestByCaseId(caseId) {
    const results = this.store.filter((e) => e.caseId === caseId);
    if (!results.length) return null;
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { ...results[0] };
  }

  async findById(id) {
    const record = this.store.find((e) => e._id === String(id));
    return record ? { ...record } : null;
  }

  async update(id, updates) {
    const idx = this.store.findIndex((e) => e._id === String(id));
    if (idx === -1) return null;
    this.store[idx] = { ...this.store[idx], ...updates, updatedAt: new Date() };
    return { ...this.store[idx] };
  }

  async clear() {
    this.store = [];
    this._idCounter = 1;
  }
}

module.exports = EvidenceRepositoryMemory;

