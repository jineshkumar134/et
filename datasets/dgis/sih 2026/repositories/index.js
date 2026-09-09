const { getRepositories, memoryInstances, mongoInstances } = require('./repositoryFactory');

module.exports = {
  get caseRepository() {
    return getRepositories().caseRepo;
  },
  get walletRepository() {
    return getRepositories().walletRepo;
  },
  get transactionRepository() {
    return getRepositories().transactionRepo;
  },
  get vaspRepository() {
    return getRepositories().vaspRepo;
  },
  get walletIntelligenceRepository() {
    return getRepositories().walletIntelligenceRepo;
  },
  get attributionRepository() {
    return getRepositories().attributionRepo;
  },
  get evidenceRepository() {
    return getRepositories().evidenceRepo;
  },
  get auditRepository() {
    return getRepositories().auditRepo;
  },
  get sahyogActionRepository() {
    return getRepositories().sahyogActionRepo;
  },
  getRepositories,
  memoryInstances,
  mongoInstances
};
