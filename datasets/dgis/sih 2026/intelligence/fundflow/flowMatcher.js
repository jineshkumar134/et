const { calculateAmountContinuity, checkAssetContinuity, checkTokenContractContinuity } = require('./continuity');
const { analyzeTemporalProximity } = require('./temporalAnalysis');

class FlowMatcher {
  /**
   * Matches an incoming transaction to an outgoing transaction at an intermediate wallet node
   * @param {Object} incTx - Incoming transaction
   * @param {Object} outTx - Outgoing transaction
   * @param {string} walletAddress - Intermediate node address
   * @returns {Object} Flow Relationship Object
   */
  static matchFlow(incTx, outTx, walletAddress) {
    if (!incTx || !outTx) {
      return null;
    }

    const normWallet = String(walletAddress || incTx.to || outTx.from).toLowerCase();
    const chainStr = String(incTx.chain || outTx.chain || 'ethereum').toLowerCase();

    const amountRes = calculateAmountContinuity(incTx.amount, outTx.amount);
    const assetMatch = checkAssetContinuity(incTx.asset, outTx.asset);
    const tokenContractMatch = checkTokenContractContinuity(incTx.tokenContract, outTx.tokenContract);
    const temporalRes = analyzeTemporalProximity(incTx.timestamp, outTx.timestamp);

    let relationship = 'NO_FLOW_MATCH';

    if (amountRes.status === 'NOT_COMPARABLE') {
      relationship = 'NOT_COMPARABLE';
    } else if (!assetMatch || !temporalRes.validOrdering) {
      relationship = 'NO_FLOW_MATCH';
    } else if (assetMatch && temporalRes.validOrdering && amountRes.continuityRatio >= 0.7 && temporalRes.timeDifferenceMinutes <= 60) {
      relationship = 'FULL_FLOW_MATCH';
    } else if (assetMatch && temporalRes.validOrdering && amountRes.continuityRatio > 0.0) {
      relationship = 'PARTIAL_FLOW_MATCH';
    } else if (temporalRes.validOrdering && amountRes.continuityRatio > 0.0) {
      relationship = 'WEAK_FLOW_MATCH';
    }

    return {
      wallet: normWallet,
      incomingTxHash: String(incTx.txHash || incTx.id).toLowerCase(),
      outgoingTxHash: String(outTx.txHash || outTx.id).toLowerCase(),
      chain: chainStr,
      incomingAmount: amountRes.incomingAmount,
      outgoingAmount: amountRes.outgoingAmount,
      asset: String(incTx.asset || 'ETH').toUpperCase(),
      amountContinuity: amountRes.continuityRatio,
      assetMatch: assetMatch,
      tokenContractMatch: tokenContractMatch,
      incomingTimestamp: temporalRes.incomingTimestamp,
      outgoingTimestamp: temporalRes.outgoingTimestamp,
      timeDifferenceSeconds: temporalRes.timeDifferenceSeconds,
      timeDifferenceMinutes: temporalRes.timeDifferenceMinutes,
      validOrdering: temporalRes.validOrdering,
      timeProximityScore: temporalRes.timeProximityScore,
      relationship: relationship,
      dataSource: incTx.dataSource || outTx.dataSource || 'SYNTHETIC_BLOCKCHAIN_DATA',
      isSynthetic: incTx.isSynthetic !== undefined ? Boolean(incTx.isSynthetic) : true
    };
  }
}

module.exports = FlowMatcher;
