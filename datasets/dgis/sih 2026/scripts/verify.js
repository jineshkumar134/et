const http = require('http');
const config = require('../config/config');
const { startServer } = require('../server');
const repositories = require('../repositories');
const seedData = require('./seed');
const { getBlockchainAdapter } = require('../adapters/blockchain/adapterFactory');
const { normalizeTransaction } = require('../normalization/transactionNormalizer');
const BFSTracer = require('../intelligence/tracing/bfsTracer');
const fundFlowService = require('../services/fundFlowService');
const walletIntelligenceService = require('../services/walletIntelligenceService');
const attributionService = require('../services/attributionService');
const { scoreCandidate, calculateHopScore, WEIGHTS } = require('../intelligence/scoring/scorer');
const { interpretScore } = require('../intelligence/scoring/scoreInterpreter');
const { generateExplanation } = require('../intelligence/scoring/explanation');
const { rankCandidates } = require('../intelligence/scoring/ranker');
const scoringService = require('../services/scoringService');
const investigationService = require('../services/investigationService');
// Phase 9 imports
const evidenceService = require('../services/evidenceService');
const { computeFingerprint, verifyFingerprint, buildCanonicalPayload } = require('../utils/evidenceFingerprint');
// Phase 10 imports
const graphService = require('../services/graphService');
const caseSummaryService = require('../services/caseSummaryService');
const reportService = require('../services/reportService');
const exportService = require('../services/exportService');
// Phase 11 imports
const sahyogService = require('../services/sahyogService');
const sahyogActionService = require('../services/sahyogActionService');
const { getSahyogAdapter } = require('../adapters/sahyog');

