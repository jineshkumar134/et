/**
 * services/evidenceService.js
 * Phase 9 — Evidence + Data Provenance + Audit Trail
 *
 * Builds, persists and retrieves complete evidence bundles.
 * Integrates with the existing repository abstraction (memory/mongo).
 */
'use strict';
const repositories = require('../repositories');
const { computeFingerprint, verifyFingerprint } = require('../utils/evidenceFingerprint');
const config = require('../config/config');

const REQUIRED_EVIDENCE_KEYS = [
  'caseId',
  'tracePath',
  'transactionTrail',
  'attributionEvidence',
  'scoring'
];

class EvidenceService {
  /**
   * Builds a complete, structured evidence bundle from investigation result.
   * Does NOT persist yet — caller decides when to persist.
   *
   * @param {Object} investigationResult - full result from investigationService
   * @returns {Object} unsigned evidence bundle (no fingerprintHash yet)
   */
  buildEvidenceBundle(investigationResult) {
    const {
      caseId,
      suspect = {},
      tracing = {},
      fundFlow = {},
      candidates = [],
      topCandidate = null,
      provenance = {}
    } = investigationResult;

    // Build a lean transaction trail from the trace path
    const tracePath = tracing.visitedNodes || [];
    const transactionTrail = (tracing.visitedNodes || []).map((addr, idx) => ({
      step: idx,
      address: addr,
      chain: suspect.chain || 'ethereum'
    }));

    // Attribution evidence from top candidate
    const attributionEvidence = topCandidate
      ? {
          vaspName: topCandidate.vasp ? topCandidate.vasp.name : null,
          vaspId: topCandidate.vasp ? topCandidate.vasp.vaspId : null,
          attributionType: topCandidate.vasp ? topCandidate.vasp.attributionType : null,
          intelligenceConfidence: topCandidate.vasp ? topCandidate.vasp.intelligenceConfidence : null,
          sourceType: topCandidate.vasp ? topCandidate.vasp.sourceType : null
        }
      : {};

    // Scoring evidence — safe shallow copy (no internal engine secrets)
    const scoringEvidence = topCandidate
      ? {
          overallScore: topCandidate.overallScore,
          band: topCandidate.band,
          label: topCandidate.label,
          factors: topCandidate.factors || {},
          explanation: topCandidate.explanation || {}
        }
      : {};

    const bundle = {
      caseId,
      summary: 'Automated BIVAE investigation evidence bundle for case ' + caseId,
      tracePath,
      transactionTrail,
      attributionEvidence,
      fundFlow: {
        relationships: (fundFlow.relationships || []).length,
        summary: fundFlow.summary || {}
      },
      scoring: scoringEvidence,
      topCandidate: topCandidate || null,
      provenance: {
        blockchainSource: provenance.blockchainSource || 'SYNTHETIC_BLOCKCHAIN_DATA',
        attributionSource: provenance.attributionSource || 'VASP_INTELLIGENCE_DATABASE',
        dataMode: provenance.dataMode || 'DEMO',
        generatedAt: provenance.generatedAt || new Date().toISOString()
      },
      analysisVersion: config.analysisVersion || '1.0.0',
      isSynthetic: provenance.isSynthetic !== undefined ? provenance.isSynthetic : true,
      disclaimer:
        'Generated for authorized LEA investigation use only. All data in DEMO mode is synthetic.'
    };

    // Compute and attach deterministic fingerprint
    bundle.fingerprintHash = computeFingerprint(bundle);

    return bundle;
  }

  /**
   * Persists the evidence bundle for a case.
   * Idempotent: if evidence already exists for the caseId, returns existing.
   *
   * @param {string} caseId
   * @param {Object} investigationResult
   * @returns {Promise<Object>} persisted evidence record
   */
  async persistInvestigationEvidence(caseId, investigationResult) {
    const evidenceRepo = repositories.evidenceRepository;

    // Idempotency: check if evidence already stored
    const existing = await evidenceRepo.findLatestByCaseId(caseId);
    if (existing && existing.fingerprintHash) {
      return existing;
    }

    const bundle = this.buildEvidenceBundle(investigationResult);
    const persisted = await evidenceRepo.create(bundle);
    return persisted;
  }

  /**
   * Retrieves all evidence bundles for a case.
   * @param {string} caseId
   * @returns {Promise<Array>}
   */
  async getEvidenceBundle(caseId) {
    if (!caseId) {
      const err = new Error('caseId is required to retrieve evidence');
      err.statusCode = 400;
      throw err;
    }

    const evidenceRepo = repositories.evidenceRepository;
    const records = await evidenceRepo.findByCaseId(caseId);
    return records;
  }

  /**
   * Validates that an evidence bundle contains all required fields.
   * Returns a structured completeness report.
   *
   * @param {Object} bundle
   * @returns {{ complete: boolean, missingFields: string[], presentFields: string[], score: number }}
   */
  validateEvidenceCompleteness(bundle) {
    if (!bundle || typeof bundle !== 'object') {
      return { complete: false, missingFields: REQUIRED_EVIDENCE_KEYS, presentFields: [], score: 0 };
    }

    const missingFields = [];
    const presentFields = [];

    for (const key of REQUIRED_EVIDENCE_KEYS) {
      const val = bundle[key];
      const present =
        val !== undefined &&
        val !== null &&
        !(Array.isArray(val) && val.length === 0 && key !== 'tracePath') &&
        !(typeof val === 'object' && !Array.isArray(val) && Object.keys(val).length === 0 && key !== 'attributionEvidence');

      if (present) {
        presentFields.push(key);
      } else {
        missingFields.push(key);
      }
    }

    // Extra checks
    if (bundle.fingerprintHash && bundle.fingerprintHash.startsWith('sha256:')) {
      presentFields.push('fingerprintHash');
    }
    if (bundle.analysisVersion) {
      presentFields.push('analysisVersion');
    }

    const score = Math.round((presentFields.length / (REQUIRED_EVIDENCE_KEYS.length + 2)) * 100);

    return {
      complete: missingFields.length === 0,
      missingFields,
      presentFields,
      score
    };
  }

  /**
   * Verifies the fingerprint of a stored evidence record.
   * @param {Object} record - stored evidence bundle (must include fingerprintHash)
   * @returns {{ valid: boolean, expected: string, stored: string }}
   */
  verifyEvidenceIntegrity(record) {
    if (!record || !record.fingerprintHash) {
      return { valid: false, expected: null, stored: null };
    }
    return verifyFingerprint(record, record.fingerprintHash);
  }
}

module.exports = new EvidenceService();
