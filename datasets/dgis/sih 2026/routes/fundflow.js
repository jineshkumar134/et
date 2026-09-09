const express = require('express');
const router = express.Router();
const { z } = require('zod');
const fundFlowService = require('../services/fundFlowService');

const fundFlowRequestSchema = z.object({
  chain: z.string().default('ethereum'),
  startAddress: z.string().min(1, 'startAddress is required'),
  maxDepth: z.coerce.number().int().min(1).max(20).default(5),
  maxTransactions: z.coerce.number().int().min(1).max(1000).default(100),
  timeWindowHours: z.coerce.number().min(0).max(8760).default(24)
});

/**
 * POST /api/v1/fund-flow/analyze
 * Analyze fund-flow relationship intelligence across multi-hop wallet transactions
 */
router.post('/analyze', async (req, res, next) => {
  try {
    const parseResult = fundFlowRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      const error = new Error(`Invalid fund-flow parameters: ${errorMsg}`);
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    const { chain, startAddress, maxDepth, maxTransactions, timeWindowHours } = parseResult.data;

    const fundFlowResult = await fundFlowService.analyzeFundFlow({
      chain,
      startAddress,
      maxDepth,
      maxTransactions,
      timeWindowHours
    });

    res.status(200).json({
      success: true,
      fundFlow: fundFlowResult
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
