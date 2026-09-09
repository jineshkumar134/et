const Evidence = require('../../models/Evidence');

class EvidenceRepositoryMongo {
  async create(data) {
    const doc = new Evidence(data);
    return await doc.save();
  }

  async findByCaseId(caseId) {
    return await Evidence.find({ caseId }).sort({ createdAt: -1 }).lean();
  }

  async clear() {
    return await Evidence.deleteMany({});
  }
}

module.exports = EvidenceRepositoryMongo;
