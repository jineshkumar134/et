const express = require('express');
const router = express.Router();
const { z } = require('zod');
const tracingService = require('../services/tracingService');

const traceRequestSchema = z.object({
  chain: z.string().default('ethereum'),
  startAddress: z.string().min(1, 'startAddress is required'),
  maxDepth: z.coerce.number().int().min(1).max(20).default(5),
  maxTransactions: z.coerce.number().int().min(1).max(1000).default(100),
  timeWindowHours: z.coerce.number().min(0).max(8760).default(24)
});

/**
 * POST /api/v1/tracing
 * Execute multi-hop wallet tracing from a starting suspect address
 */
router.post('/', async (req, res, next) => {
  try {
    const parseResult = traceRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      const error = new Error(`Invalid tracing parameters: ${errorMsg}`);
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    const { chain, startAddress, maxDepth, maxTransactions, timeWindowHours } = parseResult.data;

    const traceResult = await tracingService.traceWallet({
      chain,
      startAddress,
      maxDepth,
      maxTransactions,
      timeWindowHours
    });

    res.status(200).json({
      success: true,
      trace: traceResult
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
