const repositories = require('../repositories');
const walletIntelligenceService = require('./walletIntelligenceService');

class AttributionService {
  /**
   * Identifies VASP attribution for a target wallet address
   * @param {string} chain - Blockchain network (e.g. 'ethereum')
   * @param {string} address - Wallet address
   * @returns {Promise<Object>} Structured VASP Attribution object
   */
  async attributeWallet(chain = 'ethereum', address) {
    if (!address) {
      throw new Error('Wallet address is required for attribution');
    }

    let normChain = String(chain || 'ETH').toUpperCase().trim();
    if (normChain === 'ETHEREUM') normChain = 'ETH';
    const normAddress = String(address).trim().toLowerCase();

    const vaspRepo = repositories.vaspRepository;

    // 1. Direct VASP lookup
    let vaspRecord = await vaspRepo.findByChainAndAddress(normChain, normAddress);

    // 2. If not found directly, check WalletIntelligence for clusterId or entity match
    let intelRecord = null;
    if (!vaspRecord) {
      intelRecord = await walletIntelligenceService.getWalletIntelligence(normChain, normAddress);
      if (intelRecord.found && intelRecord.clusterId) {
        const clusterMatches = await vaspRepo.findByCluster(intelRecord.clusterId);
        if (clusterMatches.length > 0) {
          vaspRecord = {
            ...clusterMatches[0],
            attributionType: 'CLUSTER'
          };
        }
      }
    }

    // Direct / Cluster Match Found
    if (vaspRecord) {
      const isDirect = vaspRecord.attributionType === 'DIRECT';
      const matchType = isDirect ? 'DIRECT' : 'CLUSTER';

      return {
        attributed: true,
        address: normAddress,
        chain: normChain.toLowerCase(),
        entityType: 'VASP',
        entityName: vaspRecord.name || vaspRecord.vasp,
        vasp: {
          name: vaspRecord.name || vaspRecord.vasp,
          type: vaspRecord.type || 'CEX',
          walletType: vaspRecord.walletType || 'DEPOSIT_WALLET',
          attributionType: vaspRecord.attributionType || matchType
        },
        intelligenceConfidence: vaspRecord.confidence !== undefined ? vaspRecord.confidence : 80,
        sourceType: vaspRecord.sourceType || 'SYNTHETIC_DEMO',
        isSynthetic: vaspRecord.isSynthetic !== undefined ? vaspRecord.isSynthetic : true,
        clusterId: vaspRecord.clusterId || null,
        evidence: {
          matchedAddress: vaspRecord.address || normAddress,
          matchType: matchType,
          source: vaspRecord.sourceType || 'SYNTHETIC_DEMO'
        }
      };
    }

    // Unknown Wallet
    return {
      attributed: false,
      address: normAddress,
      chain: normChain.toLowerCase(),
      entityType: 'UNKNOWN',
      entityName: null,
      vasp: null,
      intelligenceConfidence: 0,
      sourceType: 'NONE',
      isSynthetic: false,
      clusterId: null,
      evidence: null,
      reason: 'NO_KNOWN_VASP_MATCH'
    };
  }

  /**
   * Attaches VASP attribution to Phase 4 / Phase 5 investigation results
   * @param {Object} traceResult - Output from BFS tracer
   * @returns {Promise<Object>} Augmented investigation result with destination attribution
   */
  async attributeTrace(traceResult) {
    if (!traceResult || !traceResult.visitedNodes) {
      return traceResult;
    }

    const chain = traceResult.chain || 'ethereum';
    const destinationAttributions = [];

    for (const addr of traceResult.visitedNodes) {
      const attr = await this.attributeWallet(chain, addr);
      if (attr.attributed) {
        destinationAttributions.push(attr);
      }
    }

    // Attach attribution to trace result
    return {
      ...traceResult,
      attributions: destinationAttributions,
      destinationAttribution: destinationAttributions.length > 0 ? destinationAttributions[destinationAttributions.length - 1] : null
    };
  }
}

module.exports = new AttributionService();
