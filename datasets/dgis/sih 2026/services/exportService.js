/**
 * services/exportService.js
 * Phase 10 — Graph API + Investigation Reports + Export
 *
 * Implements JSON, CSV, Graph JSON, and Candidates JSON exports.
 * Uses persisted case/evidence data only — no API keys or credentials exposed.
 * Escapes CSV fields properly.
 */
"use strict";

const repositories = require("../repositories");
const evidenceService = require("./evidenceService");
const graphService = require("./graphService");
const reportService = require("./reportService");
const config = require("../config/config");
const { serializeCandidate, serializeProvenance, safeString, safeDate } = require("../utils/serializers");

/**
 * Escapes a single CSV field value safely according to RFC 4180.
 * Wraps fields containing commas, double quotes, or newlines in double quotes.
 */
function escapeCSV(val) {
  if (val === undefined || val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes("\"") || str.includes("\n") || str.includes("\r")) {
    return "\"" + str.replace(/\"/g, "\"\"") + "\"";
  }
  return str;
}

class ExportService {
  /**
   * Exports full case data as JSON object.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async exportCaseAsJSON(caseId) {
    const report = await reportService.generateInvestigationReport(caseId);
    const caseRepo = repositories.caseRepository;
    const caseRecord = await caseRepo.findByCaseId(caseId);
    const evidenceBundles = await evidenceService.getEvidenceBundle(caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;
    const graphResult = await graphService.buildGraph(caseId);

    return {
      caseId: report.case.caseId,
      exportedAt: new Date().toISOString(),
      analysisVersion: config.analysisVersion || "1.0.0",
      case: report.case,
      investigation: report.investigation,
      attribution: report.attribution,
      candidates: report.attribution.candidates,
      graph: {
        nodeCount: graphResult.nodes.length,
        edgeCount: graphResult.edges.length,
        nodes: graphResult.nodes,
        edges: graphResult.edges
      },
      transactionTrail: graphResult.edges,
      fundFlow: report.fundFlow,
      evidence: evidence ? {
        summary: evidence.summary,
        fingerprintHash: evidence.fingerprintHash,
        analysisVersion: evidence.analysisVersion,
        isSynthetic: evidence.isSynthetic
      } : null,
      provenance: report.provenance,
      audit: report.audit,
      disclaimer: report.disclaimer
    };
  }

  /**
   * Exports transactions as CSV text string.
   * @param {string} caseId
   * @returns {Promise<string>}
   */
  async exportCaseTransactionsAsCSV(caseId) {
    const graphResult = await graphService.buildGraph(caseId);
    const caseRepo = repositories.caseRepository;
    const caseRecord = await caseRepo.findByCaseId(caseId);

    const invResult = caseRecord ? caseRecord.investigationResult : null;
    const relationships = (invResult && invResult.fundFlow && Array.isArray(invResult.fundFlow.relationships))
      ? invResult.fundFlow.relationships
      : [];

    const relMap = new Map();
    for (const r of relationships) {
      if (r.txHash || r.transactionHash) {
        relMap.set(String(r.txHash || r.transactionHash).toLowerCase(), r);
      }
    }

    const headers = [
      "caseId",
      "chain",
      "transactionHash",
      "blockNumber",
      "timestamp",
      "fromAddress",
      "toAddress",
      "asset",
      "tokenContract",
      "amount",
      "depth",
      "pathIndex",
      "fundFlowContinuity",
      "timeDifferenceMinutes",
      "relationship",
      "sourceType"
    ];

    const rows = [headers.join(",")];

    for (const edge of graphResult.edges) {
      const rel = relMap.get(String(edge.transactionHash).toLowerCase()) || {};

      const row = [
        escapeCSV(caseId),
        escapeCSV(edge.chain),
        escapeCSV(edge.transactionHash),
        escapeCSV(edge.blockNumber !== null ? edge.blockNumber : ""),
        escapeCSV(safeDate(edge.timestamp)),
        escapeCSV(edge.from || (edge.source ? edge.source.split(":")[1] : "")),
        escapeCSV(edge.to || (edge.target ? edge.target.split(":")[1] : "")),
        escapeCSV(edge.asset),
        escapeCSV(edge.tokenContract || ""),
        escapeCSV(edge.amount !== null ? edge.amount : ""),
        escapeCSV(edge.depth !== undefined ? edge.depth : ""),
        escapeCSV(edge.pathIndex !== undefined ? edge.pathIndex : ""),
        escapeCSV(rel.amountContinuity !== undefined ? rel.amountContinuity : ""),
        escapeCSV(rel.timeDifferenceMinutes !== undefined ? rel.timeDifferenceMinutes : ""),
        escapeCSV(rel.relationship || ""),
        escapeCSV(rel.sourceType || "SYNTHETIC_DEMO")
      ];

      rows.push(row.join(","));
    }

    return rows.join("\n");
  }

  /**
   * Exports graph data as JSON structure.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async exportCaseGraphAsJSON(caseId) {
    const graphData = await graphService.buildGraph(caseId);
    const evidenceBundles = await evidenceService.getEvidenceBundle(caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;

    return {
      caseId,
      nodes: graphData.nodes,
      edges: graphData.edges,
      highlightedPath: graphData.highlightedPath,
      highlightedEdges: graphData.highlightedEdges,
      metadata: graphData.metadata,
      dataProvenance: graphData.dataProvenance,
      evidenceFingerprint: evidence ? evidence.fingerprintHash : null
    };
  }

  /**
   * Exports candidates list as JSON array with detailed scoring & intelligence.
   * @param {string} caseId
   * @returns {Promise<Object>}
   */
  async exportCaseCandidatesAsJSON(caseId) {
    const caseRepo = repositories.caseRepository;
    const caseRecord = await caseRepo.findByCaseId(caseId);
    if (!caseRecord) {
      const err = new Error("Case not found: " + caseId);
      err.statusCode = 404;
      err.code = "CASE_NOT_FOUND";
      throw err;
    }

    const invResult = caseRecord.investigationResult;
    const rawCandidates = (invResult && invResult.candidates) || caseRecord.candidates || [];
    const evidenceBundles = await evidenceService.getEvidenceBundle(caseId);
    const evidence = evidenceBundles && evidenceBundles.length > 0 ? evidenceBundles[0] : null;

    const serialized = rawCandidates.map((c, i) => serializeCandidate(c, i + 1));

    return {
      caseId,
      candidateCount: serialized.length,
      topCandidate: serialized.length > 0 ? serialized[0] : null,
      candidates: serialized,
      dataProvenance: serializeProvenance(
        (invResult && invResult.provenance) || (evidence && evidence.provenance) || caseRecord.dataProvenance
      ),
      evidenceFingerprint: evidence ? evidence.fingerprintHash : null
    };
  }
}

module.exports = new ExportService();
