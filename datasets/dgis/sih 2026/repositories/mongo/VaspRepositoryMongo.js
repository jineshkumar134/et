const Vasp = require('../../models/Vasp');

class VaspRepositoryMongo {
  async create(data) {
    const doc = new Vasp(data);
    return await doc.save();
  }

  async findByAddress(address) {
    const normalized = String(address).toLowerCase();
    return await Vasp.findOne({ address: normalized }).lean();
  }

  async findByChainAndAddress(chain, address) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    return await Vasp.findOne({ chain: normalizedChain, address: normalizedAddress }).lean();
  }

  async findAll(filter = {}, options = {}) {
    const limit = options.limit || 100;
    return await Vasp.find(filter).sort({ name: 1 }).limit(limit).lean();
  }

  async findByCluster(clusterId) {
    if (!clusterId) return [];
    return await Vasp.find({ clusterId }).lean();
  }

  async search(query = {}, options = {}) {
    const limit = options.limit || 50;
    return await Vasp.find(query).sort({ name: 1 }).limit(limit).lean();
  }

  async delete(chain, address) {
    const normalizedChain = String(chain).toUpperCase();
    const normalizedAddress = String(address).toLowerCase();
    return await Vasp.deleteOne({ chain: normalizedChain, address: normalizedAddress });
  }

  async list(filter = {}, options = {}) {
    return await this.findAll(filter, options);
  }

  async clear() {
    return await Vasp.deleteMany({});
  }
}

module.exports = VaspRepositoryMongo;
