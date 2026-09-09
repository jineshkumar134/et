/**
 * repositories/mongo/SahyogActionRepositoryMongo.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * MongoDB repository for SahyogAction records.
 */
"use strict";

const SahyogAction = require("../../models/SahyogAction");

class SahyogActionRepositoryMongo {
  async create(data) {
    const doc = new SahyogAction(data);
    return await doc.save();
  }

  async findByActionId(actionId) {
    return await SahyogAction.findOne({ actionId }).lean();
  }

  async findByRequestId(requestId) {
    return await SahyogAction.find({ requestId }).sort({ createdAt: -1 }).lean();
  }

  async findByCaseId(caseId) {
    return await SahyogAction.find({ caseId }).sort({ createdAt: -1 }).lean();
  }

  async update(actionId, updateData) {
    return await SahyogAction.findOneAndUpdate(
      { actionId },
      { $set: updateData },
      { new: true, runValidators: true }
    ).lean();
  }

  async listActionsByCaseId(caseId) {
    return await this.findByCaseId(caseId);
  }

  async clear() {
    return await SahyogAction.deleteMany({});
  }
}

module.exports = SahyogActionRepositoryMongo;
