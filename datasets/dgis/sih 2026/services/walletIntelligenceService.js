const repositories = require('../repositories');

class WalletIntelligenceService {
  /**
   * Looks up wallet intelligence for a given chain and address
   * @param {string} chain - Blockchain network (e.g. 'ethereum')
   * @param {string} address - Target wallet address
   * @returns {Promise<Object>} Wallet Intelligence information object
   */
  async getWalletIntelligence(chain = 'ethereum', address) {
    if (!address) {
      throw new Error('Wallet address is required for intelligence lookup');
    }

    let normChain = String(chain || 'ETH').toUpperCase().trim();
    if (normChain === 'ETHEREUM') normChain = 'ETH';
    const normAddress = String(address).trim().toLowerCase();

    const walletIntelRepo = repositories.walletIntelligenceRepository;
    const vaspRepo = repositories.vaspRepository;

    // Search wallet intelligence repository first
    let intel = await walletIntelRepo.findByChainAndAddress(normChain, normAddress);

    // Fallback to VASP repository if not found in wallet intelligence
    if (!intel) {
      const vasp = await vaspRepo.findByChainAndAddress(normChain, normAddress);
      if (vasp) {
        intel = {
          address: vasp.address,
          chain: vasp.chain,
          entityName: vasp.name || vasp.vasp,
          entityType: 'VASP',
          walletType: vasp.walletType || 'DEPOSIT_WALLET',
          clusterId: vasp.clusterId || null,
          confidence: vasp.confidence !== undefined ? vasp.confidence : 80,
          sourceType: vasp.sourceType || 'SYNTHETIC_DEMO',
          isSynthetic: vasp.isSynthetic !== undefined ? vasp.isSynthetic : true
        };
      }
    }

    if (intel) {
      return {
        found: true,
        address: normAddress,
        chain: normChain.toLowerCase(),
        entityName: intel.entityName || null,
        entityType: intel.entityType || 'UNKNOWN',
        walletType: intel.walletType || 'UNKNOWN',
        clusterId: intel.clusterId || null,
        confidence: intel.confidence !== undefined ? intel.confidence : 0,
        sourceType: intel.sourceType || 'SYNTHETIC_DEMO',
        isSynthetic: intel.isSynthetic !== undefined ? intel.isSynthetic : true
      };
    }

    return {
      found: false,
      address: normAddress,
      chain: normChain.toLowerCase(),
      entityName: null,
      entityType: 'UNKNOWN',
      walletType: 'UNKNOWN',
      clusterId: null,
      confidence: 0,
      sourceType: 'NONE',
      isSynthetic: false
    };
  }
}

module.exports = new WalletIntelligenceService();
