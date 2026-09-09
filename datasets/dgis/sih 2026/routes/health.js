const express = require('express');
const router = express.Router();
const config = require('../config/config');
const { getDbStatus } = require('../config/db');

/**
 * GET /api/v1/health
 * Public health check endpoint reporting service status
 */
router.get('/health', (req, res) => {
  const dbStatus = getDbStatus();
  const isMockBlockchain = config.dataSource === 'mock' || config.enableMockBlockchain;
  const blockchainMode = isMockBlockchain ? 'MOCK' : 'REAL';
  const dbHealthStatus = dbStatus === 'CONNECTED' ? 'UP' : (dbStatus === 'MOCK' ? 'MOCK' : 'DOWN');

  res.status(200).json({
    success: true,
    status: 'HEALTHY',
    timestamp: new Date().toISOString(),
    database: {
      status: dbHealthStatus
    },
    blockchain: {
      status: 'UP',
      mode: blockchainMode
    },
    services: {
      api: 'UP',
      database: dbStatus,
      blockchain: blockchainMode,
      vaspIntelligence: 'UP',
      sahyog: 'UP'
    }
  });
});

module.exports = router;
