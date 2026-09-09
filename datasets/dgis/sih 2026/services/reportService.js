/**
 * services/reportService.js
 * Phase 10 — Graph API + Investigation Reports + Export
 *
 * Generates structured investigation reports from persisted case data.
 * Never reruns blockchain tracing or BFS.
 * Uses careful investigative language.
 */
"use strict";

const repositories = require("../repositories");
const evidenceService = require("./evidenceService");
const graphService = require("./graphService");
const config = require("../config/config");
const { serializeCandidate, serializeProvenance } = require("../utils/serializers");

const REPORT_VERSION = "1.0.0";

class ReportService {
  /**
   * Generates a structured JSON investigation report for a case.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async generateInvestigationReport(caseId) {
    if (!caseId) {
      const err = new Error("caseId is required");
      err.statusCode = 400;
      throw err;
    }

    const caseRepo = repositories.caseRepository;
    const auditRepo = repositories.auditRepository;

    const caseRecord = await caseRepo.findByCaseId(caseId);
    if (!caseRecord) {
      const err = new Error("Case not found: " + caseId);
      err.statusCode = 404;
      err.code = "CASE_NOT_FOUND";
      throw err;
    }

    const evidenceBundles = await evidenceService.getEvidenceBundle(caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;

    const auditLogs = await auditRepo.findByCaseId(caseId);
    const graphResult = await graphService.buildGraph(caseId);

    const invResult = caseRecord.investigationResult;
    const candidates = (invResult && invResult.candidates) || caseRecord.candidates || [];
    const topCandRaw = (invResult && invResult.topCandidate) || (candidates.length > 0 ? candidates[0] : null);
    const topCandidate = serializeCandidate(topCandRaw, topCandRaw ? 1 : null);

    const suspectWallet = (invResult && invResult.suspect && invResult.suspect.address)
      || (caseRecord.targetWallets && caseRecord.targetWallets[0])
      || null;

    const chain = String((invResult && invResult.suspect && invResult.suspect.chain) || caseRecord.chain || "ETH").toLowerCase();

    const processedTransactions = (invResult && invResult.tracing && invResult.tracing.processedTransactions)
      || (graphResult.metadata ? graphResult.metadata.edgeCount : 0);

    const provenance = serializeProvenance(
      (invResult && invResult.provenance) || (evidence && evidence.provenance) || caseRecord.dataProvenance
    );

    // Build audit summary
    const auditSummary = {
      eventCount: auditLogs.length,
      firstEvent: auditLogs.length > 0 ? auditLogs[0].timestamp || auditLogs[0].createdAt : null,
      lastEvent: auditLogs.length > 0 ? auditLogs[auditLogs.length - 1].timestamp || auditLogs[auditLogs.length - 1].createdAt : null,
      status: caseRecord.status || "COMPLETED"
    };

    // Build limitations list
    const limitations = [];
    if (provenance.isSynthetic) {
      limitations.push("This report contains synthetic/demo blockchain and/or attribution data and must not be interpreted as real-world attribution evidence.");
    }
    limitations.push("The investigation is limited to the configured blockchain data provider and investigation scope.");

    if (!topCandidate) {
      limitations.push("No known VASP attribution was identified within the configured investigation scope.");
    } else if (topCandidate.vasp && topCandidate.vasp.walletType === "CLUSTER_WALLET") {
      limitations.push("The VASP attribution is cluster-based and should be interpreted according to the confidence and source information provided.");
    }

    // Build fund-flow section
    const fundFlowData = invResult && invResult.fundFlow ? invResult.fundFlow : {};
    const tracePath = (invResult && invResult.tracing && invResult.tracing.visitedNodes)
      || (evidence ? evidence.tracePath || [] : []);

    const serializedCandidates = candidates.map((c, i) => serializeCandidate(c, i + 1));

    return {
      reportType: "BLOCKCHAIN_VASP_INVESTIGATION",
      reportVersion: REPORT_VERSION,
      generatedAt: new Date().toISOString(),

      case: {
        caseId: caseRecord.caseId,
        title: caseRecord.title || ("Investigation for " + caseRecord.caseId),
        status: caseRecord.status || "COMPLETED",
        investigatorId: caseRecord.investigatorId || "LEA_OFFICER_DEFAULT"
      },

      investigation: {
        suspectWallet,
        chain,
        scope: {
          maxDepth: caseRecord.maxDepth || 3,
          maxTransactions: caseRecord.maxTransactions || 100,
          timeWindowHours: caseRecord.timeWindowHours || 72
        },
        processedTransactions
      },

      attribution: {
        status: topCandidate ? "FOUND" : "NOT_FOUND",
        candidatesCount: candidates.length,
        topCandidate: topCandidate ? {
          statement: "Highest-ranked VASP candidate identified based on analytical signals.",
          candidate: topCandidate
        } : null,
        candidates: serializedCandidates
      },

      fundFlow: {
        path: tracePath,
        relationshipsCount: (fundFlowData.relationships || []).length,
        summary: fundFlowData.summary || {}
      },

      graph: {
        nodeCount: graphResult.metadata ? graphResult.metadata.nodeCount : 0,
        edgeCount: graphResult.metadata ? graphResult.metadata.edgeCount : 0
      },

      evidence: {
        count: evidenceBundles ? evidenceBundles.length : 0,
        fingerprint: evidence ? evidence.fingerprintHash : null
      },

      audit: auditSummary,

      provenance,

      limitations,

      disclaimer: {
        legalNotice: "Generated for authorized LEA investigation use only. Intelligence findings represent analytical likelihood based on available data and do not constitute absolute proof of ownership or criminal liability.",
        isDemo: provenance.isSynthetic
      }
    };
  }
}

module.exports = new ReportService();
