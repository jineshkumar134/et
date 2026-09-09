const Wallet = require('../../models/Wallet');

class WalletRepositoryMongo {
  async create(data) {
    const doc = new Wallet(data);
    return await doc.save();
  }

  async findByAddress(address) {
    const normalized = String(address).toLowerCase();
    return await Wallet.findOne({ address: normalized }).lean();
  }

  async findByChainAndAddress(chain, address) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    return await Wallet.findOne({ chain: normalizedChain, address: normalizedAddress }).lean();
  }

  async update(chain, address, updateData) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    return await Wallet.findOneAndUpdate(
      { chain: normalizedChain, address: normalizedAddress },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).lean();
  }

  async list(filter = {}, options = {}) {
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    return await Wallet.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean();
  }

  async clear() {
    return await Wallet.deleteMany({});
  }
}

module.exports = WalletRepositoryMongo;
