/**
 * utils/evidenceFingerprint.js
 * Phase 9 — Evidence + Data Provenance + Audit Trail
 *
 * Produces a deterministic SHA-256 fingerprint of an evidence bundle.
 * Keys are sorted before hashing so identical logical bundles always
 * produce the same hash regardless of insertion order.
 *
 * No secrets are included in the fingerprint payload.
 */
'use strict';
const crypto = require('crypto');

/**
 * Recursively sorts all object keys so the serialized form is canonical.
 * Arrays are preserved in order (trace path order matters).
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    Object.keys(value).sort().forEach((k) => { sorted[k] = sortKeys(value[k]); });
    return sorted;
  }
  return value;
}

/**
 * Builds the canonical fingerprint payload.
 * Volatile fields (_id, createdAt, updatedAt, timestamp) are excluded.
 */
function buildCanonicalPayload(bundle) {
  const payload = {
    caseId: bundle.caseId,
    analysisVersion: bundle.analysisVersion || '1.0.0',
    isSynthetic: bundle.isSynthetic !== undefined ? bundle.isSynthetic : true,
    tracePath: bundle.tracePath || [],
    transactionTrail: (bundle.transactionTrail || []).map((tx) => ({
      hash: tx.hash || tx.txHash || null,
      from: tx.from || null,
      to: tx.to || null,
      value: tx.value !== undefined ? String(tx.value) : null,
      asset: tx.asset || null,
      chain: tx.chain || null,
      blockNumber: tx.blockNumber !== undefined ? tx.blockNumber : null
    })),
    attributionEvidence: bundle.attributionEvidence || {},
    scoring: bundle.scoring || {},
    provenance: {
      blockchainSource: (bundle.provenance && bundle.provenance.blockchainSource) || 'SYNTHETIC_BLOCKCHAIN_DATA',
      attributionSource: (bundle.provenance && bundle.provenance.attributionSource) || 'VASP_INTELLIGENCE_DATABASE',
      dataMode: (bundle.provenance && bundle.provenance.dataMode) || 'DEMO'
    }
  };
  return JSON.stringify(sortKeys(payload));
}

/**
 * Computes the SHA-256 fingerprint of an evidence bundle.
 * @returns {string} 'sha256:<hex>'
 */
function computeFingerprint(bundle) {
  const canonical = buildCanonicalPayload(bundle);
  const hash = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
  return 'sha256:' + hash;
}

/**
 * Verifies a stored hash against the bundle.
 * @returns {{ valid: boolean, expected: string, stored: string }}
 */
function verifyFingerprint(bundle, storedHash) {
  const expected = computeFingerprint(bundle);
  return { valid: expected === storedHash, expected, stored: storedHash };
}

module.exports = { computeFingerprint, verifyFingerprint, buildCanonicalPayload, sortKeys };
