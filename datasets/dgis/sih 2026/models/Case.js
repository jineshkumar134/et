const mongoose = require('mongoose');

const caseSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    investigatorId: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ['PENDING', 'RUNNING', 'OPEN', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'ARCHIVED'],
      default: 'PENDING',
      index: true
    },
    currentStage: {
      type: String,
      default: 'CASE_CREATION'
    },
    error: {
      stage: { type: String, default: '' },
      message: { type: String, default: '' }
    },
    targetWallets: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: ''
    },
    chain: {
      type: String,
      default: 'ETH',
      trim: true
    },
    investigationScope: {
      type: String,
      default: 'FULL_TRACE'
    },
    maxDepth: {
      type: Number,
      default: 3
    },
    maxTransactions: {
      type: Number,
      default: 100
    },
    timeWindowHours: {
      type: Number,
      default: 72
    },
    candidateCount: {
      type: Number,
      default: 0
    },
    candidates: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    // Phase 11 SAHYOG Integration fields
    sahyogRequestId: {
      type: String,
      default: null,
      trim: true,
      index: true
    },
    sourceSystem: {
      type: String,
      default: 'INTERNAL'
    },
    integrationMode: {
      type: String,
      default: 'SANDBOX'
    },
    dataProvenance: {
      blockchainSource: { type: String, default: 'SYNTHETIC_BLOCKCHAIN_DATA' },
      attributionSource: { type: String, default: 'VASP_INTELLIGENCE_DATABASE' },
      dataMode: { type: String, default: 'DEMO' },
      generatedAt: { type: Date, default: Date.now }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Case || mongoose.model('Case', caseSchema);