async function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, rawBody: data });
        }
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runVerification() {
  console.log('==================================================');
  console.log(' RUNNING ALL VERIFICATION TESTS (PHASES 1 TO 11)');
  console.log('==================================================\n');

  let passed = true;
  let serverInstance = null;

  try {
    // ----------------------------------------------------
    // PHASE 1 VERIFICATIONS
    // ----------------------------------------------------
    console.log('[Phase 1 - 1/5] Verifying Environment Configuration...');
    if (config.port && config.mongodbUri && config.enableMockDb !== undefined) {
      console.log(`      PASSED: Port=${config.port}, MockDB=${config.enableMockDb}, DataSource=${config.dataSource}`);
    } else {
      console.error('      FAILED: Environment configuration missing required fields.');
      passed = false;
    }

    console.log('\n[Phase 1 - 2/5] Starting Express Server...');
    const { server } = await startServer();
    serverInstance = server;
    console.log('      PASSED: Express server started cleanly.');

    console.log('\n[Phase 1 - 3/5] Testing GET /api/v1/health...');
    const healthRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/health',
      method: 'GET'
    });

    if (healthRes.status === 200 && healthRes.body && healthRes.body.status === 'HEALTHY') {
      console.log('      PASSED: Health check returned 200 OK (DB Status: ' + healthRes.body?.services?.database + ').');
    } else {
      console.error(`      FAILED: Unexpected health response (status: ${healthRes.status})`, healthRes.body);
      passed = false;
    }

    console.log('\n[Phase 1 - 4/5] Testing Invalid Route (404 Handler)...');
    const notFoundRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/invalid-route-test',
      method: 'GET'
    });

    if (notFoundRes.status === 404 && notFoundRes.body?.error?.code === 'NOT_FOUND') {
      console.log('      PASSED: Invalid route returned HTTP 404.');
    } else {
      console.error(`      FAILED: Unexpected 404 response (status: ${notFoundRes.status})`, notFoundRes.body);
      passed = false;
    }

    console.log('\n[Phase 1 - 5/5] Testing Centralized Error Handler (Malformed JSON)...');
    const malformedRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/health',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, '{ invalid_json: ');

    if (malformedRes.status === 400 && malformedRes.body?.error?.code === 'INVALID_JSON') {
      console.log('      PASSED: Malformed JSON returned 400 INVALID_JSON.');
    } else {
      console.error(`      FAILED: Unexpected error response (status: ${malformedRes.status})`, malformedRes.body);
      passed = false;
    }

    // Seed synthetic data
    await seedData();

    // ----------------------------------------------------
    // PHASES 2, 3, 4 & 5 VERIFICATIONS
    // ----------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log(' TESTING PHASES 2, 3, 4 & 5 (PERSISTENCE, ADAPTERS, TRACING & FUND-FLOW)');
    console.log('--------------------------------------------------');
    const walletA = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const exchA = '0x1111111111111111111111111111111111111111';
    const exchB = '0x2222222222222222222222222222222222222222';

    const flowServiceRes = await fundFlowService.analyzeFundFlow({ chain: 'ethereum', startAddress: walletA, maxDepth: 5 });
    if (flowServiceRes && flowServiceRes.relationships.length > 0 && flowServiceRes.relationships[0].amountContinuity === 0.8) {
      console.log('      PASSED: Phase 4 & Phase 5 Tracing and Fund-Flow operational (80% continuity).');
    } else {
      console.error('      FAILED: Phase 4/5 regression check failed.');
      passed = false;
    }

    // ----------------------------------------------------
    // PHASE 6 VERIFICATIONS (VASP Intelligence & Attribution)
    // ----------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log(' TESTING PHASE 6 VASP INTELLIGENCE & WALLET ATTRIBUTION');
    console.log('--------------------------------------------------');

    const { vaspRepository: vaspRepo, walletIntelligenceRepository: intelRepo } = repositories;

    // Test 1: VASP Repository Operations
    console.log('\n[Phase 6 - Test 1/10] VASP Repository CRUD Operations...');
    const testVaspRecord = await vaspRepo.create({
      vaspId: 'VASP_TEST_UNIT',
      name: 'Unit Test Exchange',
      type: 'CEX',
      address: '0x9999999999999999999999999999999999999999',
      chain: 'ETH',
      walletType: 'DEPOSIT_WALLET',
      attributionType: 'DIRECT',
      confidence: 90,
      sourceType: 'SYNTHETIC_DEMO'
    });
    const foundVasp = await vaspRepo.findByChainAndAddress('ETH', '0x9999999999999999999999999999999999999999');
    await vaspRepo.delete('ETH', '0x9999999999999999999999999999999999999999');
    if (testVaspRecord && foundVasp && foundVasp.name === 'Unit Test Exchange') {
      console.log('      PASSED: VASP repository create, lookup, and delete operational.');
    } else {
      console.error('      FAILED: VASP repository check failed.');
      passed = false;
    }

    // Test 2: Wallet Intelligence Lookup (Known VASP Wallet)
    console.log('\n[Phase 6 - Test 2/10] Wallet Intelligence Service (Known VASP)...');
    const intelExchA = await walletIntelligenceService.getWalletIntelligence('ethereum', exchA);
    if (intelExchA.found === true && intelExchA.entityName === 'Exchange Demo A' && intelExchA.entityType === 'VASP') {
      console.log('      PASSED: Known VASP wallet intelligence retrieved (Exchange Demo A).');
    } else {
      console.error('      FAILED: Known wallet intelligence lookup failed.', intelExchA);
      passed = false;
    }

    // Test 3: Wallet Intelligence Lookup (Unknown Wallet)
    console.log('\n[Phase 6 - Test 3/10] Wallet Intelligence Service (Unknown Wallet)...');
    const intelUnknown = await walletIntelligenceService.getWalletIntelligence('ethereum', walletA);
    if (intelUnknown.found === false && intelUnknown.entityType === 'UNKNOWN' && intelUnknown.confidence === 0) {
      console.log('      PASSED: Unknown wallet returned found=false and entityType=UNKNOWN.');
    } else {
      console.error('      FAILED: Unknown wallet intelligence check failed.', intelUnknown);
      passed = false;
    }

    // Test 4: Direct VASP Attribution (Exchange Demo A)
    console.log('\n[Phase 6 - Test 4/10] Direct VASP Attribution (0x1111...)...');
    const attrDirect = await attributionService.attributeWallet('ethereum', exchA);
    if (
      attrDirect.attributed === true &&
      attrDirect.entityName === 'Exchange Demo A' &&
      attrDirect.vasp.attributionType === 'DIRECT' &&
      attrDirect.intelligenceConfidence === 95
    ) {
      console.log('      PASSED: Direct attribution confirmed (Exchange Demo A, 95% confidence).');
    } else {
      console.error('      FAILED: Direct attribution check failed.', attrDirect);
      passed = false;
    }

    // Test 5: Cluster VASP Attribution (Exchange Demo B)
    console.log('\n[Phase 6 - Test 5/10] Cluster VASP Attribution (0x2222...)...');
    const attrCluster = await attributionService.attributeWallet('ethereum', exchB);
    if (
      attrCluster.attributed === true &&
      attrCluster.entityName === 'Exchange Demo B' &&
      attrCluster.vasp.attributionType === 'CLUSTER' &&
      attrCluster.intelligenceConfidence === 80
    ) {
      console.log('      PASSED: Cluster attribution confirmed (Exchange Demo B, 80% confidence).');
    } else {
      console.error('      FAILED: Cluster attribution check failed.', attrCluster);
      passed = false;
    }

    // Test 6: Unknown Wallet Attribution
    console.log('\n[Phase 6 - Test 6/10] Unknown Wallet Attribution (Wallet A)...');
    const attrUnknown = await attributionService.attributeWallet('ethereum', walletA);
    if (attrUnknown.attributed === false && attrUnknown.reason === 'NO_KNOWN_VASP_MATCH') {
      console.log('      PASSED: Unknown wallet returned attributed=false and NO_KNOWN_VASP_MATCH.');
    } else {
      console.error('      FAILED: Unknown wallet attribution check failed.', attrUnknown);
      passed = false;
    }

    // Test 7: Synthetic Provenance Preservation
    console.log('\n[Phase 6 - Test 7/10] Synthetic Provenance Check...');
    if (attrDirect.isSynthetic === true && attrDirect.sourceType === 'SYNTHETIC_DEMO') {
      console.log('      PASSED: isSynthetic=true and sourceType="SYNTHETIC_DEMO" preserved.');
    } else {
      console.error('      FAILED: Synthetic provenance missing.', attrDirect);
      passed = false;
    }

    // Test 8: Traced Investigation Path Attribution Integration
    console.log('\n[Phase 6 - Test 8/10] Integration: Traced Investigation Path Attribution...');
    const adapter = getBlockchainAdapter('ethereum');
    const fetcher = async (c, addr) => {
      const raw = await adapter.getTransactions(addr);
      return raw.map(r => normalizeTransaction(r, addr));
    };
    const phase4Trace = await BFSTracer.trace({ chain: 'ethereum', startAddress: walletA, maxDepth: 5, fetchTransactions: fetcher });
    const attributedTrace = await attributionService.attributeTrace(phase4Trace);
    if (
      attributedTrace.destinationAttribution &&
      attributedTrace.destinationAttribution.attributed === true &&
      attributedTrace.destinationAttribution.entityName === 'Exchange Demo A'
    ) {
      console.log('      PASSED: Full pipeline (Tracing -> FundFlow -> Attribution) identified Exchange Demo A.');
    } else {
      console.error('      FAILED: Traced path attribution integration failed.', attributedTrace);
      passed = false;
    }

    // ----------------------------------------------------
    // API ENDPOINTS VERIFICATION
    // ----------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log(' TESTING PHASE 6 API ENDPOINTS');
    console.log('--------------------------------------------------');

    // API Test 1: GET /api/v1/vasps
    console.log('[API Test 1/4] Testing GET /api/v1/vasps...');
    const getVaspsRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/vasps',
      method: 'GET'
    });
    if (getVaspsRes.status === 200 && getVaspsRes.body?.success === true && getVaspsRes.body?.count >= 4) {
      console.log(`      PASSED: GET /api/v1/vasps returned HTTP 200 OK with ${getVaspsRes.body.count} records.`);
    } else {
      console.error(`      FAILED: GET /api/v1/vasps failed (status: ${getVaspsRes.status})`, getVaspsRes.body);
      passed = false;
    }

    // API Test 2: GET /api/v1/vasps/:chain/:address
    console.log(`\n[API Test 2/4] Testing GET /api/v1/vasps/ethereum/${exchA}...`);
    const getVaspAddrRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: `/api/v1/vasps/ethereum/${exchA}`,
      method: 'GET'
    });
    if (getVaspAddrRes.status === 200 && getVaspAddrRes.body?.attribution?.attributed === true) {
      console.log(`      PASSED: GET /api/v1/vasps/ethereum/${exchA} returned HTTP 200 OK.`);
    } else {
      console.error(`      FAILED: GET /api/v1/vasps/:chain/:address failed (status: ${getVaspAddrRes.status})`, getVaspAddrRes.body);
      passed = false;
    }

    // API Test 3: GET /api/v1/wallets/:chain/:address/intelligence
    console.log(`\n[API Test 3/4] Testing GET /api/v1/wallets/ethereum/${exchA}/intelligence...`);
    const getIntelRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: `/api/v1/wallets/ethereum/${exchA}/intelligence`,
      method: 'GET'
    });
    if (getIntelRes.status === 200 && getIntelRes.body?.intelligence?.found === true) {
      console.log(`      PASSED: GET /api/v1/wallets/ethereum/${exchA}/intelligence returned HTTP 200 OK.`);
    } else {
      console.error(`      FAILED: GET wallet intelligence failed (status: ${getIntelRes.status})`, getIntelRes.body);
      passed = false;
    }

    // API Test 4: POST /api/v1/attribution
    console.log('\n[API Test 4/4] Testing POST /api/v1/attribution...');
    const postAttrRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/attribution',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ chain: 'ethereum', address: exchA }));

    if (postAttrRes.status === 200 && postAttrRes.body?.attributed === true && postAttrRes.body?.entityName === 'Exchange Demo A') {
      console.log('      PASSED: POST /api/v1/attribution returned HTTP 200 OK.');
    } else {
      console.error(`      FAILED: POST /api/v1/attribution failed (status: ${postAttrRes.status})`, postAttrRes.body);
      passed = false;
    }

    // ----------------------------------------------------
    // PHASE 7 VERIFICATIONS (Explainable Scoring & Ranking)
    // ----------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log(' TESTING PHASE 7 EXPLAINABLE VASP SCORING & CANDIDATE RANKING');
    console.log('--------------------------------------------------');

    // Test 1: Hop Score Calculation
    console.log('\n[Phase 7 - Test 1/20] Hop Score Calculation...');
    const hopScore2 = calculateHopScore(2);
    const hopScore5 = calculateHopScore(5);
    if (hopScore2 === 90 && hopScore5 === 60) {
      console.log('      PASSED: Hop score calculated correctly (2 hops = 90, 5 hops = 60).');
    } else {
      console.error('      FAILED: Hop score calculation failed.', { hopScore2, hopScore5 });
      passed = false;
    }

    // Test 2: Fund Continuity Score Calculation
    console.log('\n[Phase 7 - Test 2/20] Fund Continuity Score Calculation...');
    const scoredFund = scoreCandidate({ amountContinuity: 0.8, hopCount: 2, timeProximityScore: 0.95, intelligenceConfidence: 95 });
    if (scoredFund.breakdown.fundContinuity.score === 80) {
      console.log('      PASSED: Fund continuity 0.8 converted to score 80.');
    } else {
      console.error('      FAILED: Fund continuity scoring failed.', scoredFund.breakdown.fundContinuity);
      passed = false;
    }

    // Test 3: Time Proximity Score Calculation
    console.log('\n[Phase 7 - Test 3/20] Time Proximity Score Calculation...');
    if (scoredFund.breakdown.timeProximity.score === 95) {
      console.log('      PASSED: Time proximity 0.95 converted to score 95.');
    } else {
      console.error('      FAILED: Time proximity scoring failed.', scoredFund.breakdown.timeProximity);
      passed = false;
    }

    // Test 4: Attribution Confidence Score Calculation
    console.log('\n[Phase 7 - Test 4/20] Attribution Confidence Score Calculation...');
    if (scoredFund.breakdown.attributionConfidence.score === 95) {
      console.log('      PASSED: Intelligence confidence 95 preserved as score 95.');
    } else {
      console.error('      FAILED: Attribution confidence scoring failed.', scoredFund.breakdown.attributionConfidence);
      passed = false;
    }

    // Test 5: Weight Calculation Verification
    console.log('\n[Phase 7 - Test 5/20] Prototype Weight Verification...');
    if (WEIGHTS.hopEfficiency === 0.20 && WEIGHTS.fundContinuity === 0.35 && WEIGHTS.timeProximity === 0.15 && WEIGHTS.attributionConfidence === 0.30) {
      console.log('      PASSED: Prototype weights match specification (20%, 35%, 15%, 30%).');
    } else {
      console.error('      FAILED: Weight configuration mismatch.', WEIGHTS);
      passed = false;
    }

    // Test 6: Overall Score Formula Calculation
    console.log('\n[Phase 7 - Test 6/20] Overall Score Formula Calculation...');
    if (scoredFund.overallScore === 89 && scoredFund.rawOverallScore === 88.75) {
      console.log(`      PASSED: Formula calculated overall score = ${scoredFund.overallScore} (raw: ${scoredFund.rawOverallScore}).`);
    } else {
      console.error('      FAILED: Formula calculation failed.', scoredFund);
      passed = false;
    }

    // Test 7: Score Boundaries Clamping (0 - 100)
    console.log('\n[Phase 7 - Test 7/20] Score Boundaries Clamping...');
    const clampedHigh = scoreCandidate({ hopCount: 0, amountContinuity: 1.5, timeProximityScore: 1.2, intelligenceConfidence: 150 });
    const clampedLow = scoreCandidate({ hopCount: 20, amountContinuity: 0, timeProximityScore: 0, intelligenceConfidence: 0 });
    if (clampedHigh.overallScore <= 100 && clampedLow.overallScore >= 0) {
      console.log('      PASSED: Scores properly clamped within [0, 100].');
    } else {
      console.error('      FAILED: Clamping check failed.', { high: clampedHigh.overallScore, low: clampedLow.overallScore });
      passed = false;
    }

    // Test 8: Score Interpretation Bands
    console.log('\n[Phase 7 - Test 8/20] Score Interpretation Bands...');
    const interpHigh = interpretScore(90);
    const interpLow = interpretScore(40);
    if (interpHigh.label === 'STRONG_ATTRIBUTION_PATH' && interpLow.label === 'INSUFFICIENT_ATTRIBUTION_PATH') {
      console.log('      PASSED: Score bands correctly interpreted (STRONG_ATTRIBUTION_PATH / INSUFFICIENT_ATTRIBUTION_PATH).');
    } else {
      console.error('      FAILED: Interpretation bands failed.', { interpHigh, interpLow });
      passed = false;
    }

    // Test 9: Explanation Generation
    console.log('\n[Phase 7 - Test 9/20] Explanation Generation...');
    const expl = generateExplanation({ hopCount: 2, hopScore: 90, fundScore: 80, timeScore: 95, attrScore: 95, attributionType: 'DIRECT' });
    if (expl.factors.length === 4 && expl.summary.includes('attribution path')) {
      console.log('      PASSED: Explanation factors and summary generated successfully.');
    } else {
      console.error('      FAILED: Explanation generation failed.', expl);
      passed = false;
    }

    // Test 10: Candidate Ranking Order
    console.log('\n[Phase 7 - Test 10/20] Candidate Ranking Order...');
    const candA = { destinationAddress: '0x1111', overallScore: 90, intelligenceConfidence: 95 };
    const candB = { destinationAddress: '0x2222', overallScore: 80, intelligenceConfidence: 80 };
    const ranked = rankCandidates([candB, candA]);
    if (ranked[0].destinationAddress === '0x1111' && ranked[0].rank === 1) {
      console.log('      PASSED: Candidates ranked correctly by overall score DESC.');
    } else {
      console.error('      FAILED: Candidate ranking order failed.', ranked);
      passed = false;
    }

    // Test 11: Tie-Breaking Logic
    console.log('\n[Phase 7 - Test 11/20] Tie-Breaking Logic...');
    const tie1 = { destinationAddress: '0xaaaa', overallScore: 85, intelligenceConfidence: 80 };
    const tie2 = { destinationAddress: '0xbbbb', overallScore: 85, intelligenceConfidence: 90 };
    const rankedTie = rankCandidates([tie1, tie2]);
    if (rankedTie[0].destinationAddress === '0xbbbb') {
      console.log('      PASSED: Tie broken by higher intelligenceConfidence (90 vs 80).');
    } else {
      console.error('      FAILED: Tie breaking failed.', rankedTie);
      passed = false;
    }

    // Test 12: Deterministic Candidate Order
    console.log('\n[Phase 7 - Test 12/20] Deterministic Candidate Order...');
    const det1 = rankCandidates([candA, candB]);
    const det2 = rankCandidates([candB, candA]);
    if (JSON.stringify(det1) === JSON.stringify(det2)) {
      console.log('      PASSED: Ranking order is 100% deterministic regardless of input order.');
    } else {
      console.error('      FAILED: Deterministic order check failed.');
      passed = false;
    }

    // Test 13: Missing Fund-Flow Signal Handling
    console.log('\n[Phase 7 - Test 13/20] Missing Fund-Flow Signal Handling...');
    const missingFund = scoreCandidate({ hopCount: 2, timeProximityScore: 0.9, intelligenceConfidence: 95 });
    if (missingFund.missingSignals.includes('fundContinuity') && missingFund.dataCompleteness < 1.0) {
      console.log('      PASSED: Missing fund continuity tracked safely in missingSignals without crash.');
    } else {
      console.error('      FAILED: Missing fund flow handling failed.', missingFund);
      passed = false;
    }

    // Test 14: Missing Attribution Confidence Handling
    console.log('\n[Phase 7 - Test 14/20] Missing Attribution Confidence Handling...');
    const missingAttr = scoreCandidate({ hopCount: 2, amountContinuity: 0.8, timeProximityScore: 0.9 });
    if (missingAttr.missingSignals.includes('attributionConfidence')) {
      console.log('      PASSED: Missing attribution confidence handled safely.');
    } else {
      console.error('      FAILED: Missing attribution confidence failed.', missingAttr);
      passed = false;
    }

    // Test 15: Missing Time Signal Handling
    console.log('\n[Phase 7 - Test 15/20] Missing Time Signal Handling...');
    const missingTime = scoreCandidate({ hopCount: 2, amountContinuity: 0.8, intelligenceConfidence: 95 });
    if (missingTime.missingSignals.includes('timeProximity')) {
      console.log('      PASSED: Missing time signal handled safely.');
    } else {
      console.error('      FAILED: Missing time signal failed.', missingTime);
      passed = false;
    }

    // Test 16: Multiple Candidates Scoring & Ranking
    console.log('\n[Phase 7 - Test 16/20] Multiple Candidates Scoring & Ranking...');
    const multiRes = await scoringService.analyzeAndScore({ chain: 'ethereum', startAddress: walletA });
    if (multiRes.candidates.length > 0 && multiRes.topCandidate) {
      console.log(`      PASSED: Scored and ranked ${multiRes.candidates.length} candidates (Top: ${multiRes.topCandidate.vasp?.name}).`);
    } else {
      console.error('      FAILED: Multiple candidate scoring failed.', multiRes);
      passed = false;
    }

    // Test 17: Direct Attribution Scoring
    console.log('\n[Phase 7 - Test 17/20] Direct Attribution Scoring...');
    const directScored = scoreCandidate({ hopCount: 1, amountContinuity: 1.0, timeProximityScore: 1.0, intelligenceConfidence: 95, vasp: { name: 'Exchange Demo A', attributionType: 'DIRECT' } });
    if (directScored.breakdown.attributionConfidence.score === 95 && directScored.explanation.factors[0].result === 'DIRECT') {
      console.log('      PASSED: Direct attribution scored correctly.');
    } else {
      console.error('      FAILED: Direct attribution scoring failed.', directScored);
      passed = false;
    }

    // Test 18: Cluster Attribution Scoring
    console.log('\n[Phase 7 - Test 18/20] Cluster Attribution Scoring...');
    const clusterScored = scoreCandidate({ hopCount: 2, amountContinuity: 0.8, timeProximityScore: 0.9, intelligenceConfidence: 80, vasp: { name: 'Exchange Demo B', attributionType: 'CLUSTER' } });
    if (clusterScored.breakdown.attributionConfidence.score === 80 && clusterScored.explanation.factors[0].result === 'CLUSTER') {
      console.log('      PASSED: Cluster attribution scored correctly.');
    } else {
      console.error('      FAILED: Cluster attribution scoring failed.', clusterScored);
      passed = false;
    }

    // Test 19: Synthetic Provenance Preservation
    console.log('\n[Phase 7 - Test 19/20] Synthetic Provenance Preservation...');
    if (multiRes.isSynthetic === true && multiRes.sourceType === 'SYNTHETIC_DEMO') {
      console.log('      PASSED: Synthetic provenance flags preserved in scored results.');
    } else {
      console.error('      FAILED: Provenance preservation check failed.', multiRes);
      passed = false;
    }

    // Test 20: POST /api/v1/scoring API Endpoint Test
    console.log('\n[Phase 7 - Test 20/20] API Endpoint POST /api/v1/scoring...');
    const postScoringRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/scoring',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({ chain: 'ethereum', startAddress: walletA }));

    if (postScoringRes.status === 200 && postScoringRes.body?.success === true && postScoringRes.body?.topCandidate) {
      console.log('      PASSED: POST /api/v1/scoring returned HTTP 200 OK with ranked candidates.');
    } else {
      console.error(`      FAILED: POST /api/v1/scoring failed (status: ${postScoringRes.status})`, postScoringRes.body);
      passed = false;
    }

    // ----------------------------------------------------
    // PHASE 8 VERIFICATIONS (End-to-End Investigation Orchestrator)
    // ----------------------------------------------------
    console.log('\n--------------------------------------------------');
    console.log(' TESTING PHASE 8 END-TO-END INVESTIGATION ORCHESTRATOR');
    console.log('--------------------------------------------------');

    // Test 1: Input Validation - Invalid Address
    console.log('\n[Phase 8 - Test 1/20] Input Validation (Invalid Address)...');
    try {
      await investigationService.investigateWallet({ walletAddress: 'invalid_addr', chain: 'ethereum' });
      console.error('      FAILED: Invalid address should have thrown validation error.');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400) {
        console.log('      PASSED: Invalid address rejected with HTTP 400 validation error.');
      } else {
        console.error('      FAILED: Unexpected error on invalid address.', err);
        passed = false;
      }
    }

    // Test 2: Security Check - Private Key / Mnemonic Rejection
    console.log('\n[Phase 8 - Test 2/20] Security Check (Private Key Rejection)...');
    try {
      await investigationService.investigateWallet({ walletAddress: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', chain: 'ethereum' });
      console.error('      FAILED: Private key string should have been rejected.');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'SECURITY_ERROR') {
        console.log('      PASSED: Private key rejected with SECURITY_ERROR.');
      } else {
        console.error('      FAILED: Security check failed.', err);
        passed = false;
      }
    }

    // Test 3: Input Validation - Unsupported Chain
    console.log('\n[Phase 8 - Test 3/20] Input Validation (Unsupported Chain)...');
    try {
      await investigationService.investigateWallet({ walletAddress: walletA, chain: 'SOLANA_UNSUPPORTED' });
      console.error('      FAILED: Unsupported chain should have thrown error.');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400) {
        console.log('      PASSED: Unsupported chain rejected with HTTP 400.');
      } else {
        console.error('      FAILED: Chain validation failed.', err);
        passed = false;
      }
    }

    // Test 4: Input Validation - Traversal Parameter Limits
    console.log('\n[Phase 8 - Test 4/20] Input Validation (maxDepth Limits)...');
    try {
      await investigationService.investigateWallet({ walletAddress: walletA, chain: 'ethereum', maxDepth: 25 });
      console.error('      FAILED: Out of bounds maxDepth should have been rejected.');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400) {
        console.log('      PASSED: Invalid maxDepth rejected.');
      } else {
        console.error('      FAILED: Traversal limit check failed.', err);
        passed = false;
      }
    }

    // Test 5 & 6 & 7 & 8 & 9 & 10: End-to-End Synthetic Investigation
    console.log('\n[Phase 8 - Test 5/20] End-to-End Synthetic Investigation Execution...');
    const testCaseId = `CASE_TEST_E2E_${Date.now()}`;
    const e2eResult = await investigationService.investigateWallet({
      caseId: testCaseId,
      chain: 'ethereum',
      walletAddress: walletA,
      maxDepth: 5,
      maxTransactions: 100,
      timeWindowHours: 24
    });

    if (
      e2eResult &&
      e2eResult.status === 'COMPLETED' &&
      e2eResult.topCandidate &&
      e2eResult.topCandidate.vasp?.name === 'Exchange Demo A' &&
      e2eResult.topCandidate.vasp?.attributionType === 'DIRECT' &&
      e2eResult.topCandidate.intelligenceConfidence === 95
    ) {
      console.log(`      PASSED: E2E Pipeline completed for ${testCaseId} -> Top Candidate: ${e2eResult.topCandidate.vasp.name} (95% confidence).`);
    } else {
      console.error('      FAILED: E2E synthetic investigation failed.', e2eResult);
      passed = false;
    }

    // Test 11: Case Repository Persistence & Retrieval
    console.log('\n[Phase 8 - Test 11/20] Case Repository Persistence...');
    const persistedCase = await repositories.caseRepository.findByCaseId(testCaseId);
    if (persistedCase && persistedCase.status === 'COMPLETED' && persistedCase.currentStage === 'COMPLETED') {
      console.log(`      PASSED: Case record ${testCaseId} persisted in repository with status COMPLETED.`);
    } else {
      console.error('      FAILED: Case persistence check failed.', persistedCase);
      passed = false;
    }

    // Test 12: Duplicate Completed Investigation Handling
    console.log('\n[Phase 8 - Test 12/20] Duplicate Completed Case Handling...');
    const dupResult = await investigationService.investigateWallet({
      caseId: testCaseId,
      chain: 'ethereum',
      walletAddress: walletA
    });
    if (dupResult && dupResult.caseId === testCaseId && dupResult.status === 'COMPLETED') {
      console.log('      PASSED: Duplicate completed investigation handled idempotently.');
    } else {
      console.error('      FAILED: Duplicate case handling failed.', dupResult);
      passed = false;
    }

    // Test 13: Standalone / Empty Transaction History Handling
    console.log('\n[Phase 8 - Test 13/20] Standalone Wallet Handling...');
    const emptyAddr = '0x8888888888888888888888888888888888888888';
    const emptyResult = await investigationService.investigateWallet({
      chain: 'ethereum',
      walletAddress: emptyAddr
    });
    if (emptyResult && emptyResult.status === 'COMPLETED') {
      console.log('      PASSED: Standalone address completed investigation cleanly without crash.');
    } else {
      console.error('      FAILED: Standalone address handling failed.', emptyResult);
      passed = false;
    }

    // Test 14 & 15: Cluster Attribution Investigation
    console.log('\n[Phase 8 - Test 14/20] Cluster VASP Investigation...');
    const clusterResult = await investigationService.investigateWallet({
      chain: 'ethereum',
      walletAddress: exchB
    });
    if (clusterResult && clusterResult.status === 'COMPLETED' && clusterResult.topCandidate) {
      console.log('      PASSED: Cluster VASP investigation completed.');
    } else {
      console.error('      FAILED: Cluster investigation failed.', clusterResult);
      passed = false;
    }

    // Test 16: POST /api/v1/investigations API Endpoint
    console.log('\n[Phase 8 - Test 16/20] API POST /api/v1/investigations...');
    const apiCaseId = `CASE_API_${Date.now()}`;
    const postInvRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: '/api/v1/investigations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      caseId: apiCaseId,
      chain: 'ethereum',
      walletAddress: walletA,
      maxDepth: 5
    }));

    if (postInvRes.status === 200 && postInvRes.body?.success === true && postInvRes.body?.status === 'COMPLETED') {
      console.log(`      PASSED: POST /api/v1/investigations returned HTTP 200 OK for caseId=${apiCaseId}.`);
    } else {
      console.error(`      FAILED: POST /api/v1/investigations failed (status: ${postInvRes.status})`, postInvRes.body);
      passed = false;
    }

    // Test 17: GET /api/v1/investigations/:caseId API Endpoint
    console.log(`\n[Phase 8 - Test 17/20] API GET /api/v1/investigations/${apiCaseId}...`);
    const getInvRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: `/api/v1/investigations/${apiCaseId}`,
      method: 'GET'
    });

    if (getInvRes.status === 200 && getInvRes.body?.success === true && getInvRes.body?.data?.caseId === apiCaseId) {
      console.log(`      PASSED: GET /api/v1/investigations/${apiCaseId} returned HTTP 200 OK.`);
    } else {
      console.error(`      FAILED: GET /api/v1/investigations/:caseId failed (status: ${getInvRes.status})`, getInvRes.body);
      passed = false;
    }

    // Test 18: GET /api/v1/investigations/:caseId/summary API Endpoint
    console.log(`\n[Phase 8 - Test 18/20] API GET /api/v1/investigations/${apiCaseId}/summary...`);
    const getSummaryRes = await httpRequest({
      hostname: '127.0.0.1',
      port: config.port,
      path: `/api/v1/investigations/${apiCaseId}/summary`,
      method: 'GET'
    });

    if (getSummaryRes.status === 200 && getSummaryRes.body?.success === true && getSummaryRes.body?.summary?.caseId === apiCaseId) {
      console.log(`      PASSED: GET /api/v1/investigations/${apiCaseId}/summary returned HTTP 200 OK.`);
      console.log('      Investigation Summary:', JSON.stringify(getSummaryRes.body.summary, null, 2));
    } else {
      console.error(`      FAILED: GET investigation summary failed (status: ${getSummaryRes.status})`, getSummaryRes.body);
      passed = false;
    }

    // Test 19: Provenance Preservation
    console.log('\n[Phase 8 - Test 19/20] Synthetic Provenance Preservation...');
    if (
      e2eResult.provenance?.blockchainSource === 'SYNTHETIC_BLOCKCHAIN_DATA' &&
      e2eResult.provenance?.attributionSource === 'VASP_INTELLIGENCE_DATABASE' &&
      e2eResult.provenance?.isSynthetic === true
    ) {
      console.log('      PASSED: Full data provenance preserved in investigation result.');
    } else {
      console.error('      FAILED: Provenance preservation check failed.', e2eResult.provenance);
      passed = false;
    }

    // Test 20: Comprehensive Synthetic Demo Verification
    console.log('\n[Phase 8 - Test 20/20] End-to-End Pipeline Integrity Verification...');
    if (
      e2eResult.tracing?.visitedNodes?.length >= 3 &&
      e2eResult.fundFlow?.relationships?.length >= 1 &&
      e2eResult.topCandidate?.overallScore > 0
    ) {
      console.log('      PASSED: Full pipeline (Acquisition -> Tracing -> FundFlow -> Attribution -> Scoring -> Ranking -> Case Update) verified 100%.');
    } else {
      console.error('      FAILED: Pipeline integrity check failed.', e2eResult);
      passed = false;
    }

    // ====================================================
    // PHASE 9 VERIFICATIONS — Evidence + Audit + Provenance
    // ====================================================
    console.log('\n\n--- PHASE 9: Evidence + Data Provenance + Audit Trail ---\n');

    // Test 1: ANALYSIS_VERSION in config
    console.log('[Phase 9 - Test 1/20] Verifying ANALYSIS_VERSION in config...');
    if (config.analysisVersion && config.analysisVersion === '1.0.0') {
      console.log(`      PASSED: ANALYSIS_VERSION=${config.analysisVersion}`);
    } else {
      console.error('      FAILED: config.analysisVersion missing or wrong.', config.analysisVersion);
      passed = false;
    }

    // Test 2: evidenceFingerprint module loads and exports expected functions
    console.log('[Phase 9 - Test 2/20] Verifying evidenceFingerprint module exports...');
    if (
      typeof computeFingerprint === 'function' &&
      typeof verifyFingerprint === 'function' &&
      typeof buildCanonicalPayload === 'function'
    ) {
      console.log('      PASSED: computeFingerprint, verifyFingerprint, buildCanonicalPayload exported.');
    } else {
      console.error('      FAILED: evidenceFingerprint module exports missing.');
      passed = false;
    }

    // Test 3: computeFingerprint returns sha256: prefixed string
    console.log('[Phase 9 - Test 3/20] Verifying SHA-256 fingerprint format...');
    const sampleBundle = {
      caseId: 'TEST-FP-001',
      analysisVersion: '1.0.0',
      isSynthetic: true,
      tracePath: ['0xaaaa', '0xbbbb'],
      transactionTrail: [{ hash: '0xtx1', from: '0xaaaa', to: '0xbbbb', value: '1.0', asset: 'ETH', chain: 'ETH', blockNumber: 100 }],
      attributionEvidence: { vaspName: 'Demo VASP' },
      scoring: { overallScore: 88 },
      provenance: { blockchainSource: 'SYNTHETIC', attributionSource: 'DEMO', dataMode: 'DEMO' }
    };
    const fp1 = computeFingerprint(sampleBundle);
    if (fp1 && fp1.startsWith('sha256:') && fp1.length === 71) {
      console.log(`      PASSED: Fingerprint="${fp1.slice(0, 30)}..."`);
    } else {
      console.error('      FAILED: Fingerprint format invalid.', fp1);
      passed = false;
    }

    // Test 4: Same bundle always produces same fingerprint (determinism)
    console.log('[Phase 9 - Test 4/20] Verifying fingerprint determinism...');
    const fp2 = computeFingerprint({ ...sampleBundle });
    if (fp1 === fp2) {
      console.log('      PASSED: Identical bundles produce identical fingerprints.');
    } else {
      console.error('      FAILED: Fingerprint is non-deterministic!', fp1, fp2);
      passed = false;
    }

    // Test 5: Different bundle produces different fingerprint
    console.log('[Phase 9 - Test 5/20] Verifying fingerprint uniqueness...');
    const differentBundle = { ...sampleBundle, caseId: 'DIFFERENT-CASE' };
    const fp3 = computeFingerprint(differentBundle);
    if (fp1 !== fp3) {
      console.log('      PASSED: Different bundles produce different fingerprints.');
    } else {
      console.error('      FAILED: Different bundles produced the same fingerprint!');
      passed = false;
    }

    // Test 6: verifyFingerprint — valid case
    console.log('[Phase 9 - Test 6/20] Verifying fingerprint verification (valid)...');
    const bundleWithHash = { ...sampleBundle, fingerprintHash: fp1 };
    const verResult = verifyFingerprint(bundleWithHash, fp1);
    if (verResult.valid === true) {
      console.log('      PASSED: verifyFingerprint correctly validates matching hash.');
    } else {
      console.error('      FAILED: verifyFingerprint failed valid case.', verResult);
      passed = false;
    }

    // Test 7: verifyFingerprint — tampered case
    console.log('[Phase 9 - Test 7/20] Verifying fingerprint detects tampering...');
    const tamperedBundle = { ...sampleBundle, tracePath: ['0xhacked'] };
    const tamperResult = verifyFingerprint(tamperedBundle, fp1);
    if (tamperResult.valid === false) {
      console.log('      PASSED: verifyFingerprint correctly detects tampered bundle.');
    } else {
      console.error('      FAILED: verifyFingerprint did not detect tampering!');
      passed = false;
    }

    // Test 8: evidenceService.buildEvidenceBundle
    console.log('[Phase 9 - Test 8/20] Verifying evidenceService.buildEvidenceBundle...');
    const mockInvestigationResult = {
      caseId: 'CASE_P9_TEST_001',
      suspect: { address: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', chain: 'ethereum' },
      tracing: {
        visitedNodes: ['0xaaaa', '0xbbbb', '0x1111'],
        paths: [['0xaaaa', '0xbbbb', '0x1111']],
        processedTransactions: 2
      },
      fundFlow: {
        relationships: [{ from: '0xaaaa', to: '0xbbbb', amountContinuity: 0.8 }],
        summary: { amountContinuity: 0.8 }
      },
      topCandidate: {
        vasp: { name: 'Exchange Demo A', vaspId: 'vasp_exchange_a', attributionType: 'DIRECT', intelligenceConfidence: 95, sourceType: 'SYNTHETIC_DEMO' },
        overallScore: 88,
        band: 'STRONG_ATTRIBUTION_PATH',
        label: 'Strong Attribution',
        factors: { hopScore: 100, fundFlowScore: 80, timeScore: 89, attributionScore: 95 },
        explanation: {}
      },
      candidates: [],
      provenance: { blockchainSource: 'SYNTHETIC_BLOCKCHAIN_DATA', attributionSource: 'VASP_INTELLIGENCE_DATABASE', dataMode: 'DEMO', isSynthetic: true, generatedAt: new Date().toISOString() }
    };

    const builtBundle = evidenceService.buildEvidenceBundle(mockInvestigationResult);
    if (
      builtBundle.caseId === 'CASE_P9_TEST_001' &&
      builtBundle.fingerprintHash &&
      builtBundle.fingerprintHash.startsWith('sha256:') &&
      builtBundle.analysisVersion === '1.0.0' &&
      builtBundle.isSynthetic === true &&
      builtBundle.tracePath.length >= 3
    ) {
      console.log(`      PASSED: Evidence bundle built. fingerprintHash=${builtBundle.fingerprintHash.slice(0, 30)}...`);
    } else {
      console.error('      FAILED: buildEvidenceBundle output invalid.', builtBundle);
      passed = false;
    }

    // Test 9: evidence bundle contains no secrets
    console.log('[Phase 9 - Test 9/20] Verifying no secrets in evidence bundle...');
    const bundleStr = JSON.stringify(builtBundle);
    const hasPrivateKey = /private.*key|seed.*phrase|mnemonic/i.test(bundleStr);
    if (!hasPrivateKey) {
      console.log('      PASSED: No private keys or seed phrases found in evidence bundle.');
    } else {
      console.error('      FAILED: Evidence bundle may contain secrets!');
      passed = false;
    }

    // Test 10: validateEvidenceCompleteness — complete bundle
    console.log('[Phase 9 - Test 10/20] Verifying evidence completeness validation (complete)...');
    const completeness = evidenceService.validateEvidenceCompleteness(builtBundle);
    if (completeness.complete === true && completeness.missingFields.length === 0) {
      console.log(`      PASSED: Completeness score=${completeness.score}%, presentFields=${completeness.presentFields.length}`);
    } else {
      console.error('      FAILED: Completeness check failed.', completeness);
      passed = false;
    }

    // Test 11: validateEvidenceCompleteness — incomplete bundle
    console.log('[Phase 9 - Test 11/20] Verifying evidence completeness validation (incomplete)...');
    const incompleteBundle = { caseId: 'CASE_INCOMPLETE' };
    const incompleteCheck = evidenceService.validateEvidenceCompleteness(incompleteBundle);
    if (incompleteCheck.complete === false && incompleteCheck.missingFields.length > 0) {
      console.log(`      PASSED: Correctly identified ${incompleteCheck.missingFields.length} missing fields.`);
    } else {
      console.error('      FAILED: Did not identify missing fields.', incompleteCheck);
      passed = false;
    }

    // Test 12: persistInvestigationEvidence stores and retrieves evidence
    console.log('[Phase 9 - Test 12/20] Verifying evidence persistence via repository...');
    const persisted = await evidenceService.persistInvestigationEvidence('CASE_P9_TEST_001', mockInvestigationResult);
    if (
      persisted &&
      persisted.caseId === 'CASE_P9_TEST_001' &&
      persisted.fingerprintHash &&
      persisted.fingerprintHash.startsWith('sha256:')
    ) {
      console.log(`      PASSED: Evidence persisted. fingerprintHash=${persisted.fingerprintHash.slice(0, 30)}...`);
    } else {
      console.error('      FAILED: Evidence persistence failed.', persisted);
      passed = false;
    }

    // Test 13: Idempotency — persisting again returns same evidence
    console.log('[Phase 9 - Test 13/20] Verifying evidence persistence idempotency...');
    const persisted2 = await evidenceService.persistInvestigationEvidence('CASE_P9_TEST_001', mockInvestigationResult);
    if (persisted.fingerprintHash === persisted2.fingerprintHash) {
      console.log('      PASSED: Idempotency verified — same fingerprint on second persist call.');
    } else {
      console.error('      FAILED: Second persist produced different evidence!', persisted.fingerprintHash, persisted2.fingerprintHash);
      passed = false;
    }

    // Test 14: getEvidenceBundle retrieves stored evidence
    console.log('[Phase 9 - Test 14/20] Verifying getEvidenceBundle retrieval...');
    const retrieved = await evidenceService.getEvidenceBundle('CASE_P9_TEST_001');
    if (Array.isArray(retrieved) && retrieved.length > 0 && retrieved[0].caseId === 'CASE_P9_TEST_001') {
      console.log(`      PASSED: getEvidenceBundle returned ${retrieved.length} record(s).`);
    } else {
      console.error('      FAILED: getEvidenceBundle retrieval failed.', retrieved);
      passed = false;
    }

    // Test 15: verifyEvidenceIntegrity on stored bundle
    console.log('[Phase 9 - Test 15/20] Verifying stored evidence integrity check...');
    const integrityResult = evidenceService.verifyEvidenceIntegrity(retrieved[0]);
    if (integrityResult.valid === true) {
      console.log('      PASSED: Stored evidence integrity verified (hash matches recomputed hash).');
    } else {
      console.error('      FAILED: Integrity check failed for stored evidence.', integrityResult);
      passed = false;
    }

    // Test 16: AuditRepository — create and retrieve audit entries
    console.log('[Phase 9 - Test 16/20] Verifying audit repository (create + findByCaseId)...');
    const auditRepo = repositories.auditRepository;
    await auditRepo.create({ caseId: 'CASE_AUDIT_TEST', action: 'CASE_CREATED', stage: 'CASE_CREATION', actor: 'TEST_RUNNER', metadata: { test: true } });
    await auditRepo.create({ caseId: 'CASE_AUDIT_TEST', action: 'INVESTIGATION_STARTED', stage: 'CASE_CREATION', actor: 'TEST_RUNNER', metadata: {} });
    const auditLogs = await auditRepo.findByCaseId('CASE_AUDIT_TEST');
    if (auditLogs.length >= 2 && auditLogs[0].action === 'CASE_CREATED') {
      console.log(`      PASSED: Audit trail has ${auditLogs.length} entries in chronological order.`);
    } else {
      console.error('      FAILED: Audit log retrieval failed.', auditLogs);
      passed = false;
    }

    // Test 17: countByCaseId
    console.log('[Phase 9 - Test 17/20] Verifying auditRepository.countByCaseId...');
    const auditCount = await auditRepo.countByCaseId('CASE_AUDIT_TEST');
    if (auditCount >= 2) {
      console.log(`      PASSED: countByCaseId = ${auditCount}`);
    } else {
      console.error('      FAILED: countByCaseId returned wrong count.', auditCount);
      passed = false;
    }

    // Test 18: E2E — full investigation + audit trail produced
    console.log('[Phase 9 - Test 18/20] Verifying full E2E investigation produces audit trail...');
    const p9CaseId = `CASE_P9_E2E_${Date.now()}`;
    const p9Result = await investigationService.investigateWallet({
      caseId: p9CaseId,
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chain: 'ethereum',
      maxDepth: 3
    });
    const p9Audit = await auditRepo.findByCaseId(p9CaseId);
    const auditActions = p9Audit.map((a) => a.action);
    const hasAllExpectedActions =
      auditActions.includes('CASE_CREATED') &&
      auditActions.includes('INVESTIGATION_STARTED') &&
      auditActions.includes('TRACE_EXECUTED') &&
      auditActions.includes('INVESTIGATION_COMPLETED');
    if (p9Result.status === 'COMPLETED' && p9Audit.length >= 5 && hasAllExpectedActions) {
      console.log(`      PASSED: E2E investigation produced ${p9Audit.length} audit entries. Actions: ${auditActions.join(', ')}`);
    } else {
      console.error('      FAILED: E2E audit trail incomplete.', { status: p9Result.status, auditCount: p9Audit.length, actions: auditActions });
      passed = false;
    }

    // Test 19: E2E — evidence bundle auto-created after investigation
    console.log('[Phase 9 - Test 19/20] Verifying E2E evidence bundle creation after investigation...');
    const p9Evidence = await evidenceService.getEvidenceBundle(p9CaseId);
    if (
      p9Evidence.length > 0 &&
      p9Evidence[0].caseId === p9CaseId &&
      p9Evidence[0].fingerprintHash &&
      p9Evidence[0].isSynthetic === true &&
      p9Evidence[0].analysisVersion === '1.0.0'
    ) {
      console.log(`      PASSED: Evidence bundle auto-created. fingerprintHash=${p9Evidence[0].fingerprintHash.slice(0, 30)}...`);
    } else {
      console.error('      FAILED: Evidence bundle not created after E2E investigation.', p9Evidence);
      passed = false;
    }

    // Test 20: HTTP endpoint — GET /api/v1/cases/:caseId/evidence
    console.log('[Phase 9 - Test 20/20] Verifying HTTP GET /api/v1/cases/:caseId/evidence endpoint...');
    const evidenceHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p9CaseId}/evidence`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (
      evidenceHttpRes.status === 200 &&
      evidenceHttpRes.body.success === true &&
      evidenceHttpRes.body.count > 0 &&
      evidenceHttpRes.body.evidence[0].caseId === p9CaseId
    ) {
      console.log(`      PASSED: Evidence HTTP endpoint returned ${evidenceHttpRes.body.count} bundle(s).`);
    } else {
      console.error('      FAILED: Evidence HTTP endpoint failed.', evidenceHttpRes.status, evidenceHttpRes.body);
      passed = false;
    }

    // Bonus Test 21: HTTP endpoint — GET /api/v1/cases/:caseId/evidence/audit
    console.log('[Phase 9 - Bonus Test 21/21] Verifying HTTP GET /api/v1/cases/:caseId/evidence/audit endpoint...');
    const auditHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p9CaseId}/evidence/audit`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (
      auditHttpRes.status === 200 &&
      auditHttpRes.body.success === true &&
      auditHttpRes.body.count >= 5
    ) {
      console.log(`      PASSED: Audit HTTP endpoint returned ${auditHttpRes.body.count} log entries.`);
    } else {
      console.error('      FAILED: Audit HTTP endpoint failed.', auditHttpRes.status, auditHttpRes.body);
      passed = false;
    }

    // ====================================================
    // PHASE 10 VERIFICATIONS — Graph API + Reports + Exports
    // ====================================================
    console.log('\n\n--- PHASE 10: Graph API + Investigation Reports + Exports ---\n');

    // Setup: Run an E2E investigation case to test Phase 10 features against
    const p10CaseId = `CASE_P10_TEST_${Date.now()}`;
    await investigationService.investigateWallet({
      caseId: p10CaseId,
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chain: 'ethereum',
      maxDepth: 3
    });

    // Test 1: Graph Service buildGraph output structure
    console.log('[Phase 10 - Test 1/22] Verifying graphService.buildGraph structure...');
    const graphData = await graphService.buildGraph(p10CaseId);
    if (
      graphData &&
      Array.isArray(graphData.nodes) &&
      Array.isArray(graphData.edges) &&
      graphData.nodes.length === 3 &&
      graphData.edges.length === 2
    ) {
      console.log(`      PASSED: Graph generated with ${graphData.nodes.length} nodes and ${graphData.edges.length} edges.`);
    } else {
      console.error('      FAILED: buildGraph failed or returned unexpected topology.', graphData);
      passed = false;
    }

    // Test 2: Deterministic Node IDs
    console.log('[Phase 10 - Test 2/22] Verifying deterministic Node IDs...');
    const nodeIds = graphData.nodes.map((n) => n.id);
    const expectedNodeIds = [
      'ethereum:0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      'ethereum:0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      'ethereum:0x1111111111111111111111111111111111111111'
    ];
    const nodeIdsValid = expectedNodeIds.every((id) => nodeIds.includes(id));
    if (nodeIdsValid) {
      console.log(`      PASSED: Node IDs are deterministic: ${nodeIds.join(', ')}`);
    } else {
      console.error('      FAILED: Node IDs are not deterministic.', nodeIds, expectedNodeIds);
      passed = false;
    }

    // Test 3: Node Types (SUSPECT_WALLET, INTERMEDIARY_WALLET, VASP_WALLET)
    console.log('[Phase 10 - Test 3/22] Verifying Node Types classification...');
    const suspectNode = graphData.nodes.find((n) => n.id === expectedNodeIds[0]);
    const interNode = graphData.nodes.find((n) => n.id === expectedNodeIds[1]);
    const vaspNode = graphData.nodes.find((n) => n.id === expectedNodeIds[2]);

    if (
      suspectNode && suspectNode.nodeType === 'SUSPECT_WALLET' && suspectNode.isSuspect === true &&
      interNode && interNode.nodeType === 'INTERMEDIARY_WALLET' &&
      vaspNode && vaspNode.nodeType === 'VASP_WALLET' && vaspNode.isVasp === true
    ) {
      console.log('      PASSED: Node Types correctly assigned (SUSPECT, INTERMEDIARY, VASP).');
    } else {
      console.error('      FAILED: Node Types mismatch.', { suspectNode, interNode, vaspNode });
      passed = false;
    }

    // Test 4: Highlighted path and edges
    console.log('[Phase 10 - Test 4/22] Verifying highlighted investigation path & edges...');
    if (
      Array.isArray(graphData.highlightedPath) &&
      graphData.highlightedPath.length === 3 &&
      Array.isArray(graphData.highlightedEdges) &&
      graphData.highlightedEdges.length === 2
    ) {
      console.log('      PASSED: Highlighted path (3 nodes) and highlighted edges (2 edges) verified.');
    } else {
      console.error('      FAILED: Highlighted path/edges mismatch.', graphData.highlightedPath, graphData.highlightedEdges);
      passed = false;
    }

    // Test 5: Graph metadata & data provenance
    console.log('[Phase 10 - Test 5/22] Verifying graph metadata & synthetic provenance...');
    if (
      graphData.metadata &&
      graphData.metadata.graphVersion === '1.0.0' &&
      graphData.metadata.nodeCount === 3 &&
      graphData.metadata.edgeCount === 2 &&
      graphData.dataProvenance &&
      graphData.dataProvenance.isSynthetic === true
    ) {
      console.log('      PASSED: Graph metadata and synthetic provenance verified.');
    } else {
      console.error('      FAILED: Graph metadata invalid.', graphData.metadata, graphData.dataProvenance);
      passed = false;
    }

    // Test 6: Graph filtering options
    console.log('[Phase 10 - Test 6/22] Verifying graph filtering query parameters...');
    const filteredGraph = await graphService.buildGraph(p10CaseId, { candidateOnly: true });
    if (filteredGraph.nodes.length === 1 && filteredGraph.nodes[0].nodeType === 'VASP_WALLET') {
      console.log('      PASSED: Candidate-only filter returned 1 VASP node.');
    } else {
      console.error('      FAILED: Candidate-only filter failed.', filteredGraph.nodes);
      passed = false;
    }

    // Test 7: Graph 404 for missing case
    console.log('[Phase 10 - Test 7/22] Verifying graph 404 for missing case...');
    try {
      await graphService.buildGraph('NON_EXISTENT_CASE_123');
      console.error('      FAILED: Missing case did not throw error!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 404) {
        console.log('      PASSED: Missing case correctly threw 404.');
      } else {
        console.error('      FAILED: Unexpected error code for missing case.', err);
        passed = false;
      }
    }

    // Test 8: Case Summary Service getCaseSummary
    console.log('[Phase 10 - Test 8/22] Verifying caseSummaryService.getCaseSummary...');
    const summary = await caseSummaryService.getCaseSummary(p10CaseId);
    if (
      summary &&
      summary.caseId === p10CaseId &&
      summary.status === 'COMPLETED' &&
      summary.suspect && summary.suspect.address === '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' &&
      summary.topCandidate && summary.topCandidate.vasp === 'Exchange Demo A' &&
      summary.graph && summary.graph.nodeCount === 3 &&
      summary.evidence && summary.evidence.fingerprint &&
      summary.analysisVersion === '1.0.0'
    ) {
      console.log('      PASSED: Case summary generated with all required fields.');
    } else {
      console.error('      FAILED: Case summary structure invalid.', summary);
      passed = false;
    }

    // Test 9: Report Service generateInvestigationReport
    console.log('[Phase 10 - Test 9/22] Verifying reportService.generateInvestigationReport...');
    const report = await reportService.generateInvestigationReport(p10CaseId);
    if (
      report &&
      report.reportType === 'BLOCKCHAIN_VASP_INVESTIGATION' &&
      report.reportVersion === '1.0.0' &&
      report.case && report.case.caseId === p10CaseId &&
      report.attribution && report.attribution.status === 'FOUND' &&
      report.attribution.topCandidate && report.attribution.topCandidate.candidate.vasp.name === 'Exchange Demo A'
    ) {
      console.log('      PASSED: Investigation report generated with correct structure.');
    } else {
      console.error('      FAILED: Investigation report invalid.', report);
      passed = false;
    }

    // Test 10: Report Language & Limitations
    console.log('[Phase 10 - Test 10/22] Verifying investigative language & limitations...');
    const reportStr = JSON.stringify(report);
    const hasDefiniteOwnerClaim = /wallet owner is definitely|criminal wallet|proof of crime|100% certain/i.test(reportStr);
    const hasLimitations = Array.isArray(report.limitations) && report.limitations.length > 0;
    const hasSyntheticLimitation = report.limitations.some((l) => l.includes('synthetic/demo'));

    if (!hasDefiniteOwnerClaim && hasLimitations && hasSyntheticLimitation) {
      console.log(`      PASSED: Careful investigative language enforced. ${report.limitations.length} limitation statement(s) present.`);
    } else {
      console.error('      FAILED: Report language or limitations check failed.', { hasDefiniteOwnerClaim, hasLimitations, limitations: report.limitations });
      passed = false;
    }

    // Test 11: Export Service exportCaseAsJSON
    console.log('[Phase 10 - Test 11/22] Verifying exportService.exportCaseAsJSON...');
    const jsonExport = await exportService.exportCaseAsJSON(p10CaseId);
    if (
      jsonExport &&
      jsonExport.caseId === p10CaseId &&
      jsonExport.case &&
      jsonExport.graph && jsonExport.graph.nodeCount === 3 &&
      jsonExport.provenance && jsonExport.provenance.isSynthetic === true &&
      jsonExport.disclaimer
    ) {
      console.log('      PASSED: JSON export structured correctly.');
    } else {
      console.error('      FAILED: JSON export invalid.', jsonExport);
      passed = false;
    }

    // Test 12: Export Service exportCaseTransactionsAsCSV
    console.log('[Phase 10 - Test 12/22] Verifying exportService.exportCaseTransactionsAsCSV...');
    const csvContent = await exportService.exportCaseTransactionsAsCSV(p10CaseId);
    const csvLines = csvContent.split('\n').filter((l) => l.trim().length > 0);
    if (
      typeof csvContent === 'string' &&
      csvLines.length === 3 && // 1 header + 2 transaction rows
      csvLines[0].startsWith('caseId,chain,transactionHash')
    ) {
      console.log(`      PASSED: CSV export generated ${csvLines.length - 1} transaction row(s) with correct header.`);
    } else {
      console.error('      FAILED: CSV export content invalid.', csvContent);
      passed = false;
    }

    // Test 13: Export Service exportCaseGraphAsJSON
    console.log('[Phase 10 - Test 13/22] Verifying exportService.exportCaseGraphAsJSON...');
    const graphExport = await exportService.exportCaseGraphAsJSON(p10CaseId);
    if (
      graphExport &&
      graphExport.caseId === p10CaseId &&
      graphExport.nodes && graphExport.nodes.length === 3 &&
      graphExport.edges && graphExport.edges.length === 2 &&
      graphExport.evidenceFingerprint
    ) {
      console.log('      PASSED: Graph JSON export verified.');
    } else {
      console.error('      FAILED: Graph JSON export invalid.', graphExport);
      passed = false;
    }

    // Test 14: Export Service exportCaseCandidatesAsJSON
    console.log('[Phase 10 - Test 14/22] Verifying exportService.exportCaseCandidatesAsJSON...');
    const candidateExport = await exportService.exportCaseCandidatesAsJSON(p10CaseId);
    if (
      candidateExport &&
      candidateExport.caseId === p10CaseId &&
      candidateExport.candidateCount === 2 &&
      candidateExport.topCandidate && candidateExport.topCandidate.vasp.name === 'Exchange Demo A'
    ) {
      console.log('      PASSED: Candidates JSON export verified preserving Phase 7 ranking.');
    } else {
      console.error('      FAILED: Candidates JSON export invalid.', candidateExport);
      passed = false;
    }

    // Test 15: HTTP GET /api/v1/cases/:caseId/summary
    console.log('[Phase 10 - Test 15/22] Verifying HTTP GET /api/v1/cases/:caseId/summary endpoint...');
    const summaryHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/summary`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (summaryHttp.status === 200 && summaryHttp.body.success === true && summaryHttp.body.caseId === p10CaseId) {
      console.log('      PASSED: GET /cases/:caseId/summary returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/summary failed.', summaryHttp.status, summaryHttp.body);
      passed = false;
    }

    // Test 16: HTTP GET /api/v1/cases/:caseId/graph
    console.log('[Phase 10 - Test 16/22] Verifying HTTP GET /api/v1/cases/:caseId/graph endpoint...');
    const graphHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/graph`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (graphHttp.status === 200 && graphHttp.body.success === true && graphHttp.body.graph.nodes.length === 3) {
      console.log('      PASSED: GET /cases/:caseId/graph returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/graph failed.', graphHttp.status, graphHttp.body);
      passed = false;
    }

    // Test 17: HTTP GET /api/v1/cases/:caseId/report
    console.log('[Phase 10 - Test 17/22] Verifying HTTP GET /api/v1/cases/:caseId/report endpoint...');
    const reportHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/report`,
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });
    if (reportHttp.status === 200 && reportHttp.body.success === true && reportHttp.body.report.reportType === 'BLOCKCHAIN_VASP_INVESTIGATION') {
      console.log('      PASSED: GET /cases/:caseId/report returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/report failed.', reportHttp.status, reportHttp.body);
      passed = false;
    }

    // Test 18: HTTP GET /api/v1/cases/:caseId/export/json
    console.log('[Phase 10 - Test 18/22] Verifying HTTP GET /api/v1/cases/:caseId/export/json endpoint...');
    const jsonExportHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/export/json`,
      method: 'GET'
    });
    if (jsonExportHttp.status === 200 && jsonExportHttp.body.caseId === p10CaseId) {
      console.log('      PASSED: GET /cases/:caseId/export/json returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/export/json failed.', jsonExportHttp.status, jsonExportHttp.body);
      passed = false;
    }

    // Test 19: HTTP GET /api/v1/cases/:caseId/export/transactions.csv
    console.log('[Phase 10 - Test 19/22] Verifying HTTP GET /api/v1/cases/:caseId/export/transactions.csv endpoint...');
    const csvExportHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/export/transactions.csv`,
      method: 'GET'
    });
    const contentType = csvExportHttp.headers['content-type'] || '';
    if (csvExportHttp.status === 200 && contentType.includes('text/csv')) {
      console.log(`      PASSED: GET /cases/:caseId/export/transactions.csv returned HTTP 200 OK (${contentType}).`);
    } else {
      console.error('      FAILED: GET /cases/:caseId/export/transactions.csv failed.', csvExportHttp.status, contentType);
      passed = false;
    }

    // Test 20: HTTP GET /api/v1/cases/:caseId/export/graph.json
    console.log('[Phase 10 - Test 20/22] Verifying HTTP GET /api/v1/cases/:caseId/export/graph.json endpoint...');
    const graphJsonHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/export/graph.json`,
      method: 'GET'
    });
    if (graphJsonHttp.status === 200 && graphJsonHttp.body.nodes.length === 3) {
      console.log('      PASSED: GET /cases/:caseId/export/graph.json returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/export/graph.json failed.', graphJsonHttp.status, graphJsonHttp.body);
      passed = false;
    }

    // Test 21: HTTP GET /api/v1/cases/:caseId/export/candidates.json
    console.log('[Phase 10 - Test 21/22] Verifying HTTP GET /api/v1/cases/:caseId/export/candidates.json endpoint...');
    const candidatesJsonHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p10CaseId}/export/candidates.json`,
      method: 'GET'
    });
    if (candidatesJsonHttp.status === 200 && candidatesJsonHttp.body.candidateCount === 2) {
      console.log('      PASSED: GET /cases/:caseId/export/candidates.json returned HTTP 200 OK.');
    } else {
      console.error('      FAILED: GET /cases/:caseId/export/candidates.json failed.', candidatesJsonHttp.status, candidatesJsonHttp.body);
      passed = false;
    }

    // Test 22: HTTP 404 for missing cases across Phase 10 endpoints
    console.log('[Phase 10 - Test 22/22] Verifying HTTP 404 handling for non-existent case...');
    const missingSummaryHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: '/api/v1/cases/NON_EXISTENT_CASE_999/summary',
      method: 'GET'
    });
    if (missingSummaryHttp.status === 404) {
      console.log('      PASSED: HTTP GET /cases/NON_EXISTENT_CASE/summary returned HTTP 404 Not Found.');
    } else {
      console.error('      FAILED: HTTP 404 test failed.', missingSummaryHttp.status);
      passed = false;
    }

    // ====================================================
    // PHASE 11 VERIFICATIONS — SAHYOG-Compatible Sandbox Workflow
    // ====================================================
    console.log('\n\n--- PHASE 11: SAHYOG-Compatible Sandbox Workflow + Lawful Action Preparation ---\n');

    // Test 1: SAHYOG Sandbox Adapter verification
    console.log('[Phase 11 - Test 1/20] Verifying SAHYOG Sandbox Adapter properties...');
    const sahyogAdapter = getSahyogAdapter();
    if (sahyogAdapter.mode === 'SANDBOX' && sahyogAdapter.productionConnected === false) {
      console.log('      PASSED: SahyogAdapter initialized in SANDBOX mode (productionConnected=false).');
    } else {
      console.error('      FAILED: SahyogAdapter configuration invalid.', sahyogAdapter);
      passed = false;
    }

    // Test 2: SAHYOG Request Input Validation (Priority, Chain, Security)
    console.log('[Phase 11 - Test 2/20] Verifying SAHYOG Request Validation & Security checks...');
    try {
      await sahyogService.receiveInvestigation({
        requestId: 'REQ_INVALID_SEC',
        walletAddress: 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon', // Seed phrase
        chain: 'ethereum'
      });
      console.error('      FAILED: Seed phrase security violation was not rejected!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'SECURITY_ERROR') {
        console.log('      PASSED: Mnemonic seed phrase correctly rejected with SECURITY_ERROR.');
      } else {
        console.error('      FAILED: Unexpected error for security violation.', err);
        passed = false;
      }
    }

    // Test 3: End-to-End SAHYOG Synthetic Investigation Execution
    console.log('[Phase 11 - Test 3/20] Verifying E2E SAHYOG Investigation Execution (POST /api/v1/sahyog/investigations)...');
    const p11ReqId = `SAHYOG-DEMO-${Date.now()}`;
    const sahyogInvHttp = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: '/api/v1/sahyog/investigations',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, JSON.stringify({
      requestId: p11ReqId,
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chain: 'ethereum',
      priority: 'HIGH',
      requestedScope: { maxDepth: 3, maxTransactions: 100, timeWindowHours: 24 }
    }));

    if (
      sahyogInvHttp.status === 200 &&
      sahyogInvHttp.body.success === true &&
      sahyogInvHttp.body.data.requestId === p11ReqId &&
      sahyogInvHttp.body.data.integration.mode === 'SANDBOX' &&
      sahyogInvHttp.body.data.integration.productionConnected === false &&
      sahyogInvHttp.body.data.attribution.topCandidate.vasp === 'Exchange Demo A'
    ) {
      console.log(`      PASSED: SAHYOG investigation completed cleanly. CaseId=${sahyogInvHttp.body.data.caseId}, Top VASP: ${sahyogInvHttp.body.data.attribution.topCandidate.vasp}`);
    } else {
      console.error('      FAILED: SAHYOG investigation failed.', sahyogInvHttp.status, sahyogInvHttp.body);
      passed = false;
    }

    const p11CaseId = sahyogInvHttp.body?.data?.caseId || `CASE_SAHYOG_${p11ReqId}`;

    // Test 4: Idempotency & Request-ID ↔ Case-ID Mapping
    console.log('[Phase 11 - Test 4/20] Verifying SAHYOG Request Idempotency & Mapping...');
    const repeatInvRes = await sahyogService.receiveInvestigation({
      requestId: p11ReqId,
      walletAddress: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      chain: 'ethereum'
    });
    if (repeatInvRes.success === true && repeatInvRes.data.caseId === p11CaseId) {
      console.log('      PASSED: Duplicate requestId handled idempotently without re-running pipeline.');
    } else {
      console.error('      FAILED: Idempotency check failed.', repeatInvRes);
      passed = false;
    }

    // Test 5: Lawful Action Preparation — DISCLOSURE_REQUEST
    console.log('[Phase 11 - Test 5/20] Verifying Lawful Action Preparation (DISCLOSURE_REQUEST)...');
    const disclosurePrepRes = await sahyogActionService.prepareAction({
      requestId: p11ReqId,
      caseId: p11CaseId,
      actionType: 'DISCLOSURE_REQUEST',
      lawfulBasis: 'AUTHORIZED_LEA_INVESTIGATION_SEC_91',
      justification: 'Action prepared based on the highest-ranked VASP candidate identified from transaction-path and VASP intelligence analysis.'
    });

    const discAction = disclosurePrepRes.data;
    if (
      disclosurePrepRes.success === true &&
      discAction.actionId.startsWith('SAH-ACT-') &&
      discAction.actionType === 'DISCLOSURE_REQUEST' &&
      discAction.target.vasp === 'Exchange Demo A' &&
      discAction.status === 'READY' &&
      discAction.mode === 'SANDBOX' &&
      discAction.investigationReference.evidenceFingerprint
    ) {
      console.log(`      PASSED: DISCLOSURE_REQUEST action prepared (ID=${discAction.actionId}, status=READY, VASP=${discAction.target.vasp}).`);
    } else {
      console.error('      FAILED: DISCLOSURE_REQUEST preparation failed.', disclosurePrepRes);
      passed = false;
    }

    // Test 6: Lawful Action Preparation — FREEZING_REQUEST
    console.log('[Phase 11 - Test 6/20] Verifying Lawful Action Preparation (FREEZING_REQUEST)...');
    const freezePrepRes = await sahyogActionService.prepareAction({
      requestId: p11ReqId,
      caseId: p11CaseId,
      actionType: 'FREEZING_REQUEST',
      lawfulBasis: 'COURT_ORDER_PRESERVATION',
      justification: 'Freezing request prepared for authorized review based on selected VASP candidate and evidence.'
    });

    const freezeAction = freezePrepRes.data;
    if (
      freezePrepRes.success === true &&
      freezeAction.actionType === 'FREEZING_REQUEST' &&
      freezeAction.status === 'READY' &&
      freezeAction.target.vasp === 'Exchange Demo A'
    ) {
      console.log(`      PASSED: FREEZING_REQUEST action prepared (ID=${freezeAction.actionId}, status=READY).`);
    } else {
      console.error('      FAILED: FREEZING_REQUEST preparation failed.', freezePrepRes);
      passed = false;
    }

    // Test 7: Safety Test: No-VASP Candidate handling
    console.log('[Phase 11 - Test 7/20] Verifying No-VASP Candidate Safety...');
    // Create a standalone investigation with no VASP
    const noVaspCaseId = `CASE_NO_VASP_${Date.now()}`;
    await investigationService.investigateWallet({
      caseId: noVaspCaseId,
      walletAddress: '0x8888888888888888888888888888888888888888',
      chain: 'ethereum'
    });

    try {
      await sahyogActionService.prepareAction({
        requestId: 'REQ_NO_VASP',
        caseId: noVaspCaseId,
        actionType: 'DISCLOSURE_REQUEST',
        lawfulBasis: 'TEST_BASIS',
        justification: 'TEST_JUSTIFICATION'
      });
      console.error('      FAILED: Action preparation succeeded when no VASP candidate was available!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'NO_VASP_CANDIDATE') {
        console.log('      PASSED: Action preparation safely rejected with NO_VASP_CANDIDATE.');
      } else {
        console.error('      FAILED: Unexpected error for No-VASP safety check.', err);
        passed = false;
      }
    }

    // Test 8: Safety Test: Non-Completed Investigation Status
    console.log('[Phase 11 - Test 8/20] Verifying Incomplete Investigation Safety...');
    const caseRepo = repositories.caseRepository;
    const runningCaseId = `CASE_RUNNING_${Date.now()}`;
    await caseRepo.create({
      caseId: runningCaseId,
      title: 'Running test case',
      investigatorId: 'TEST_RUNNER',
      status: 'RUNNING'
    });

    try {
      await sahyogActionService.prepareAction({
        caseId: runningCaseId,
        actionType: 'DISCLOSURE_REQUEST',
        lawfulBasis: 'TEST_BASIS',
        justification: 'TEST_JUSTIFICATION'
      });
      console.error('      FAILED: Action preparation succeeded on a RUNNING investigation!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'INVESTIGATION_NOT_COMPLETED') {
        console.log('      PASSED: Action preparation safely rejected with INVESTIGATION_NOT_COMPLETED.');
      } else {
        console.error('      FAILED: Unexpected error for incomplete investigation check.', err);
        passed = false;
      }
    }

    // Test 9: Validation Test: Missing Lawful Basis or Justification
    console.log('[Phase 11 - Test 9/20] Verifying missing Lawful Basis & Justification validation...');
    try {
      await sahyogActionService.prepareAction({
        caseId: p11CaseId,
        actionType: 'DISCLOSURE_REQUEST',
        lawfulBasis: '',
        justification: 'Justification present'
      });
      console.error('      FAILED: Missing lawful basis was not rejected!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'LAWFUL_BASIS_REQUIRED') {
        console.log('      PASSED: Missing lawfulBasis correctly rejected with LAWFUL_BASIS_REQUIRED.');
      } else {
        console.error('      FAILED: Unexpected error for missing lawfulBasis.', err);
        passed = false;
      }
    }

    // Test 10: Validation Test: Invalid Action Type
    console.log('[Phase 10/11 - Test 10/20] Verifying invalid actionType rejection...');
    try {
      await sahyogActionService.prepareAction({
        caseId: p11CaseId,
        actionType: 'TRANSFER_FUNDS', // Unsupported action
        lawfulBasis: 'TEST',
        justification: 'TEST'
      });
      console.error('      FAILED: Unsupported actionType "TRANSFER_FUNDS" was not rejected!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'INVALID_ACTION_TYPE') {
        console.log('      PASSED: Unsupported actionType correctly rejected with INVALID_ACTION_TYPE.');
      } else {
        console.error('      FAILED: Unexpected error for invalid actionType.', err);
        passed = false;
      }
    }

    // Test 11: Sandbox Action Submission (POST /api/v1/sahyog/actions/:actionId/submit)
    console.log('[Phase 11 - Test 11/20] Verifying Sandbox Action Submission...');
    const submitHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/sahyog/actions/${discAction.actionId}/submit`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (
      submitHttpRes.status === 200 &&
      submitHttpRes.body.success === true &&
      submitHttpRes.body.data.actionId === discAction.actionId &&
      submitHttpRes.body.data.status === 'SUBMITTED' &&
      submitHttpRes.body.data.mode === 'SANDBOX' &&
      submitHttpRes.body.data.externalSubmission === false &&
      submitHttpRes.body.data.sandboxAcknowledgement &&
      submitHttpRes.body.data.sandboxAcknowledgement.type === 'SYNTHETIC_SANDBOX_ACKNOWLEDGEMENT'
    ) {
      console.log(`      PASSED: Sandbox Action Submission recorded (status=SUBMITTED, externalSubmission=false, ACK=${submitHttpRes.body.data.sandboxAcknowledgement.acknowledgementId}).`);
    } else {
      console.error('      FAILED: Sandbox action submission failed.', submitHttpRes.status, submitHttpRes.body);
      passed = false;
    }

    // Test 12: Action Immutability & Double Submit Protection
    console.log('[Phase 11 - Test 12/20] Verifying Action Immutability & Double Submit protection...');
    try {
      await sahyogActionService.submitAction(discAction.actionId);
      console.error('      FAILED: Re-submitting an already SUBMITTED action was not prevented!');
      passed = false;
    } catch (err) {
      if (err.statusCode === 400 && err.code === 'ACTION_NOT_READY') {
        console.log('      PASSED: Action immutability enforced — double submission prevented with ACTION_NOT_READY.');
      } else {
        console.error('      FAILED: Unexpected error for double submission check.', err);
        passed = false;
      }
    }

    // Test 13: HTTP GET /api/v1/sahyog/investigations/:requestId
    console.log('[Phase 11 - Test 13/20] Verifying HTTP GET /api/v1/sahyog/investigations/:requestId endpoint...');
    const reqHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/sahyog/investigations/${p11ReqId}`,
      method: 'GET'
    });
    if (
      reqHttpRes.status === 200 &&
      reqHttpRes.body.success === true &&
      reqHttpRes.body.data.requestId === p11ReqId &&
      reqHttpRes.body.data.actionsCount >= 2
    ) {
      console.log(`      PASSED: GET /sahyog/investigations/${p11ReqId} returned request details & ${reqHttpRes.body.data.actionsCount} associated action(s).`);
    } else {
      console.error('      FAILED: GET /sahyog/investigations/:requestId failed.', reqHttpRes.status, reqHttpRes.body);
      passed = false;
    }

    // Test 14: HTTP GET /api/v1/sahyog/actions/:actionId
    console.log('[Phase 11 - Test 14/20] Verifying HTTP GET /api/v1/sahyog/actions/:actionId endpoint...');
    const getActionHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/sahyog/actions/${discAction.actionId}`,
      method: 'GET'
    });
    if (
      getActionHttpRes.status === 200 &&
      getActionHttpRes.body.success === true &&
      getActionHttpRes.body.data.actionId === discAction.actionId &&
      getActionHttpRes.body.data.status === 'SUBMITTED'
    ) {
      console.log(`      PASSED: GET /sahyog/actions/${discAction.actionId} returned HTTP 200 OK.`);
    } else {
      console.error('      FAILED: GET /sahyog/actions/:actionId failed.', getActionHttpRes.status, getActionHttpRes.body);
      passed = false;
    }

    // Test 15: HTTP GET /api/v1/cases/:caseId/sahyog/actions
    console.log('[Phase 11 - Test 15/20] Verifying HTTP GET /api/v1/cases/:caseId/sahyog/actions endpoint...');
    const caseActionsHttpRes = await httpRequest({
      host: 'localhost',
      port: config.port,
      path: `/api/v1/cases/${p11CaseId}/sahyog/actions`,
      method: 'GET'
    });
    if (
      caseActionsHttpRes.status === 200 &&
      caseActionsHttpRes.body.success === true &&
      caseActionsHttpRes.body.count >= 2
    ) {
      console.log(`      PASSED: GET /cases/${p11CaseId}/sahyog/actions returned ${caseActionsHttpRes.body.count} action(s).`);
    } else {
      console.error('      FAILED: GET /cases/:caseId/sahyog/actions failed.', caseActionsHttpRes.status, caseActionsHttpRes.body);
      passed = false;
    }

    // Test 16: Updated Case Summary includes SAHYOG Section
    console.log('[Phase 11 - Test 16/20] Verifying Case Summary includes SAHYOG integration section...');
    const sahyogSummary = await caseSummaryService.getCaseSummary(p11CaseId);
    if (
      sahyogSummary &&
      sahyogSummary.sahyog &&
      sahyogSummary.sahyog.requestId === p11ReqId &&
      sahyogSummary.sahyog.mode === 'SANDBOX' &&
      sahyogSummary.sahyog.actionCount >= 2
    ) {
      console.log(`      PASSED: Case Summary cleanly integrates sahyog section (requestId=${p11ReqId}, actions=${sahyogSummary.sahyog.actionCount}).`);
    } else {
      console.error('      FAILED: SAHYOG section missing from Case Summary.', sahyogSummary);
      passed = false;
    }

    // Test 17: Audit Trail Verification for SAHYOG Workflow Events
    console.log('[Phase 11 - Test 17/20] Verifying Audit Trail for SAHYOG workflow events...');
    const sahyogAuditRepo = repositories.auditRepository;
    const sahyogAuditLogs = await sahyogAuditRepo.findByCaseId(p11CaseId);
    const sahyogActionsInAudit = sahyogAuditLogs.map((a) => a.action);

    const hasSahyogEvents =
      sahyogActionsInAudit.includes('SAHYOG_REQUEST_RECEIVED') &&
      sahyogActionsInAudit.includes('SAHYOG_INVESTIGATION_STARTED') &&
      sahyogActionsInAudit.includes('SAHYOG_INVESTIGATION_COMPLETED') &&
      sahyogActionsInAudit.includes('SAHYOG_ACTION_PREPARED') &&
      sahyogActionsInAudit.includes('SAHYOG_ACTION_SUBMITTED_SANDBOX');

    if (hasSahyogEvents) {
      console.log(`      PASSED: Audit trail verified with ${sahyogAuditLogs.length} events including SAHYOG intake, preparation & sandbox submission.`);
    } else {
      console.error('      FAILED: SAHYOG events missing from audit trail.', sahyogActionsInAudit);
      passed = false;
    }

    // Test 18: Security & Offline Sandbox Verification (No external network calls)
    console.log('[Phase 11 - Test 18/20] Verifying Security & Offline Sandbox execution...');
    const jsonStr = JSON.stringify(discAction);
    const hasFakeGovUrl = /fake-sahyog|fake-gov|api\.gov/i.test(jsonStr);
    const hasSecretKey = /private.*key|seed.*phrase|password|bearer/i.test(jsonStr);

    if (!hasFakeGovUrl && !hasSecretKey && discAction.mode === 'SANDBOX') {
      console.log('      PASSED: Security verified — zero secret leaks, zero fake external URLs.');
    } else {
      console.error('      FAILED: Security check failed.', { hasFakeGovUrl, hasSecretKey });
      passed = false;
    }

  } catch (error) {
    console.error('\nVERIFICATION ERRORED:', error);
    passed = false;
  } finally {
    if (serverInstance) {
      serverInstance.close();
    }
  }

  console.log('\n==================================================');
  if (passed) {
    console.log(' ALL PHASES (1 TO 11) VERIFICATION PASSED SUCCESSFULLY! ');
    console.log('==================================================\n');
    process.exit(0);
  } else {
    console.error(' VERIFICATION FAILED! ');
    console.log('==================================================\n');
    process.exit(1);
  }
}

runVerification();



