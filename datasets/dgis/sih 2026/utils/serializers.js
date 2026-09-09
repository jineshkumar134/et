/**
 * utils/serializers.js
 * Phase 10 — Graph API + Investigation Reports + Export
 *
 * Reusable, data-minimizing serializers.
 * Never exposes DB internals, secrets, or raw Mongoose documents.
 */
'use strict';

/**
 * Safely converts any value to a JSON-safe string.
 * Handles BigInt (blockchain amounts), undefined, and circular refs.
 */
function safeString(val) {
  if (val === undefined || val === null) return null;
  if (typeof val === 'bigint') return val.toString();
  return String(val);
}

/**
 * Safely converts to ISO date string.
 */
function safeDate(val) {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch {
    return null;
  }
}

/**
 * Serializes a Case record for external output.
 * Strips DB internals (_id, __v, raw Mongoose fields).
 */
function serializeCase(record) {
  if (!record) return null;
  return {
    caseId: safeString(record.caseId),
    title: safeString(record.title),
    status: safeString(record.status),
    currentStage: safeString(record.currentStage),
    investigatorId: safeString(record.investigatorId),
    targetWallets: Array.isArray(record.targetWallets) ? record.targetWallets.map(safeString) : [],
    chain: safeString(record.chain),
    maxDepth: record.maxDepth !== undefined ? Number(record.maxDepth) : null,
    maxTransactions: record.maxTransactions !== undefined ? Number(record.maxTransactions) : null,
    timeWindowHours: record.timeWindowHours !== undefined ? Number(record.timeWindowHours) : null,
    candidateCount: record.candidateCount !== undefined ? Number(record.candidateCount) : 0,
    createdAt: safeDate(record.createdAt),
    updatedAt: safeDate(record.updatedAt)
  };
}

/**
 * Serializes a single attribution candidate for external output.
 */
function serializeCandidate(candidate, rank) {
  if (!candidate) return null;
  const vasp = candidate.vasp || {};
  return {
    rank: rank !== undefined ? rank : null,
    destinationAddress: safeString(candidate.destinationAddress),
    chain: safeString(candidate.chain),
    overallScore: candidate.overallScore !== undefined ? Number(candidate.overallScore) : null,
    band: safeString(candidate.band),
    label: safeString(candidate.label),
    factors: candidate.factors
      ? {
          hopScore: candidate.factors.hopScore !== undefined ? Number(candidate.factors.hopScore) : null,
          fundFlowScore: candidate.factors.fundFlowScore !== undefined ? Number(candidate.factors.fundFlowScore) : null,
          timeScore: candidate.factors.timeScore !== undefined ? Number(candidate.factors.timeScore) : null,
          attributionScore: candidate.factors.attributionScore !== undefined ? Number(candidate.factors.attributionScore) : null
        }
      : null,
    explanation: candidate.explanation || null,
    vasp: {
      name: safeString(vasp.name),
      vaspId: safeString(vasp.vaspId),
      attributionType: safeString(vasp.attributionType),
      walletType: safeString(vasp.walletType),
      intelligenceConfidence: vasp.intelligenceConfidence !== undefined ? Number(vasp.intelligenceConfidence) : null,
      sourceType: safeString(vasp.sourceType)
    },
    sourceType: safeString(candidate.sourceType),
    isSynthetic: candidate.isSynthetic !== undefined ? Boolean(candidate.isSynthetic) : true
  };
}

/**
 * Serializes a transaction trail step for external output.
 */
function serializeTransaction(tx) {
  if (!tx) return null;
  return {
    step: tx.step !== undefined ? Number(tx.step) : null,
    hash: safeString(tx.hash || tx.txHash),
    from: safeString(tx.from),
    to: safeString(tx.to),
    address: safeString(tx.address),
    chain: safeString(tx.chain),
    asset: safeString(tx.asset),
    tokenContract: safeString(tx.tokenContract),
    // Keep amount as string to preserve blockchain precision
    amount: tx.amount !== undefined ? safeString(tx.amount) : null,
    blockNumber: tx.blockNumber !== undefined ? Number(tx.blockNumber) : null,
    timestamp: safeDate(tx.timestamp),
    depth: tx.depth !== undefined ? Number(tx.depth) : null,
    pathIndex: tx.pathIndex !== undefined ? Number(tx.pathIndex) : null,
    dataSource: safeString(tx.dataSource),
    isSynthetic: tx.isSynthetic !== undefined ? Boolean(tx.isSynthetic) : null
  };
}

/**
 * Serializes an evidence bundle for external output.
 */
function serializeEvidence(record) {
  if (!record) return null;
  return {
    caseId: safeString(record.caseId),
    summary: safeString(record.summary),
    fingerprintHash: safeString(record.fingerprintHash),
    analysisVersion: safeString(record.analysisVersion),
    isSynthetic: record.isSynthetic !== undefined ? Boolean(record.isSynthetic) : true,
    tracePath: Array.isArray(record.tracePath) ? record.tracePath.map(safeString) : [],
    transactionTrailCount: Array.isArray(record.transactionTrail) ? record.transactionTrail.length : 0,
    disclaimer: safeString(record.disclaimer),
    createdAt: safeDate(record.createdAt)
  };
}

/**
 * Serializes a provenance record for external output.
 */
function serializeProvenance(provenance) {
  if (!provenance) return null;
  return {
    blockchainSource: safeString(provenance.blockchainSource || 'SYNTHETIC_BLOCKCHAIN_DATA'),
    attributionSource: safeString(provenance.attributionSource || 'VASP_INTELLIGENCE_DATABASE'),
    dataMode: safeString(provenance.dataMode || 'DEMO'),
    isSynthetic: provenance.isSynthetic !== undefined ? Boolean(provenance.isSynthetic) : true,
    generatedAt: safeDate(provenance.generatedAt) || new Date().toISOString()
  };
}

module.exports = {
  safeString,
  safeDate,
  serializeCase,
  serializeCandidate,
  serializeTransaction,
  serializeEvidence,
  serializeProvenance
};
