const Attribution = require('../../models/Attribution');

class AttributionRepositoryMongo {
  async create(data) {
    const doc = new Attribution(data);
    return await doc.save();
  }

  async findByCaseId(caseId) {
    return await Attribution.find({ caseId }).sort({ createdAt: -1 }).lean();
  }

  async findByWallet(chain, walletAddress) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(walletAddress).toLowerCase();
    return await Attribution.find({ chain: normalizedChain, walletAddress: normalizedAddress })
      .sort({ createdAt: -1 })
      .lean();
  }

  async clear() {
    return await Attribution.deleteMany({});
  }
}

module.exports = AttributionRepositoryMongo;
