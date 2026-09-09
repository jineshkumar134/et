const mongoose = require('mongoose');

const attributionSchema = new mongoose.Schema(
  {
    walletAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    chain: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'ETH'
    },
    caseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    attributedVaspId: {
      type: String,
      required: true,
      trim: true
    },
    vaspName: {
      type: String,
      required: true,
      trim: true
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    pathScore: {
      type: Number,
      default: 0
    },
    attributionMethod: {
      type: String,
      enum: ['DIRECT_CLUSTER', 'MULTI_HOP_DEPOSIT', 'HEURISTIC'],
      required: true
    },
    hopDistance: {
      type: Number,
      default: 0
    },
    tracePath: {
      type: [String],
      default: []
    },
    supportingTransactions: {
      type: [String],
      default: []
    },
    explanation: {
      type: String,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.models.Attribution || mongoose.model('Attribution', attributionSchema);
