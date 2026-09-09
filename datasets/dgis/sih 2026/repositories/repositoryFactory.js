const { getDbStatus } = require('../config/db');
const config = require('../config/config');

// Mongo Implementations
const CaseRepositoryMongo = require('./mongo/CaseRepositoryMongo');
const WalletRepositoryMongo = require('./mongo/WalletRepositoryMongo');
const TransactionRepositoryMongo = require('./mongo/TransactionRepositoryMongo');
const VaspRepositoryMongo = require('./mongo/VaspRepositoryMongo');
const WalletIntelligenceRepositoryMongo = require('./mongo/WalletIntelligenceRepositoryMongo');
const AttributionRepositoryMongo = require('./mongo/AttributionRepositoryMongo');
const EvidenceRepositoryMongo = require('./mongo/EvidenceRepositoryMongo');
const AuditRepositoryMongo = require('./mongo/AuditRepositoryMongo');
const SahyogActionRepositoryMongo = require('./mongo/SahyogActionRepositoryMongo');

// Memory Implementations
const CaseRepositoryMemory = require('./memory/CaseRepositoryMemory');
const WalletRepositoryMemory = require('./memory/WalletRepositoryMemory');
const TransactionRepositoryMemory = require('./memory/TransactionRepositoryMemory');
const VaspRepositoryMemory = require('./memory/VaspRepositoryMemory');
const WalletIntelligenceRepositoryMemory = require('./memory/WalletIntelligenceRepositoryMemory');
const AttributionRepositoryMemory = require('./memory/AttributionRepositoryMemory');
const EvidenceRepositoryMemory = require('./memory/EvidenceRepositoryMemory');
const AuditRepositoryMemory = require('./memory/AuditRepositoryMemory');
const SahyogActionRepositoryMemory = require('./memory/SahyogActionRepositoryMemory');

// Singletons for In-Memory repositories
const memoryInstances = {
  caseRepo: new CaseRepositoryMemory(),
  walletRepo: new WalletRepositoryMemory(),
  transactionRepo: new TransactionRepositoryMemory(),
  vaspRepo: new VaspRepositoryMemory(),
  walletIntelligenceRepo: new WalletIntelligenceRepositoryMemory(),
  attributionRepo: new AttributionRepositoryMemory(),
  evidenceRepo: new EvidenceRepositoryMemory(),
  auditRepo: new AuditRepositoryMemory(),
  sahyogActionRepo: new SahyogActionRepositoryMemory()
};

// Mongo instances
const mongoInstances = {
  caseRepo: new CaseRepositoryMongo(),
  walletRepo: new WalletRepositoryMongo(),
  transactionRepo: new TransactionRepositoryMongo(),
  vaspRepo: new VaspRepositoryMongo(),
  walletIntelligenceRepo: new WalletIntelligenceRepositoryMongo(),
  attributionRepo: new AttributionRepositoryMongo(),
  evidenceRepo: new EvidenceRepositoryMongo(),
  auditRepo: new AuditRepositoryMongo(),
  sahyogActionRepo: new SahyogActionRepositoryMongo()
};

/**
 * Returns repository collection based on database status.
 * Dynamically resolves between MongoDB and In-Memory implementations.
 */
function getRepositories() {
  const status = getDbStatus();

  if (status === 'CONNECTED' && !config.enableMockDb) {
    return mongoInstances;
  }

  // Default to In-Memory repository mode for mock/testing
  return memoryInstances;
}

module.exports = {
  getRepositories,
  memoryInstances,
  mongoInstances
};
