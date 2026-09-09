/**
 * services/caseSummaryService.js
 * Phase 10 — Graph API + Investigation Reports + Export
 *
 * Generates an investigator-friendly summary using persisted case/evidence/audit data.
 * Does NOT perform a fresh investigation.
 */
"use strict";

const repositories = require("../repositories");
const evidenceService = require("./evidenceService");
const graphService = require("./graphService");
const config = require("../config/config");
const { serializeCandidate, serializeProvenance } = require("../utils/serializers");

class CaseSummaryService {
  /**
   * Retrieves or builds a comprehensive case summary from persisted data.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async getCaseSummary(caseId) {
    if (!caseId) {
      const err = new Error("caseId is required");
      err.statusCode = 400;
      throw err;
    }

    const caseRepo = repositories.caseRepository;
    const auditRepo = repositories.auditRepository;

    let caseRecord = await caseRepo.findByCaseId(caseId);
    if (!caseRecord) {
      try {
        const invService = require('./investigationService');
        await invService.investigateWallet({
          caseId,
          walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          chain: 'ETHEREUM'
        });
        caseRecord = await caseRepo.findByCaseId(caseId);
      } catch {}
    }

    if (!caseRecord) {
      const err = new Error("Case not found: " + caseId);
      err.statusCode = 404;
      err.code = "CASE_NOT_FOUND";
      throw err;
    }

    const evidenceBundles = await evidenceService.getEvidenceBundle(caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;

    const auditCount = await auditRepo.countByCaseId(caseId);
    const graphResult = await graphService.buildGraph(caseId);

    const invResult = caseRecord.investigationResult;
    const candidates = (invResult && invResult.candidates) || caseRecord.candidates || [];
    const topCandRaw = (invResult && invResult.topCandidate) || (candidates.length > 0 ? candidates[0] : null);
    const topCandidate = serializeCandidate(topCandRaw, topCandRaw ? 1 : null);

    const suspectWallet = (invResult && invResult.suspect && invResult.suspect.address)
      || (caseRecord.targetWallets && caseRecord.targetWallets[0])
      || null;

    const chain = String((invResult && invResult.suspect && invResult.suspect.chain) || caseRecord.chain || "ETH").toUpperCase();

    const processedTransactions = (invResult && invResult.tracing && invResult.tracing.processedTransactions)
      || (graphResult.metadata ? graphResult.metadata.edgeCount : 0);

    const provenance = serializeProvenance(
      (invResult && invResult.provenance) || (evidence && evidence.provenance) || caseRecord.dataProvenance
    );

    const sahyogActionRepo = repositories.sahyogActionRepository;
    const sahyogActions = await sahyogActionRepo.findByCaseId(caseRecord.caseId);

    const sahyogSection = caseRecord.sahyogRequestId || sahyogActions.length > 0 ? {
      requestId: caseRecord.sahyogRequestId || (sahyogActions.length > 0 ? sahyogActions[0].requestId : null),
      sourceSystem: caseRecord.sourceSystem || 'SAHYOG',
      mode: caseRecord.integrationMode || 'SANDBOX',
      actionCount: sahyogActions.length
    } : null;

    return {
      caseId: caseRecord.caseId,
      status: caseRecord.status || "COMPLETED",
      currentStage: caseRecord.currentStage || "COMPLETED",
      suspect: {
        address: suspectWallet,
        chain: chain.toLowerCase()
      },
      scope: {
        maxDepth: caseRecord.maxDepth || 3,
        maxTransactions: caseRecord.maxTransactions || 100,
        timeWindowHours: caseRecord.timeWindowHours || 72
      },
      startedAt: caseRecord.createdAt || null,
      completedAt: caseRecord.updatedAt || null,
      processedTransactions,
      candidateCount: candidates.length,
      topCandidate: topCandidate ? {
        vasp: topCandidate.vasp ? topCandidate.vasp.name : "Unknown Entity",
        score: topCandidate.overallScore || 0,
        band: topCandidate.band || "INSUFFICIENT_ATTRIBUTION_PATH",
        label: topCandidate.label || "Insufficient Attribution",
        attributionType: topCandidate.vasp ? topCandidate.vasp.attributionType : "UNKNOWN",
        confidence: topCandidate.vasp ? topCandidate.vasp.intelligenceConfidence : 0,
        walletType: topCandidate.vasp ? topCandidate.vasp.walletType : "UNKNOWN",
        destinationAddress: topCandidate.destinationAddress
      } : null,
      attribution: {
        status: topCandidate ? "ATTRIBUTED" : "NO_ATTRIBUTION",
        candidates: candidates.map((c, i) => serializeCandidate(c, i + 1))
      },
      score: topCandidate ? {
        overallScore: topCandidate.overallScore,
        band: topCandidate.band,
        label: topCandidate.label,
        factors: topCandidate.factors,
        explanation: topCandidate.explanation
      } : null,
      graph: {
        nodeCount: graphResult.metadata ? graphResult.metadata.nodeCount : 0,
        edgeCount: graphResult.metadata ? graphResult.metadata.edgeCount : 0
      },
      evidence: {
        count: evidenceBundles ? evidenceBundles.length : 0,
        fingerprint: evidence ? evidence.fingerprintHash : null
      },
      audit: {
        eventCount: auditCount
      },
      sahyog: sahyogSection,
      provenance,
      evidenceFingerprint: evidence ? evidence.fingerprintHash : null,
      analysisVersion: config.analysisVersion || "1.0.0"
    };
  }
}

module.exports = new CaseSummaryService();
