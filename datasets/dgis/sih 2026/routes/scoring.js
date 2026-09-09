const express = require('express');
const router = express.Router();
const scoringService = require('../services/scoringService');
const { scoreCandidate } = require('../intelligence/scoring/scorer');

/**
 * POST /api/v1/scoring
 * Evaluates, scores, and ranks VASP attribution candidates for a given target wallet or trace result.
 */
router.post('/', async (req, res, next) => {
  try {
    const { chain = 'ethereum', startAddress, maxDepth = 5, candidates } = req.body;

    // If direct candidate payloads are provided, score and rank them directly
    if (Array.isArray(candidates) && candidates.length > 0) {
      const scoredCandidates = candidates.map(c => scoreCandidate({
        hopCount: c.hopCount,
        amountContinuity: c.amountContinuity,
        timeProximityScore: c.timeProximityScore,
        timeDifferenceMinutes: c.timeDifferenceMinutes,
        intelligenceConfidence: c.intelligenceConfidence,
        vasp: c.vasp,
        chain: c.chain || chain,
        destinationAddress: c.destinationAddress || c.address,
        sourceType: c.sourceType,
        isSynthetic: c.isSynthetic
      }));

      const ranked = require('../intelligence/scoring/ranker').rankCandidates(scoredCandidates);

      return res.status(200).json({
        success: true,
        chain: String(chain).toLowerCase(),
        totalCandidates: ranked.length,
        topCandidate: ranked[0] || null,
        candidates: ranked
      });
    }

    if (!startAddress) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'startAddress or candidates array is required for scoring'
        }
      });
    }

    const result = await scoringService.analyzeAndScore({
      chain,
      startAddress,
      maxDepth
    });

    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
