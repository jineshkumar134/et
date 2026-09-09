class AuditRepositoryMemory {
  constructor() {
    this.store = [];
    this._idCounter = 1;
  }

  async create(data) {
    const record = {
      _id: String(this._idCounter++),
      ...data,
      caseId: data.caseId,
      action: data.action,
      stage: data.stage || null,
      actor: data.actor || 'SYSTEM',
      durationMs: data.durationMs !== undefined ? data.durationMs : null,
      timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
      metadata: data.metadata || {},
      createdAt: data.createdAt || new Date()
    };

    this.store.push(record);
    return { ...record };
  }

  async findByCaseId(caseId) {
    const results = this.store.filter((a) => a.caseId === caseId);
    results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return results.map((r) => ({ ...r }));
  }

  async findById(id) {
    const record = this.store.find((a) => a._id === String(id));
    return record ? { ...record } : null;
  }

  async countByCaseId(caseId) {
    return this.store.filter((a) => a.caseId === caseId).length;
  }

  async clear() {
    this.store = [];
    this._idCounter = 1;
  }
}

module.exports = AuditRepositoryMemory;

