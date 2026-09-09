const express = require('express');
const router = express.Router();
const blockchainService = require('../services/blockchainService');
const walletIntelligenceService = require('../services/walletIntelligenceService');

/**
 * GET /api/v1/wallets/:chain/:address/transactions
 * Retrieve normalized transactions for a specific wallet address
 */
router.get('/:chain/:address/transactions', async (req, res, next) => {
  try {
    const { chain, address } = req.params;
    const normalizedTransactions = await blockchainService.getNormalizedTransactions(chain, address);

    res.status(200).json({
      success: true,
      chain: chain.toLowerCase(),
      address: address.toLowerCase(),
      dataSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
      count: normalizedTransactions.length,
      transactions: normalizedTransactions
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/wallets/:chain/:address/intelligence
 * Retrieve wallet intelligence metadata for a specific address
 */
router.get('/:chain/:address/intelligence', async (req, res, next) => {
  try {
    const { chain, address } = req.params;
    const intelligence = await walletIntelligenceService.getWalletIntelligence(chain, address);

    res.status(200).json({
      success: true,
      intelligence: intelligence
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
