const mongoose = require('mongoose');

const walletSchema = new mongoose.Schema(
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
    balance: {
      type: String,
      default: '0'
    },
    firstSeen: {
      type: Date,
      default: Date.now
    },
    lastSeen: {
      type: Date,
      default: Date.now
    },
    tags: {
      type: [String],
      default: []
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
    entityName: {
      type: String,
      default: ''
    },
    entityType: {
      type: String,
      default: ''
    },
    clusterId: {
      type: String,
      default: ''
    },
    intelligenceConfidence: {
      type: Number,
      default: 0
    },
    sourceType: {
      type: String,
      default: 'SYNTHETIC_DEMO'
    }
  },
  {
    timestamps: true
  }
);

// Compound unique index on chain + address
walletSchema.index({ chain: 1, address: 1 }, { unique: true });

module.exports = mongoose.models.Wallet || mongoose.model('Wallet', walletSchema);
