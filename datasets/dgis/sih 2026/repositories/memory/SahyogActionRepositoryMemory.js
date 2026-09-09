/**
 * repositories/memory/SahyogActionRepositoryMemory.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * In-memory repository for SahyogAction records.
 */
"use strict";

class SahyogActionRepositoryMemory {
  constructor() {
    this.store = new Map();
  }

  async create(data) {
    if (!data.actionId) {
      throw new Error("actionId is required");
    }
    if (this.store.has(data.actionId)) {
      const err = new Error("Duplicate actionId: " + data.actionId);
      err.code = 11000;
      throw err;
    }

    const record = {
      ...data,
      status: data.status || "DRAFT",
      mode: data.mode || "SANDBOX",
      submittedAt: data.submittedAt || null,
      investigationReference: data.investigationReference || {},
      sandboxAcknowledgement: data.sandboxAcknowledgement || null,
      metadata: data.metadata || {},
      createdAt: data.createdAt || new Date(),
      updatedAt: data.updatedAt || new Date()
    };

    this.store.set(data.actionId, record);
    return { ...record };
  }

  async findByActionId(actionId) {
    const record = this.store.get(actionId);
    return record ? { ...record } : null;
  }

  async findByRequestId(requestId) {
    const results = [];
    for (const record of this.store.values()) {
      if (record.requestId === requestId) {
        results.push({ ...record });
      }
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  }

  async findByCaseId(caseId) {
    const results = [];
    for (const record of this.store.values()) {
      if (record.caseId === caseId) {
        results.push({ ...record });
      }
    }
    results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return results;
  }

  async update(actionId, updateData) {
    const existing = this.store.get(actionId);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updateData,
      updatedAt: new Date()
    };

    this.store.set(actionId, updated);
    return { ...updated };
  }

  async listActionsByCaseId(caseId) {
    return this.findByCaseId(caseId);
  }

  async clear() {
    this.store.clear();
  }
}

module.exports = SahyogActionRepositoryMemory;
