const express = require('express');
const router = express.Router();
const repositories = require('../repositories');
const attributionService = require('../services/attributionService');

/**
 * GET /api/v1/vasps
 * Returns list of configured VASP intelligence records
 */
router.get('/', async (req, res, next) => {
  try {
    const vaspRepo = repositories.vaspRepository;
    const vasps = await vaspRepo.findAll();

    res.status(200).json({
      success: true,
      count: vasps.length,
      vasps: vasps
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/vasps/:chain/:address
 * Returns VASP attribution information for a specific address
 */
router.get('/:chain/:address', async (req, res, next) => {
  try {
    const { chain, address } = req.params;
    const attribution = await attributionService.attributeWallet(chain, address);

    res.status(200).json({
      success: true,
      attribution: attribution
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
