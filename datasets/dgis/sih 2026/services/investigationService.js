const repositories = require('../repositories');
const tracingService = require('./tracingService');
const fundFlowService = require('./fundFlowService');
const scoringService = require('./scoringService');
const evidenceService = require('./evidenceService');

const STAGES = {
  CASE_CREATION: 'CASE_CREATION',
  BLOCKCHAIN_ACQUISITION: 'BLOCKCHAIN_ACQUISITION',
  TRACING: 'TRACING',
  FUND_FLOW_ANALYSIS: 'FUND_FLOW_ANALYSIS',
  WALLET_INTELLIGENCE: 'WALLET_INTELLIGENCE',
  VASP_ATTRIBUTION: 'VASP_ATTRIBUTION',
  SCORING: 'SCORING',
  RANKING: 'RANKING',
  PERSISTENCE: 'PERSISTENCE',
  COMPLETED: 'COMPLETED'
};

class InvestigationService {
  /**
   * Phase 9: Internal helper — writes an audit log entry without throwing.
   * Silently catches errors so audit logging never breaks the pipeline.
   */
  async _logAudit(caseId, action, opts = {}) {
    try {
      const auditRepo = repositories.auditRepository;
      await auditRepo.create({
        caseId,
        action,
        stage: opts.stage || null,
        actor: opts.actor || 'INVESTIGATION_SERVICE',
        durationMs: opts.durationMs !== undefined ? opts.durationMs : null,
        timestamp: new Date(),
        metadata: opts.metadata || {}
      });
    } catch (auditErr) {
      // Never let audit logging crash the main pipeline
      console.warn(`[Audit] Failed to write audit log (action=${action}):`, auditErr.message);
    }
  }

