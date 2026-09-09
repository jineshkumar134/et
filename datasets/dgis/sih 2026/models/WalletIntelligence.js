const mongoose = require('mongoose');

const walletIntelligenceSchema = new mongoose.Schema(
  {
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
    entityName: {
      type: String,
      default: ''
    },
    walletType: {
      type: String,
      enum: [
        'UNKNOWN',
        'DEPOSIT_WALLET',
        'HOT_WALLET',
        'COLD_WALLET',
        'EXCHANGE_CLUSTER',
        'MIXER',
        'DEX',
        'DEFI',
        'BRIDGE',
        'CROSS_CHAIN_SERVICE'
      ],
      default: 'UNKNOWN',
      index: true
    },
    entityType: {
      type: String,
      enum: ['VASP', 'MIXER', 'DEX', 'DEFI', 'BRIDGE', 'SERVICE', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true
    },
    clusterId: {
      type: String,
      default: ''
    },
    confidence: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    sourceType: {
      type: String,
      enum: ['SYNTHETIC_DEMO', 'INTELLIGENCE_DATABASE', 'PUBLIC_SOURCE', 'PROVIDER', 'NONE'],
      default: 'SYNTHETIC_DEMO'
    },
    isSynthetic: {
      type: Boolean,
      default: true
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
walletIntelligenceSchema.index({ chain: 1, address: 1 }, { unique: true });

module.exports = mongoose.models.WalletIntelligence || mongoose.model('WalletIntelligence', walletIntelligenceSchema);
