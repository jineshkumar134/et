/**
 * Continuity Analysis Helper
 * Calculates amount, asset, and token-contract continuity signals precision-safely.
 */

/**
 * Calculates precision-safe amount continuity ratio
 * @param {string|number} incomingAmount
 * @param {string|number} outgoingAmount
 * @returns {Object} { incomingAmount, outgoingAmount, continuityRatio, status }
 */
function calculateAmountContinuity(incomingAmount, outgoingAmount) {
  const incStr = String(incomingAmount || '0').trim();
  const outStr = String(outgoingAmount || '0').trim();

  const incVal = parseFloat(incStr);
  const outVal = parseFloat(outStr);

  if (isNaN(incVal) || isNaN(outVal) || incVal <= 0 || outVal <= 0) {
    return {
      incomingAmount: incStr,
      outgoingAmount: outStr,
      continuityRatio: 0,
      status: 'NOT_COMPARABLE'
    };
  }

  const ratio = parseFloat((outVal / incVal).toFixed(6));

  let status = 'NORMAL';
  if (outVal > incVal) {
    status = 'EXCEEDED_INCOMING';
  }

  return {
    incomingAmount: incStr,
    outgoingAmount: outStr,
    continuityRatio: ratio,
    status: status
  };
}

/**
 * Compares asset symbols
 */
function checkAssetContinuity(incomingAsset, outgoingAsset) {
  const inc = String(incomingAsset || '').toUpperCase().trim();
  const out = String(outgoingAsset || '').toUpperCase().trim();
  return Boolean(inc && out && inc === out);
}

/**
 * Compares token contract addresses
 */
function checkTokenContractContinuity(incomingContract, outgoingContract) {
  const inc = incomingContract ? String(incomingContract).toLowerCase().trim() : null;
  const out = outgoingContract ? String(outgoingContract).toLowerCase().trim() : null;
  return inc === out;
}

module.exports = {
  calculateAmountContinuity,
  checkAssetContinuity,
  checkTokenContractContinuity
};
