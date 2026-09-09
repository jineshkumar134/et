/**
 * services/sahyogActionService.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * Manages Lawful Action Preparation (Disclosure / Freezing requests) in Sandbox mode.
 * Enforces No-VASP safety, completed investigation safety, action immutability, and audit logging.
 */
"use strict";

const repositories = require("../repositories");
const evidenceService = require("./evidenceService");
const investigationService = require("./investigationService");
const { getSahyogAdapter } = require("../adapters/sahyog");

const VALID_ACTION_TYPES = ["DISCLOSURE_REQUEST", "FREEZING_REQUEST"];

class SahyogActionService {
  /**
   * Prepares a lawful action (DISCLOSURE_REQUEST or FREEZING_REQUEST) for a completed case.
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async prepareAction(options = {}) {
    const {
      requestId,
      caseId,
      actionType,
      lawfulBasis,
      justification
    } = options;

    // 1. Validate actionType
    if (!actionType || !VALID_ACTION_TYPES.includes(String(actionType).toUpperCase().trim())) {
      const err = new Error("Invalid actionType: " + actionType + ". Must be DISCLOSURE_REQUEST or FREEZING_REQUEST.");
      err.statusCode = 400;
      err.code = "INVALID_ACTION_TYPE";
      throw err;
    }
    const normActionType = String(actionType).toUpperCase().trim();

    // 2. Validate lawfulBasis
    if (!lawfulBasis || typeof lawfulBasis !== "string" || !lawfulBasis.trim()) {
      const err = new Error("lawfulBasis is required for lawful action preparation");
      err.statusCode = 400;
      err.code = "LAWFUL_BASIS_REQUIRED";
      throw err;
    }

    // 3. Validate justification
    if (!justification || typeof justification !== "string" || !justification.trim()) {
      const err = new Error("justification is required for lawful action preparation");
      err.statusCode = 400;
      err.code = "JUSTIFICATION_REQUIRED";
      throw err;
    }

    // 4. Find case record
    const caseRepo = repositories.caseRepository;
    let targetCase = null;

    if (caseId) {
      targetCase = await caseRepo.findByCaseId(caseId);
    }
    if (!targetCase && requestId) {
      targetCase = await caseRepo.findBySahyogRequestId(requestId);
    }
    if (!targetCase && requestId) {
      targetCase = await caseRepo.findByCaseId(requestId);
    }

    if (!targetCase) {
      const err = new Error("Case not found for lawful action preparation");
      err.statusCode = 404;
      err.code = "CASE_NOT_FOUND";
      throw err;
    }

    // 5. Investigation Status Safety: Must be COMPLETED
    if (targetCase.status !== "COMPLETED") {
      const err = new Error("Cannot prepare action: Investigation is not COMPLETED (status: " + targetCase.status + ")");
      err.statusCode = 400;
      err.code = "INVESTIGATION_NOT_COMPLETED";
      throw err;
    }

    // 6. No-VASP Safety: Must have a valid VASP candidate
    const invResult = targetCase.investigationResult || {};
    const candidates = invResult.candidates || targetCase.candidates || [];
    const topCand = invResult.topCandidate || (candidates.length > 0 ? candidates[0] : null);

    if (!topCand || !topCand.vasp || !topCand.destinationAddress) {
      const err = new Error("No ranked VASP candidate is available for this investigation.");
      err.statusCode = 400;
      err.code = "NO_VASP_CANDIDATE";
      throw err;
    }

    // 7. Get Evidence Fingerprint reference
    const evidenceBundles = await evidenceService.getEvidenceBundle(targetCase.caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;

    const actionId = "SAH-ACT-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    const normRequestId = requestId || targetCase.sahyogRequestId || targetCase.caseId;
    const adapter = getSahyogAdapter();

    const actionRecord = {
      actionId,
      requestId: normRequestId,
      caseId: targetCase.caseId,
      actionType: normActionType,
      targetVasp: topCand.vasp.name || topCand.vasp.vasp || "Unknown Entity",
      targetAddress: topCand.destinationAddress,
      chain: topCand.chain || targetCase.chain || "ETH",
      status: "READY",
      lawfulBasis: lawfulBasis.trim(),
      justification: justification.trim(),
      mode: adapter.mode || "SANDBOX",
      investigationReference: {
        overallScore: topCand.overallScore || 0,
        attributionConfidence: topCand.vasp.intelligenceConfidence || 0,
        attributionType: topCand.vasp.attributionType || "UNKNOWN",
        band: topCand.band || "WEAK_ATTRIBUTION_PATH",
        evidenceFingerprint: evidence ? evidence.fingerprintHash : null
      },
      metadata: {
        preparedBy: "INVESTIGATOR_SANDBOX",
        sourceSystem: "SAHYOG"
      }
    };

    const sahyogActionRepo = repositories.sahyogActionRepository;
    const created = await sahyogActionRepo.create(actionRecord);

    // Audit event: SAHYOG_ACTION_PREPARED
    await investigationService._logAudit(targetCase.caseId, "SAHYOG_ACTION_PREPARED", {
      stage: "LAWFUL_ACTION",
      actor: "SAHYOG_ACTION_SERVICE",
      metadata: {
        actionId,
        requestId: normRequestId,
        actionType: normActionType,
        targetVasp: created.targetVasp,
        targetAddress: created.targetAddress,
        status: "READY"
      }
    });

    return {
      success: true,
      data: {
        actionId: created.actionId,
        requestId: created.requestId,
        caseId: created.caseId,
        actionType: created.actionType,
        target: {
          vasp: created.targetVasp,
          address: created.targetAddress,
          chain: created.chain
        },
        status: created.status,
        basis: {
          lawfulBasis: created.lawfulBasis,
          justification: created.justification
        },
        investigationReference: created.investigationReference,
        mode: created.mode
      }
    };
  }

  /**
   * Submits a prepared READY action in Sandbox mode.
   * @param {string} actionId
   * @returns {Promise<Object>}
   */
  async submitAction(actionId) {
    if (!actionId) {
      const err = new Error("actionId is required for submission");
      err.statusCode = 400;
      err.code = "ACTION_NOT_FOUND";
      throw err;
    }

    const sahyogActionRepo = repositories.sahyogActionRepository;
    const action = await sahyogActionRepo.findByActionId(actionId);

    if (!action) {
      const err = new Error("SahyogAction not found: " + actionId);
      err.statusCode = 404;
      err.code = "ACTION_NOT_FOUND";
      throw err;
    }

    // Action Immutability & Status Safety
    if (action.status !== "READY") {
      const err = new Error("Cannot submit action: Action status is " + action.status + " (must be READY)");
      err.statusCode = 400;
      err.code = "ACTION_NOT_READY";
      throw err;
    }

    const adapter = getSahyogAdapter();

    // Execute Sandbox submission simulation via adapter
    const simResult = await adapter.submitAction(action);

    const updated = await sahyogActionRepo.update(actionId, {
      status: "SUBMITTED",
      submittedAt: new Date(),
      sandboxAcknowledgement: simResult.sandboxAcknowledgement
    });

    // Audit event: SAHYOG_ACTION_SUBMITTED_SANDBOX
    await investigationService._logAudit(action.caseId, "SAHYOG_ACTION_SUBMITTED_SANDBOX", {
      stage: "LAWFUL_ACTION",
      actor: "SAHYOG_ACTION_SERVICE",
      metadata: {
        actionId,
        requestId: action.requestId,
        actionType: action.actionType,
        targetVasp: action.targetVasp,
        status: "SUBMITTED",
        mode: "SANDBOX",
        acknowledgementId: simResult.sandboxAcknowledgement ? simResult.sandboxAcknowledgement.acknowledgementId : null
      }
    });

    return {
      success: true,
      data: {
        actionId: updated.actionId,
        requestId: updated.requestId,
        caseId: updated.caseId,
        actionType: updated.actionType,
        target: {
          vasp: updated.targetVasp,
          address: updated.targetAddress,
          chain: updated.chain
        },
        status: updated.status,
        mode: updated.mode,
        externalSubmission: false,
        submittedAt: updated.submittedAt,
        sandboxAcknowledgement: updated.sandboxAcknowledgement,
        message: simResult.message || "Sandbox submission recorded. No real government or VASP request was sent."
      }
    };
  }

  /**
   * Retrieves an action by actionId.
   * @param {string} actionId
   * @returns {Promise<Object>}
   */
  async getAction(actionId) {
    if (!actionId) {
      const err = new Error("actionId parameter is required");
      err.statusCode = 400;
      throw err;
    }

    const sahyogActionRepo = repositories.sahyogActionRepository;
    const action = await sahyogActionRepo.findByActionId(actionId);

    if (!action) {
      const err = new Error("SahyogAction not found: " + actionId);
      err.statusCode = 404;
      err.code = "ACTION_NOT_FOUND";
      throw err;
    }

    return {
      success: true,
      data: action
    };
  }

  /**
   * Lists all actions associated with a case.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async listActionsByCaseId(caseId) {
    if (!caseId) {
      const err = new Error("caseId parameter is required");
      err.statusCode = 400;
      throw err;
    }

    const sahyogActionRepo = repositories.sahyogActionRepository;
    const actions = await sahyogActionRepo.findByCaseId(caseId);

    return {
      success: true,
      caseId,
      count: actions.length,
      actions
    };
  }
}

module.exports = new SahyogActionService();
