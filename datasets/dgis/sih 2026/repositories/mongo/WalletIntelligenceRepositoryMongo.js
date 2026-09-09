const WalletIntelligence = require('../../models/WalletIntelligence');

class WalletIntelligenceRepositoryMongo {
  async create(data) {
    const doc = new WalletIntelligence(data);
    return await doc.save();
  }

  async findByAddress(address) {
    const normalized = String(address).toLowerCase();
    return await WalletIntelligence.findOne({ address: normalized }).lean();
  }

  async findByChainAndAddress(chain, address) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    return await WalletIntelligence.findOne({ chain: normalizedChain, address: normalizedAddress }).lean();
  }

  async findAll(filter = {}, options = {}) {
    const limit = options.limit || 100;
    return await WalletIntelligence.find(filter).sort({ updatedAt: -1 }).limit(limit).lean();
  }

  async findByEntityType(entityType) {
    return await WalletIntelligence.find({ entityType }).lean();
  }

  async findByCluster(clusterId) {
    if (!clusterId) return [];
    return await WalletIntelligence.find({ clusterId }).lean();
  }

  async search(query = {}, options = {}) {
    const limit = options.limit || 50;
    return await WalletIntelligence.find(query).sort({ updatedAt: -1 }).limit(limit).lean();
  }

  async clear() {
    return await WalletIntelligence.deleteMany({});
  }
}

module.exports = WalletIntelligenceRepositoryMongo;
