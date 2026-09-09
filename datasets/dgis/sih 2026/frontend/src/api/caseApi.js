// src/api/caseApi.js
import client from './client';

/**
 * GET /api/v1/cases/:caseId/summary
 * Returns a flat object: { success, caseId, status, currentStage, suspect, scope,
 *   startedAt, completedAt, processedTransactions, candidateCount, topCandidate, ... }
 * (topCandidate here is a lightweight shape: { vasp, score, band, label, attributionType, ... })
 */
export async function getCaseSummary(caseId) {
  const res = await client.get(`/cases/${caseId}/summary`);
  return res.data; // Whole flat response object
}

/**
 * GET /api/v1/cases/:caseId/graph
 * Returns: { success, caseId, graph: { nodes, edges }, highlightedPath, highlightedEdges, metadata, dataProvenance }
 * Node shape: { id, address, chain, label, nodeType, entityName, confidence, isSuspect, isVasp, ... }
 * Edge shape: { id, source, target, label, amount, asset, ... }
 */
export async function getCaseGraph(caseId) {
  const res = await client.get(`/cases/${caseId}/graph`);
  return res.data;
}

/**
 * GET /api/v1/cases/:caseId/report
 * Returns: { success, report: { reportType, case, investigation, attribution, fundFlow, graph, evidence, audit, provenance, ... } }
 */
export async function getCaseReport(caseId) {
  const res = await client.get(`/cases/${caseId}/report`);
  return res.data;
}

/**
 * GET /api/v1/cases/:caseId/evidence
 * Returns: { success, caseId, count, evidence: [...bundles] }
 * Each bundle: { caseId, summary, fingerprintHash, analysisVersion, isSynthetic, ... }
 */
export async function getCaseEvidence(caseId) {
  const res = await client.get(`/cases/${caseId}/evidence`);
  return res.data;
}

/**
 * GET /api/v1/cases/:caseId/evidence/audit
 * Returns: { success, caseId, count, auditTrail: [...entries] }
 */
export async function getCaseAudit(caseId) {
  const res = await client.get(`/cases/${caseId}/evidence/audit`);
  return res.data;
}

/**
 * GET /api/v1/investigations/:caseId
 * Returns full investigation result: { success, data: { caseId, status, suspect, candidates, topCandidate, ... } }
 */
export async function getFullInvestigation(caseId) {
  const res = await client.get(`/investigations/${caseId}`);
  return res.data?.data || res.data;
}

/** Download URLs (browser-native download, no axios) */
export function exportJsonUrl(caseId)        { return `/api/v1/cases/${caseId}/export/json`; }
export function exportCsvUrl(caseId)         { return `/api/v1/cases/${caseId}/export/transactions.csv`; }
export function exportGraphUrl(caseId)       { return `/api/v1/cases/${caseId}/export/graph.json`; }
export function exportCandidatesUrl(caseId)  { return `/api/v1/cases/${caseId}/export/candidates.json`; }
