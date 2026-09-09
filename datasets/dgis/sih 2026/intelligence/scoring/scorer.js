const { interpretScore } = require('./scoreInterpreter');
const { generateExplanation } = require('./explanation');

const WEIGHTS = {
  hopEfficiency: 0.20,
  fundContinuity: 0.35,
  timeProximity: 0.15,
  attributionConfidence: 0.30
};

/**
 * Calculates hop efficiency score based on path depth / hop count.
 * Shorter paths receive higher scores.
 * @param {number} hopCount
 * @returns {number} Score between 0 and 100
 */
function calculateHopScore(hopCount) {
  if (hopCount === undefined || hopCount === null || isNaN(hopCount) || hopCount < 0) {
    return 0;
  }
  if (hopCount === 0 || hopCount === 1) return 100;
  if (hopCount === 2) return 90;
  if (hopCount === 3) return 80;
  if (hopCount === 4) return 70;
  if (hopCount === 5) return 60;
  return Math.max(0, 60 - (hopCount - 5) * 10);
}

/**
 * Scores a VASP attribution candidate based on 4 analytical signals.
 * @param {Object} params
 * @param {number} params.hopCount - Number of transaction hops (e.g. 2)
 * @param {number} [params.amountContinuity] - Fund flow continuity ratio (0.0 - 1.0)
 * @param {number} [params.timeProximityScore] - Temporal proximity ratio (0.0 - 1.0)
 * @param {number} [params.timeDifferenceMinutes] - Transaction time delta in minutes
 * @param {number} [params.intelligenceConfidence] - VASP attribution confidence (0 - 100)
 * @param {Object} [params.vasp] - Attributed VASP details
 * @param {string} [params.chain] - Blockchain network
 * @param {string} [params.destinationAddress] - Candidate wallet address
 * @param {string} [params.sourceType] - Provenance source type
 * @param {boolean} [params.isSynthetic] - Synthetic provenance flag
 * @returns {Object} Scored candidate with breakdown, interpretation, and explanation
 */
function scoreCandidate(params = {}) {
  const {
    hopCount,
    amountContinuity,
    timeProximityScore,
    timeDifferenceMinutes,
    intelligenceConfidence,
    vasp,
    chain = 'ethereum',
    destinationAddress = '',
    sourceType = 'SYNTHETIC_DEMO',
    isSynthetic = true
  } = params;

  const missingSignals = [];

  // 1. Hop Efficiency
  let hopScore = 0;
  if (hopCount !== undefined && hopCount !== null && !isNaN(hopCount)) {
    hopScore = calculateHopScore(hopCount);
  } else {
    missingSignals.push('hopEfficiency');
  }

  // 2. Fund Continuity
  let fundScore = 0;
  if (amountContinuity !== undefined && amountContinuity !== null && !isNaN(amountContinuity)) {
    fundScore = Math.min(100, Math.max(0, Math.round(amountContinuity * 100)));
  } else {
    missingSignals.push('fundContinuity');
  }

  // 3. Time Proximity
  let timeScore = 0;
  if (timeProximityScore !== undefined && timeProximityScore !== null && !isNaN(timeProximityScore)) {
    timeScore = Math.min(100, Math.max(0, Math.round(timeProximityScore * 100)));
  } else if (timeDifferenceMinutes !== undefined && timeDifferenceMinutes !== null && !isNaN(timeDifferenceMinutes)) {
    // Fallback time scoring if timeProximityScore ratio is not directly passed
    if (timeDifferenceMinutes <= 15) timeScore = 95;
    else if (timeDifferenceMinutes <= 60) timeScore = 80;
    else if (timeDifferenceMinutes <= 360) timeScore = 60;
    else timeScore = 40;
  } else {
    missingSignals.push('timeProximity');
  }

  // 4. Attribution Confidence
  let attrScore = 0;
  if (intelligenceConfidence !== undefined && intelligenceConfidence !== null && !isNaN(intelligenceConfidence)) {
    attrScore = Math.min(100, Math.max(0, intelligenceConfidence));
  } else {
    missingSignals.push('attributionConfidence');
  }

  // Calculate weighted scores
  const weightedHop = Number((hopScore * WEIGHTS.hopEfficiency).toFixed(2));
  const weightedFund = Number((fundScore * WEIGHTS.fundContinuity).toFixed(2));
  const weightedTime = Number((timeScore * WEIGHTS.timeProximity).toFixed(2));
  const weightedAttr = Number((attrScore * WEIGHTS.attributionConfidence).toFixed(2));

  const rawOverall = weightedHop + weightedFund + weightedTime + weightedAttr;
  const overallScore = Math.min(100, Math.max(0, Math.round(rawOverall)));

  const totalSignals = 4;
  const dataCompleteness = Number(((totalSignals - missingSignals.length) / totalSignals).toFixed(2));

  const breakdown = {
    hopEfficiency: {
      score: hopScore,
      weight: WEIGHTS.hopEfficiency,
      weightedScore: weightedHop
    },
    fundContinuity: {
      score: fundScore,
      weight: WEIGHTS.fundContinuity,
      weightedScore: weightedFund
    },
    timeProximity: {
      score: timeScore,
      weight: WEIGHTS.timeProximity,
      weightedScore: weightedTime
    },
    attributionConfidence: {
      score: attrScore,
      weight: WEIGHTS.attributionConfidence,
      weightedScore: weightedAttr
    }
  };

  const interpretation = interpretScore(overallScore);

  const explanation = generateExplanation({
    hopCount,
    hopScore,
    fundScore,
    timeScore,
    timeDifferenceMinutes,
    attrScore,
    vasp,
    attributionType: vasp?.attributionType || (attrScore > 0 ? 'DIRECT' : 'UNKNOWN')
  });

  return {
    candidateId: `CANDIDATE_${String(chain).toUpperCase()}_${String(destinationAddress).slice(-6)}`,
    chain: String(chain).toLowerCase(),
    destinationAddress: String(destinationAddress).toLowerCase(),
    vasp: vasp ? {
      name: vasp.name || vasp.vasp || 'Unknown Entity',
      vaspId: vasp.vaspId || null,
      type: vasp.type || 'CEX',
      walletType: vasp.walletType || 'DEPOSIT_WALLET',
      attributionType: vasp.attributionType || 'DIRECT',
      intelligenceConfidence: attrScore,
      sourceType: vasp.sourceType || sourceType
    } : null,
    overallScore,
    rawOverallScore: Number(rawOverall.toFixed(2)),
    scoreMeaning: 'Overall analytical strength of the traced attribution path.',
    interpretation,
    breakdown,
    explanation,
    intelligenceConfidence: attrScore,
    sourceType,
    isSynthetic,
    dataCompleteness,
    missingSignals
  };
}

module.exports = {
  WEIGHTS,
  calculateHopScore,
  scoreCandidate
};
