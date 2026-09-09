class AttributionRepositoryMemory {
  constructor() {
    this.store = [];
  }

  async create(data) {
    const record = {
      ...data,
      walletAddress: String(data.walletAddress).toLowerCase(),
      chain: String(data.chain || 'ETH').toUpperCase(),
      caseId: data.caseId,
      attributedVaspId: data.attributedVaspId,
      vaspName: data.vaspName,
      confidenceScore: data.confidenceScore,
      pathScore: data.pathScore || 0,
      attributionMethod: data.attributionMethod,
      hopDistance: data.hopDistance || 0,
      tracePath: data.tracePath || [],
      supportingTransactions: data.supportingTransactions || [],
      explanation: data.explanation || '',
      createdAt: data.createdAt || new Date()
    };

    this.store.push(record);
    return { ...record };
  }

  async findByCaseId(caseId) {
    const results = this.store.filter((a) => a.caseId === caseId);
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.map((r) => ({ ...r }));
  }

  async findByWallet(chain, walletAddress) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(walletAddress).toLowerCase();

    const results = this.store.filter(
      (a) => a.chain === normalizedChain && a.walletAddress === normalizedAddress
    );
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results.map((r) => ({ ...r }));
  }

  async clear() {
    this.store = [];
  }
}

module.exports = AttributionRepositoryMemory;
