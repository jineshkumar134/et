/**
 * Temporal Analysis Helper
 * Evaluates time difference, chronological ordering, and normalized proximity score.
 */
function analyzeTemporalProximity(incomingTimestamp, outgoingTimestamp, maxWindowHours = 24) {
  const incDate = new Date(incomingTimestamp);
  const outDate = new Date(outgoingTimestamp);

  const incTime = incDate.getTime();
  const outTime = outDate.getTime();

  if (isNaN(incTime) || isNaN(outTime)) {
    return {
      incomingTimestamp,
      outgoingTimestamp,
      timeDifferenceSeconds: 0,
      timeDifferenceMinutes: 0,
      validOrdering: false,
      timeProximityScore: 0.0
    };
  }

  const diffMs = outTime - incTime;
  const validOrdering = diffMs >= 0;

  const timeDifferenceSeconds = Math.round(diffMs / 1000);
  const timeDifferenceMinutes = parseFloat((diffMs / (1000 * 60)).toFixed(2));

  let timeProximityScore = 0.0;

  if (validOrdering) {
    // Exponential decay score based on minutes elapsed (half-life = 60 mins)
    const rawScore = Math.exp(-Math.max(0, timeDifferenceMinutes) / 60);
    timeProximityScore = parseFloat(rawScore.toFixed(4));
  }

  return {
    incomingTimestamp: incDate.toISOString(),
    outgoingTimestamp: outDate.toISOString(),
    timeDifferenceSeconds,
    timeDifferenceMinutes,
    validOrdering,
    timeProximityScore
  };
}

module.exports = {
  analyzeTemporalProximity
};
