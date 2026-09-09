/**
 * Interprets overall analytical score into deterministic attribution path strength bands.
 * Output is neutral analytical categorization, not criminal probability or guilt.
 * @param {number} overallScore - Score between 0 and 100
 * @returns {Object} Interpretation object containing level, label, and description
 */
function interpretScore(overallScore) {
  const score = Math.min(100, Math.max(0, Math.round(overallScore || 0)));

  if (score >= 85) {
    return {
      level: 'HIGH',
      label: 'STRONG_ATTRIBUTION_PATH',
      description: 'Multiple analytical signals strongly support this attribution path.'
    };
  }

  if (score >= 70) {
    return {
      level: 'MEDIUM_HIGH',
      label: 'MODERATE_ATTRIBUTION_PATH',
      description: 'Moderate analytical support for this attribution path.'
    };
  }

  if (score >= 50) {
    return {
      level: 'MEDIUM',
      label: 'WEAK_ATTRIBUTION_PATH',
      description: 'Limited analytical support for this attribution path; additional evidence required.'
    };
  }

  return {
    level: 'LOW',
    label: 'INSUFFICIENT_ATTRIBUTION_PATH',
    description: 'Insufficient analytical evidence to support attribution path.'
  };
}

module.exports = {
  interpretScore
};
