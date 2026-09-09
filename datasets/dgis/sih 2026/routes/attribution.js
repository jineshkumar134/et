const express = require('express');
const router = express.Router();
const { z } = require('zod');
const attributionService = require('../services/attributionService');

const attributionRequestSchema = z.object({
  chain: z.string().default('ethereum'),
  address: z.string().min(1, 'address is required')
});

/**
 * POST /api/v1/attribution
 * Perform VASP attribution lookup for a target wallet address
 */
router.post('/', async (req, res, next) => {
  try {
    const parseResult = attributionRequestSchema.safeParse(req.body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      const error = new Error(`Invalid attribution request: ${errorMsg}`);
      error.statusCode = 400;
      error.code = 'BAD_REQUEST';
      return next(error);
    }

    const { chain, address } = parseResult.data;
    const attribution = await attributionService.attributeWallet(chain, address);

    res.status(200).json({
      success: true,
      ...attribution
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
