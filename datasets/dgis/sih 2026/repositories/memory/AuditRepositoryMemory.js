const { saveFile, loadFile } = require('./fsStore');

class AuditRepositoryMemory {
  constructor() {
    this.store = [];
    this._idCounter = 1;
    this._load();
  }

  _load() {
    this.store = loadFile('audit', []);
    this._idCounter = this.store.length + 1;
  }

  _save() {
    saveFile('audit', this.store);
  }

  async create(data) {
    this._load();
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
    this._save();
    return { ...record };
  }

  async findByCaseId(caseId) {
    this._load();
    const results = this.store.filter((a) => a.caseId === caseId);
    results.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return results.map((r) => ({ ...r }));
  }

  async findById(id) {
    this._load();
    const record = this.store.find((a) => a._id === String(id));
    return record ? { ...record } : null;
  }

  async countByCaseId(caseId) {
    this._load();
    return this.store.filter((a) => a.caseId === caseId).length;
  }

  async clear() {
    this.store = [];
    this._idCounter = 1;
    this._save();
  }
}

module.exports = AuditRepositoryMemory;
