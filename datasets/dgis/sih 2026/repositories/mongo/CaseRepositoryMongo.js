const Case = require('../../models/Case');

class CaseRepositoryMongo {
  async create(data) {
    const doc = new Case(data);
    return await doc.save();
  }

  async findById(id) {
    return await Case.findById(id).lean();
  }

  async findByCaseId(caseId) {
    return await Case.findOne({ caseId }).lean();
  }

  async findBySahyogRequestId(sahyogRequestId) {
    if (!sahyogRequestId) return null;
    return await Case.findOne({ sahyogRequestId }).lean();
  }

  async update(caseId, updateData) {
    return await Case.findOneAndUpdate(
      { caseId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();
  }

  async list(filter = {}, options = {}) {
    const limit = options.limit || 50;
    const skip = options.skip || 0;
    return await Case.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean();
  }

  async count(filter = {}) {
    return await Case.countDocuments(filter);
  }

  async clear() {
    return await Case.deleteMany({});
  }
}

module.exports = CaseRepositoryMongo;
