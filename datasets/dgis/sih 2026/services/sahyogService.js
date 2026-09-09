/**
 * services/sahyogService.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * Integration layer orchestrating SAHYOG-compatible investigation requests.
 * Uses existing investigationService — does NOT duplicate tracing/scoring logic.
 */
"use strict";

const repositories = require("../repositories");
const investigationService = require("./investigationService");
const { getSahyogAdapter } = require("../adapters/sahyog");
const config = require("../config/config");

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];

class SahyogService {
  /**
   * Accepts and processes a SAHYOG-compatible investigation request.
   * @param {Object} payload
   * @returns {Promise<Object>}
   */
  async receiveInvestigation(payload = {}) {
    const {
      requestId,
      walletAddress,
      chain = "ethereum",
      priority = "HIGH",
      requestedScope = {}
    } = payload;

    if (!requestId || typeof requestId !== "string" || !requestId.trim()) {
      const err = new Error("requestId is required and must be a non-empty string");
      err.statusCode = 400;
      err.code = "SAHYOG_REQUEST_INVALID";
      throw err;
    }

    const normRequestId = requestId.trim();

    // Validate priority
    const normPriority = String(priority).toUpperCase().trim();
    if (!VALID_PRIORITIES.includes(normPriority)) {
      const err = new Error("Invalid priority: " + priority + ". Must be one of: " + VALID_PRIORITIES.join(", "));
      err.statusCode = 400;
      err.code = "SAHYOG_REQUEST_INVALID";
      throw err;
    }

    // Validate wallet address & chain using investigationService validator
    investigationService.validateInput({
      walletAddress,
      chain,
      maxDepth: requestedScope.maxDepth,
      maxTransactions: requestedScope.maxTransactions,
      timeWindowHours: requestedScope.timeWindowHours
    });

    const caseRepo = repositories.caseRepository;
    const adapter = getSahyogAdapter();

    // Idempotency: Check if requestId already processed
    let existingCase = await caseRepo.findBySahyogRequestId(normRequestId);
    if (!existingCase) {
      // Check if caseId matching requestId exists
      existingCase = await caseRepo.findByCaseId(normRequestId);
    }

    if (existingCase && existingCase.status === "COMPLETED" && existingCase.investigationResult) {
      console.log("[SahyogService] Returning existing completed investigation for requestId=" + normRequestId);
      
      const invResult = existingCase.investigationResult;
      const topCand = invResult.topCandidate || (invResult.candidates ? invResult.candidates[0] : null);

      return {
        success: true,
        data: {
          requestId: normRequestId,
          caseId: existingCase.caseId,
          status: existingCase.status,
          integration: {
            source: "SAHYOG_API_ADAPTER",
            mode: adapter.mode || "SANDBOX",
            productionConnected: false
          },
          attribution: {
            status: topCand ? "FOUND" : "NOT_FOUND",
            topCandidate: topCand ? {
              vasp: topCand.vasp ? topCand.vasp.name : "Unknown Entity",
              attributionType: topCand.vasp ? topCand.vasp.attributionType : "UNKNOWN",
              intelligenceConfidence: topCand.vasp ? topCand.vasp.intelligenceConfidence : 0,
              overallScore: topCand.overallScore || 0
            } : null
          },
          dataProvenance: invResult.provenance || existingCase.dataProvenance || {},
          investigation: invResult
        }
      };
    }

    const caseId = existingCase ? existingCase.caseId : ("CASE_SAHYOG_" + normRequestId);

    // Write audit event: SAHYOG_REQUEST_RECEIVED
    await investigationService._logAudit(caseId, "SAHYOG_REQUEST_RECEIVED", {
      stage: "SAHYOG_INTAKE",
      actor: "SAHYOG_API_ADAPTER",
      metadata: { requestId: normRequestId, walletAddress, chain, priority: normPriority }
    });

    await investigationService._logAudit(caseId, "SAHYOG_INVESTIGATION_STARTED", {
      stage: "SAHYOG_INTAKE",
      actor: "SAHYOG_API_ADAPTER",
      metadata: { requestId: normRequestId, caseId }
    });

    // Invoke core investigation pipeline
    const invResult = await investigationService.investigateWallet({
      caseId,
      walletAddress,
      chain,
      maxDepth: requestedScope.maxDepth || 3,
      maxTransactions: requestedScope.maxTransactions || 100,
      timeWindowHours: requestedScope.timeWindowHours || 24,
      investigatorId: "SAHYOG_OFFICER_SANDBOX"
    });

    // Link SAHYOG requestId to case
    await caseRepo.update(caseId, {
      sahyogRequestId: normRequestId,
      sourceSystem: "SAHYOG",
      integrationMode: adapter.mode || "SANDBOX"
    });

    await investigationService._logAudit(caseId, "SAHYOG_INVESTIGATION_COMPLETED", {
      stage: "COMPLETED",
      actor: "SAHYOG_API_ADAPTER",
      metadata: { requestId: normRequestId, caseId, status: "COMPLETED" }
    });

    const topCand = invResult.topCandidate || (invResult.candidates ? invResult.candidates[0] : null);

    return {
      success: true,
      data: {
        requestId: normRequestId,
        caseId,
        status: "COMPLETED",
        integration: {
          source: "SAHYOG_API_ADAPTER",
          mode: adapter.mode || "SANDBOX",
          productionConnected: false
        },
        attribution: {
          status: topCand ? "FOUND" : "NOT_FOUND",
          topCandidate: topCand ? {
            vasp: topCand.vasp ? topCand.vasp.name : "Unknown Entity",
            attributionType: topCand.vasp ? topCand.vasp.attributionType : "UNKNOWN",
            intelligenceConfidence: topCand.vasp ? topCand.vasp.intelligenceConfidence : 0,
            overallScore: topCand.overallScore || 0
          } : null
        },
        dataProvenance: invResult.provenance || {},
        investigation: invResult
      }
    };
  }

  /**
   * Retrieves a SAHYOG request and associated investigation & actions.
   * @param {string} requestId
   * @returns {Promise<Object>}
   */
  async getSahyogRequest(requestId) {
    if (!requestId) {
      const err = new Error("requestId parameter is required");
      err.statusCode = 400;
      err.code = "SAHYOG_REQUEST_INVALID";
      throw err;
    }

    const normRequestId = String(requestId).trim();
    const caseRepo = repositories.caseRepository;
    const sahyogActionRepo = repositories.sahyogActionRepository;

    let caseRecord = await caseRepo.findBySahyogRequestId(normRequestId);
    if (!caseRecord) {
      caseRecord = await caseRepo.findByCaseId(normRequestId);
    }

    if (!caseRecord) {
      const err = new Error("SAHYOG request not found: " + normRequestId);
      err.statusCode = 404;
      err.code = "SAHYOG_REQUEST_NOT_FOUND";
      throw err;
    }

    const actions = await sahyogActionRepo.findByRequestId(normRequestId);

    return {
      success: true,
      data: {
        requestId: normRequestId,
        caseId: caseRecord.caseId,
        status: caseRecord.status,
        currentStage: caseRecord.currentStage,
        integration: {
          source: "SAHYOG_API_ADAPTER",
          mode: caseRecord.integrationMode || "SANDBOX",
          productionConnected: false
        },
        investigation: caseRecord.investigationResult || null,
        actionsCount: actions.length,
        actions,
        dataProvenance: caseRecord.dataProvenance || {}
      }
    };
  }
}

module.exports = new SahyogService();
