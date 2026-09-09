/**
 * routes/evidence.js
 * Phase 9 — Evidence + Data Provenance + Audit Trail
 *
 * GET /api/v1/cases/:caseId/evidence    — retrieve evidence bundles
 * GET /api/v1/cases/:caseId/audit       — retrieve audit trail
 * GET /api/v1/cases/:caseId/provenance  — retrieve data provenance summary
 */
'use strict';
const express = require('express');
const router = express.Router({ mergeParams: true });

const evidenceService = require('../services/evidenceService');
const repositories = require('../repositories');
const config = require('../config/config');

/**
 * GET /api/v1/cases/:caseId/evidence
 * Returns all evidence bundles for the given case.
 */
router.get('/', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const bundles = await evidenceService.getEvidenceBundle(caseId);

    if (!bundles || bundles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No evidence found for caseId: ' + caseId,
        caseId
      });
    }

    // Attach completeness report to each bundle
    const enriched = bundles.map((b) => ({
      ...b,
      completeness: evidenceService.validateEvidenceCompleteness(b)
    }));

    return res.status(200).json({
      success: true,
      caseId,
      count: enriched.length,
      evidence: enriched
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/audit
 * Returns chronological audit trail for the given case.
 */
router.get('/audit', async (req, res, next) => {
  try {
    const { caseId } = req.params;
    if (!caseId) {
      return res.status(400).json({ success: false, message: 'caseId is required' });
    }

    const auditRepo = repositories.auditRepository;
    const logs = await auditRepo.findByCaseId(caseId);
    const count = await auditRepo.countByCaseId(caseId);

    return res.status(200).json({
      success: true,
      caseId,
      count,
      auditTrail: logs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/provenance
 * Returns a concise data provenance summary for the case.
 */
router.get('/provenance', async (req, res, next) => {
  try {
    const { caseId } = req.params;

    // Fetch evidence bundle for provenance data
    const bundles = await evidenceService.getEvidenceBundle(caseId);
    const latest = bundles && bundles.length > 0 ? bundles[0] : null;

    if (!latest) {
      return res.status(404).json({
        success: false,
        message: 'No provenance data found for caseId: ' + caseId,
        caseId
      });
    }

    const provenance = {
      caseId,
      analysisVersion: latest.analysisVersion || config.analysisVersion || '1.0.0',
      isSynthetic: latest.isSynthetic !== undefined ? latest.isSynthetic : true,
      dataMode: (latest.provenance && latest.provenance.dataMode) || 'DEMO',
      blockchainSource: (latest.provenance && latest.provenance.blockchainSource) || 'SYNTHETIC_BLOCKCHAIN_DATA',
      attributionSource: (latest.provenance && latest.provenance.attributionSource) || 'VASP_INTELLIGENCE_DATABASE',
      generatedAt: (latest.provenance && latest.provenance.generatedAt) || latest.createdAt,
      fingerprintHash: latest.fingerprintHash || null,
      integrityVerification: latest.fingerprintHash
        ? evidenceService.verifyEvidenceIntegrity(latest)
        : { valid: false, expected: null, stored: null },
      disclaimer: latest.disclaimer || 'Generated for authorized LEA investigation use only. All data in DEMO mode is synthetic.'
    };

    return res.status(200).json({
      success: true,
      provenance
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
