const express = require('express');
const router = express.Router();
const investigationService = require('../services/investigationService');

/**
 * POST /api/v1/investigations
 * Initiates an end-to-end BIVAE investigation for a suspect wallet address.
 */
router.post('/', async (req, res, next) => {
  try {
    const result = await investigationService.investigateWallet(req.body);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/investigations/:caseId
 * Retrieves full investigation result for a case.
 */
router.get('/:caseId', async (req, res, next) => {
  try {
    const result = await investigationService.getInvestigationByCaseId(req.params.caseId);
    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/investigations/:caseId/summary
 * Retrieves lightweight investigation summary for a case.
 */
router.get('/:caseId/summary', async (req, res, next) => {
  try {
    const summary = await investigationService.getInvestigationSummary(req.params.caseId);
    return res.status(200).json({
      success: true,
      summary
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
