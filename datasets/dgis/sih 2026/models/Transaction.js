const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    txHash: {
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
      default: 'ETH',
      index: true
    },
    from: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    to: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true
    },
    amount: {
      type: String,
      required: true
    },
    asset: {
      type: String,
      default: 'ETH',
      trim: true
    },
    tokenContract: {
      type: String,
      default: '',
      trim: true
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    },
    blockNumber: {
      type: Number,
      default: 0
    },
    direction: {
      type: String,
      enum: ['INCOMING', 'OUTGOING', 'SELF'],
      default: 'OUTGOING'
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

// Compound unique index on chain + txHash
transactionSchema.index({ chain: 1, txHash: 1 }, { unique: true });

module.exports = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
