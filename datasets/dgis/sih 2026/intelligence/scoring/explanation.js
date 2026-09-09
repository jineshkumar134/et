/**
 * Generates human-readable explanations based on actual score components.
 * @param {Object} params
 * @param {number} params.hopCount
 * @param {number} params.hopScore
 * @param {number} params.fundScore
 * @param {number} params.timeScore
 * @param {number} [params.timeDifferenceMinutes]
 * @param {number} params.attrScore
 * @param {Object} [params.vasp]
 * @param {string} [params.attributionType]
 * @returns {Object} { summary, factors }
 */
function generateExplanation(params = {}) {
  const {
    hopCount = 0,
    hopScore = 0,
    fundScore = 0,
    timeScore = 0,
    timeDifferenceMinutes,
    attrScore = 0,
    vasp,
    attributionType = 'UNKNOWN'
  } = params;

  const factors = [];

  // Factor 1: Attribution
  const isDirect = attributionType === 'DIRECT';
  const isCluster = attributionType === 'CLUSTER';
  const entityName = vasp?.name || vasp?.vasp || 'Unknown Entity';

  let attrExplanation = 'No known VASP matching rule or intelligence entry found for this address.';
  if (isDirect) {
    attrExplanation = `The destination wallet has a direct match in the configured VASP intelligence dataset (${entityName}).`;
  } else if (isCluster) {
    attrExplanation = `The destination wallet is linked via cluster heuristic analysis to ${entityName}.`;
  }

  factors.push({
    factor: 'Attribution',
    result: isDirect ? 'DIRECT' : (isCluster ? 'CLUSTER' : 'UNKNOWN'),
    score: attrScore,
    explanation: attrExplanation
  });

  // Factor 2: Fund Flow
  let fundExplanation = 'Fund-flow analysis indicates minimal or unknown amount continuity.';
  if (fundScore >= 80) {
    fundExplanation = `The analyzed outgoing amount represents approximately ${fundScore}% of the relevant incoming amount.`;
  } else if (fundScore >= 50) {
    fundExplanation = `Partial fund continuity detected (${fundScore}% of outgoing value matched).`;
  } else if (fundScore > 0) {
    fundExplanation = `Low fund continuity detected (${fundScore}% of value matched).`;
  }

  factors.push({
    factor: 'Fund Flow',
    result: `${fundScore}% continuity`,
    score: fundScore,
    explanation: fundExplanation
  });

  // Factor 3: Temporal Proximity
  let timeResultText = timeDifferenceMinutes !== undefined ? `${timeDifferenceMinutes} minutes` : 'Close timing';
  let timeExplanation = 'Transaction timing signal unavailable or distant.';
  if (timeScore >= 85) {
    timeExplanation = `The relevant transactions occur within a short time interval (${timeResultText}).`;
  } else if (timeScore >= 60) {
    timeExplanation = `Moderate temporal proximity observed between incoming and outgoing transfers (${timeResultText}).`;
  } else if (timeScore > 0) {
    timeExplanation = `Extended temporal gap observed between transfers (${timeResultText}).`;
  }

  factors.push({
    factor: 'Temporal Proximity',
    result: timeResultText,
    score: timeScore,
    explanation: timeExplanation
  });

  // Factor 4: Path Depth
  const hopText = hopCount === 1 ? '1 hop' : `${hopCount} hops`;
  let hopExplanation = 'The candidate VASP is reached through a relatively short transaction path.';
  if (hopScore >= 90) {
    hopExplanation = `The candidate VASP is reached through a short transaction path (${hopText}).`;
  } else if (hopScore >= 70) {
    hopExplanation = `The candidate VASP is reached through a multi-hop transaction path (${hopText}).`;
  } else {
    hopExplanation = `The candidate VASP is separated by extended multi-hop transfers (${hopText}).`;
  }

  factors.push({
    factor: 'Path Depth',
    result: hopText,
    score: hopScore,
    explanation: hopExplanation
  });

  // Generate cohesive summary
  const summaryParts = [];
  if (attrScore >= 80) {
    summaryParts.push(isDirect ? 'direct VASP intelligence' : 'cluster VASP intelligence');
  }
  if (fundScore >= 70) {
    summaryParts.push('high fund-flow continuity');
  }
  if (hopScore >= 80) {
    summaryParts.push('short path depth');
  }
  if (timeScore >= 80) {
    summaryParts.push('close transaction timing');
  }

  let summary = '';
  if (summaryParts.length > 0) {
    const strengthWord = (attrScore >= 80 && fundScore >= 70) ? 'Strong' : 'Moderate';
    summary = `${strengthWord} attribution path supported by ${summaryParts.join(', ')}.`;
  } else {
    summary = 'Limited attribution path support based on current analytical signals.';
  }

  return {
    summary,
    factors
  };
}

module.exports = {
  generateExplanation
};
