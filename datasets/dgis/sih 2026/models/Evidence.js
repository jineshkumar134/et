const mongoose = require('mongoose');

const evidenceSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    summary: {
      type: String,
      required: true
    },
    tracePath: {
      type: [String],
      default: []
    },
    transactionTrail: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    attributionEvidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    fundFlow: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    scoring: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    topCandidate: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    provenance: {
      blockchainSource: { type: String, default: 'SYNTHETIC_BLOCKCHAIN_DATA' },
      attributionSource: { type: String, default: 'VASP_INTELLIGENCE_DATABASE' },
      dataMode: { type: String, default: 'DEMO' },
      generatedAt: { type: Date, default: Date.now }
    },
    // Phase 9: SHA-256 canonical fingerprint of the evidence bundle
    fingerprintHash: {
      type: String,
      default: null
    },
    // Phase 9: engine version used to produce this evidence
    analysisVersion: {
      type: String,
      default: '1.0.0'
    },
    // Phase 9: marks all demo-mode data as synthetic
    isSynthetic: {
      type: Boolean,
      default: true
    },
    disclaimer: {
      type: String,
      default: 'Generated for authorized LEA investigation use only. All data in DEMO mode is synthetic.'
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Evidence || mongoose.model('Evidence', evidenceSchema);
