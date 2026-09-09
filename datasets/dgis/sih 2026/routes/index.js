const express = require('express');
const router = express.Router();

const healthRoutes = require('./health');
const walletRoutes = require('./wallets');
const tracingRoutes = require('./tracing');
const fundFlowRoutes = require('./fundflow');
const vaspRoutes = require('./vasp');
const attributionRoutes = require('./attribution');
const scoringRoutes = require('./scoring');
const investigationRoutes = require('./investigations');
const evidenceRoutes = require('./evidence');
const caseRoutes = require('./case');
const sahyogRoutes = require('./sahyog');

// Mount health routes
router.use('/', healthRoutes);

// Mount wallet routes
router.use('/wallets', walletRoutes);

// Mount tracing routes
router.use('/tracing', tracingRoutes);

// Mount fund-flow routes
router.use('/fund-flow', fundFlowRoutes);

// Mount VASP intelligence routes
router.use('/vasps', vaspRoutes);

// Mount attribution routes
router.use('/attribution', attributionRoutes);

// Mount explainable scoring routes
router.use('/scoring', scoringRoutes);

// Mount end-to-end investigation orchestrator routes
router.use('/investigations', investigationRoutes);

// Phase 9: Mount evidence, audit and provenance routes
router.use('/cases/:caseId/evidence', evidenceRoutes);

// Phase 11: Mount SAHYOG-compatible sandbox integration routes
router.use('/sahyog', sahyogRoutes);

// Phase 10: Mount graph API, case summary, reports and exports
router.use('/cases/:caseId', caseRoutes);

module.exports = router;