  /**
   * Validates input parameters for a new investigation
   * @param {Object} params
   */
  validateInput(params = {}) {
    const { walletAddress, chain, maxDepth, maxTransactions, timeWindowHours } = params;

    if (!walletAddress || typeof walletAddress !== 'string') {
      const err = new Error('walletAddress is required and must be a string');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const trimmedAddr = walletAddress.trim();

    // Security Check: Reject private keys or seed phrases
    if (trimmedAddr.includes(' ') && trimmedAddr.split(' ').length >= 12) {
      const err = new Error('Security Violation: Seed phrases or mnemonic words are strictly forbidden');
      err.statusCode = 400;
      err.code = 'SECURITY_ERROR';
      throw err;
    }
    // Reject 64-hex private key strings (without 0x) or 66-hex strings that represent private keys without public address format
    if (/^[0-9a-fA-F]{64}$/.test(trimmedAddr)) {
      const err = new Error('Security Violation: Private keys are strictly forbidden. Only public wallet addresses are allowed.');
      err.statusCode = 400;
      err.code = 'SECURITY_ERROR';
      throw err;
    }

    // Validate EVM public address format (0x followed by 40 hex chars) or generic public address
    const isEvm = /^0x[0-9a-fA-F]{40}$/.test(trimmedAddr);
    const isBtc = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(trimmedAddr);
    if (!isEvm && !isBtc && trimmedAddr.length < 26) {
      const err = new Error(`Invalid public wallet address format: ${walletAddress}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // Validate chain
    const supportedChains = ['ETHEREUM', 'ETH', 'BITCOIN', 'BTC', 'POLYGON', 'ARBITRUM', 'OPTIMISM'];
    const normChain = String(chain || 'ETH').toUpperCase().trim();
    if (!supportedChains.includes(normChain)) {
      const err = new Error(`Unsupported blockchain network: ${chain}`);
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // Validate traversal parameters
    if (maxDepth !== undefined) {
      const depth = Number(maxDepth);
      if (isNaN(depth) || depth < 1 || depth > 10) {
        const err = new Error('maxDepth must be an integer between 1 and 10');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    if (maxTransactions !== undefined) {
      const txs = Number(maxTransactions);
      if (isNaN(txs) || txs < 1 || txs > 1000) {
        const err = new Error('maxTransactions must be an integer between 1 and 1000');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    if (timeWindowHours !== undefined) {
      const hours = Number(timeWindowHours);
      if (isNaN(hours) || hours <= 0) {
        const err = new Error('timeWindowHours must be a positive number greater than 0');
        err.statusCode = 400;
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }
  }

  /**
   * Coordinates the end-to-end investigation workflow
   * @param {Object} options - Investigation request payload
   * @returns {Promise<Object>} Complete structured investigation result
   */
  async investigateWallet(options = {}) {
    // 1. Validate Input
    this.validateInput(options);

    const chain = String(options.chain || 'ethereum').toLowerCase();
    const walletAddress = String(options.walletAddress).trim().toLowerCase();
    const maxDepth = options.maxDepth ? Number(options.maxDepth) : 5;
    const maxTransactions = options.maxTransactions ? Number(options.maxTransactions) : 100;
    const timeWindowHours = options.timeWindowHours ? Number(options.timeWindowHours) : 24;

    const caseRepo = repositories.caseRepository;
    const caseId = options.caseId || `CASE_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let currentStage = STAGES.CASE_CREATION;
    let existingCase = null;

    try {
      // 2. Case Creation & Duplicate handling
      existingCase = await caseRepo.findByCaseId(caseId);
      if (existingCase) {
        if (existingCase.status === 'RUNNING') {
          const err = new Error(`Investigation for case ${caseId} is currently running`);
          err.statusCode = 409;
          err.code = 'DUPLICATE_RUNNING_CASE';
          throw err;
        }
        if (existingCase.status === 'COMPLETED' && existingCase.investigationResult) {
          console.log(`[Investigation] Returning existing completed investigation for caseId=${caseId}`);
          return existingCase.investigationResult;
        }
      }

      console.log(`[Investigation] Starting end-to-end investigation caseId=${caseId} for wallet=${walletAddress}`);

      // Create or update case status to RUNNING
      if (!existingCase) {
        await caseRepo.create({
          caseId,
          title: options.caseTitle || `Investigation for ${walletAddress.slice(0, 10)}...`,
          investigatorId: options.investigatorId || 'LEA_OFFICER_DEFAULT',
          targetWallets: [walletAddress],
          chain: chain.toUpperCase(),
          maxDepth,
          maxTransactions,
          timeWindowHours,
          status: 'RUNNING',
          currentStage: STAGES.CASE_CREATION
        });
      } else {
        await caseRepo.update(caseId, {
          status: 'RUNNING',
          currentStage: STAGES.CASE_CREATION
        });
      }

      // Phase 9: Audit — investigation started
      await this._logAudit(caseId, 'CASE_CREATED', {
        stage: STAGES.CASE_CREATION,
        metadata: { walletAddress, chain, maxDepth }
      });
      await this._logAudit(caseId, 'INVESTIGATION_STARTED', {
        stage: STAGES.CASE_CREATION,
        metadata: { caseId, investigatorId: options.investigatorId || 'LEA_OFFICER_DEFAULT' }
      });

      // 3. Stage: TRACING
      currentStage = STAGES.TRACING;
      await caseRepo.update(caseId, { currentStage: STAGES.TRACING });
      console.log(`[Investigation] [Stage: ${STAGES.TRACING}] Tracing transactions...`);

      const t0Trace = Date.now();
      await this._logAudit(caseId, 'STAGE_STARTED', { stage: STAGES.TRACING });

      const traceResult = await tracingService.traceWallet({
        chain,
        startAddress: walletAddress,
        maxDepth,
        maxTransactions,
        timeWindowHours
      });

      const traceDuration = Date.now() - t0Trace;
      await this._logAudit(caseId, 'TRACE_EXECUTED', {
        stage: STAGES.TRACING,
        durationMs: traceDuration,
        metadata: {
          visitedNodes: (traceResult.visitedNodes || []).length,
          paths: traceResult.paths ? traceResult.paths.length : 0
        }
      });
      await this._logAudit(caseId, 'STAGE_COMPLETED', {
        stage: STAGES.TRACING,
        durationMs: traceDuration
      });

      // 4. Stage: FUND_FLOW_ANALYSIS
      currentStage = STAGES.FUND_FLOW_ANALYSIS;
      await caseRepo.update(caseId, { currentStage: STAGES.FUND_FLOW_ANALYSIS });
      console.log(`[Investigation] [Stage: ${STAGES.FUND_FLOW_ANALYSIS}] Analyzing fund flows...`);

      const t0FundFlow = Date.now();
      await this._logAudit(caseId, 'STAGE_STARTED', { stage: STAGES.FUND_FLOW_ANALYSIS });

      const fundFlowResult = fundFlowService.analyzeTraceResult(traceResult);

      const fundFlowDuration = Date.now() - t0FundFlow;
      await this._logAudit(caseId, 'FUND_FLOW_ANALYZED', {
        stage: STAGES.FUND_FLOW_ANALYSIS,
        durationMs: fundFlowDuration,
        metadata: { relationships: (fundFlowResult.relationships || []).length }
      });
      await this._logAudit(caseId, 'STAGE_COMPLETED', {
        stage: STAGES.FUND_FLOW_ANALYSIS,
        durationMs: fundFlowDuration
      });

      // 5–8. Stage: WALLET_INTELLIGENCE + VASP_ATTRIBUTION + SCORING + RANKING
      currentStage = STAGES.SCORING;
      await caseRepo.update(caseId, { currentStage: STAGES.SCORING });
      console.log(`[Investigation] [Stage: ${STAGES.SCORING}] Executing attribution, scoring & ranking...`);

      const t0Score = Date.now();
      await this._logAudit(caseId, 'STAGE_STARTED', { stage: STAGES.SCORING });

      const scoringResult = await scoringService.analyzeAndScore({
        chain,
        startAddress: walletAddress,
        maxDepth
      });

      const scoreDuration = Date.now() - t0Score;
      const candidates = scoringResult.candidates || [];
      const topCandidate = scoringResult.topCandidate || candidates[0] || null;

      await this._logAudit(caseId, 'ATTRIBUTION_COMPLETED', {
        stage: STAGES.VASP_ATTRIBUTION,
        durationMs: scoreDuration,
        metadata: { candidateCount: candidates.length, topVasp: topCandidate?.vasp?.name || 'None' }
      });
      await this._logAudit(caseId, 'SCORING_COMPLETED', {
        stage: STAGES.SCORING,
        durationMs: scoreDuration,
        metadata: { topScore: topCandidate?.overallScore || 0, band: topCandidate?.band || 'N/A' }
      });
      await this._logAudit(caseId, 'RANKING_COMPLETED', {
        stage: STAGES.RANKING,
        metadata: { rankedCandidates: candidates.length }
      });
      await this._logAudit(caseId, 'STAGE_COMPLETED', { stage: STAGES.SCORING, durationMs: scoreDuration });

      // 9. Stage: PERSISTENCE & COMPLETED
      currentStage = STAGES.PERSISTENCE;
      await caseRepo.update(caseId, { currentStage: STAGES.PERSISTENCE });

      const finalResult = {
        caseId,
        status: 'COMPLETED',
        currentStage: STAGES.COMPLETED,
        suspect: {
          address: walletAddress,
          chain: chain
        },
        scope: {
          maxDepth,
          maxTransactions,
          timeWindowHours
        },
        candidateCount: candidates.length,
        topCandidate,
        candidates,
        tracing: {
          visitedNodes: traceResult.visitedNodes || [],
          totalPaths: traceResult.paths ? traceResult.paths.length : 0,
          processedTransactions: traceResult.graph?.edges ? traceResult.graph.edges.length : 0
        },
        fundFlow: {
          relationships: fundFlowResult.relationships || [],
          summary: fundFlowResult.summary || {}
        },
        provenance: {
          blockchainSource: 'SYNTHETIC_BLOCKCHAIN_DATA',
          attributionSource: 'VASP_INTELLIGENCE_DATABASE',
          dataMode: 'DEMO',
          isSynthetic: true,
          generatedAt: new Date().toISOString()
        }
      };

      // Phase 9: Persist evidence bundle
      await this._logAudit(caseId, 'STAGE_STARTED', { stage: STAGES.PERSISTENCE });
      let evidenceBundle = null;
      try {
        evidenceBundle = await evidenceService.persistInvestigationEvidence(caseId, finalResult);
        await this._logAudit(caseId, 'EVIDENCE_BUNDLE_CREATED', {
          stage: STAGES.PERSISTENCE,
          metadata: {
            fingerprintHash: evidenceBundle.fingerprintHash,
            analysisVersion: evidenceBundle.analysisVersion
          }
        });
        await this._logAudit(caseId, 'PROVENANCE_RECORDED', {
          stage: STAGES.PERSISTENCE,
          metadata: { isSynthetic: true, dataMode: 'DEMO' }
        });
      } catch (evErr) {
        console.warn('[Investigation] Evidence persistence failed (non-fatal):', evErr.message);
      }

      // Update case record with completed status and result
      await caseRepo.update(caseId, {
        status: 'COMPLETED',
        currentStage: STAGES.COMPLETED,
        candidateCount: candidates.length,
        candidates,
        investigationResult: finalResult
      });

      await this._logAudit(caseId, 'INVESTIGATION_COMPLETED', {
        stage: STAGES.COMPLETED,
        metadata: {
          topVasp: topCandidate?.vasp?.name || 'None',
          topScore: topCandidate?.overallScore || 0,
          evidencePersisted: !!evidenceBundle
        }
      });

      console.log(`[Investigation] Investigation caseId=${caseId} COMPLETED successfully. Top candidate: ${topCandidate?.vasp?.name || 'None'}`);

      return finalResult;
    } catch (error) {
      console.error(`[Investigation] Investigation caseId=${caseId} FAILED at stage=${currentStage}:`, error.message);

      // Phase 9: Audit the failure
      await this._logAudit(caseId, 'INVESTIGATION_FAILED', {
        stage: currentStage,
        metadata: { errorMessage: error.message, errorCode: error.code || 'UNKNOWN' }
      });

      // Persist failure status in Case Repository
      try {
        await caseRepo.update(caseId, {
          status: 'FAILED',
          currentStage,
          error: {
            stage: currentStage,
            message: error.message || 'Investigation execution failed'
          }
        });
      } catch (updateErr) {
        console.error('[Investigation] Failed to update case failure status:', updateErr.message);
      }

      if (error.statusCode) {
        throw error;
      }

      const safeErr = new Error(`Investigation failed during ${currentStage}: ${error.message}`);
      safeErr.statusCode = 500;
      safeErr.code = 'INVESTIGATION_FAILED';
      safeErr.stage = currentStage;
      throw safeErr;
    }
  }

  /**
   * Retrieves investigation result by case ID
   * @param {string} caseId
   * @returns {Promise<Object>} Stored investigation result or case record
   */
  async getInvestigationByCaseId(caseId) {
    if (!caseId) {
      const err = new Error('caseId parameter is required');
      err.statusCode = 400;
      throw err;
    }

    const caseRepo = repositories.caseRepository;
    const caseRecord = await caseRepo.findByCaseId(caseId);

    if (!caseRecord) {
      const err = new Error(`Case not found: ${caseId}`);
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }

    if (caseRecord.investigationResult) {
      return caseRecord.investigationResult;
    }

    return caseRecord;
  }

  /**
   * Retrieves lightweight summary for a case
   * @param {string} caseId
   * @returns {Promise<Object>} Lightweight case summary
   */
  async getInvestigationSummary(caseId) {
    const caseRecord = await this.getInvestigationByCaseId(caseId);

    const topCand = caseRecord.topCandidate || (caseRecord.candidates ? caseRecord.candidates[0] : null);

    return {
      caseId: caseRecord.caseId,
      status: caseRecord.status || 'COMPLETED',
      suspectWallet: caseRecord.suspect?.address || (caseRecord.targetWallets ? caseRecord.targetWallets[0] : null),
      chain: caseRecord.suspect?.chain || caseRecord.chain || 'ethereum',
      topCandidate: topCand ? {
        vasp: topCand.vasp?.name || 'Unknown Entity',
        score: topCand.overallScore || 0,
        attributionType: topCand.vasp?.attributionType || 'UNKNOWN'
      } : null,
      candidateCount: caseRecord.candidateCount || (caseRecord.candidates ? caseRecord.candidates.length : 0),
      processedTransactions: caseRecord.tracing?.processedTransactions || 0,
      updatedAt: caseRecord.updatedAt || caseRecord.provenance?.generatedAt || new Date()
    };
  }
}

module.exports = new InvestigationService();
