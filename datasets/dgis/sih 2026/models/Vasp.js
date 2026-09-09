const mongoose = require('mongoose');

const vaspSchema = new mongoose.Schema(
  {
    vaspId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    vasp: {
      type: String,
      trim: true
    },
    type: {
      type: String,
      enum: ['CEX', 'DEX', 'CUSTODIAN', 'BROKER', 'OTHER'],
      default: 'CEX'
    },
    jurisdiction: {
      type: String,
      default: 'GLOBAL'
    },
    address: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },
    chain: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: 'ETH'
    },
    walletType: {
      type: String,
      enum: ['DEPOSIT_WALLET', 'HOT_WALLET', 'COLD_WALLET', 'EXCHANGE_CLUSTER', 'UNKNOWN'],
      required: true,
      default: 'DEPOSIT_WALLET',
      index: true
    },
    attributionType: {
      type: String,
      enum: ['DIRECT', 'CLUSTER', 'INFERRED', 'HEURISTIC', 'UNKNOWN'],
      required: true,
      default: 'DIRECT'
    },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 80
    },
    sourceType: {
      type: String,
      required: true,
      enum: ['SYNTHETIC_DEMO', 'INTELLIGENCE_DATABASE', 'PUBLIC_SOURCE', 'PROVIDER', 'NONE'],
      default: 'SYNTHETIC_DEMO'
    },
    isSynthetic: {
      type: Boolean,
      default: true
    },
    clusterId: {
      type: String,
      default: ''
    },
    leaContactEmail: {
      type: String,
      default: ''
    },
    subpoenaGuide: {
      type: String,
      default: ''
    },
    tags: {
      type: [String],
      default: []
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on chain + address
vaspSchema.index({ chain: 1, address: 1 }, { unique: true });

module.exports = mongoose.models.Vasp || mongoose.model('Vasp', vaspSchema);
