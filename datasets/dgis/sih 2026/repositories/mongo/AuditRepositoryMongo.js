const AuditLog = require('../../models/AuditLog');

class AuditRepositoryMongo {
  async create(data) {
    const doc = new AuditLog(data);
    return await doc.save();
  }

  async findByCaseId(caseId) {
    return await AuditLog.find({ caseId }).sort({ timestamp: -1 }).lean();
  }

  async clear() {
    return await AuditLog.deleteMany({});
  }
}

module.exports = AuditRepositoryMongo;
