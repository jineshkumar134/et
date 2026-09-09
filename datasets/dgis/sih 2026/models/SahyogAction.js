const mongoose = require("mongoose");

const sahyogActionSchema = new mongoose.Schema(
  {
    actionId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    requestId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    caseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    actionType: {
      type: String,
      enum: ["DISCLOSURE_REQUEST", "FREEZING_REQUEST"],
      required: true
    },
    targetVasp: {
      type: String,
      required: true,
      trim: true
    },
    targetAddress: {
      type: String,
      required: true,
      trim: true
    },
    chain: {
      type: String,
      default: "ETH",
      trim: true
    },
    status: {
      type: String,
      enum: ["DRAFT", "READY", "SUBMITTED", "ACKNOWLEDGED", "COMPLETED", "FAILED"],
      default: "DRAFT",
      index: true
    },
    lawfulBasis: {
      type: String,
      required: true,
      trim: true
    },
    justification: {
      type: String,
      required: true,
      trim: true
    },
    mode: {
      type: String,
      default: "SANDBOX"
    },
    submittedAt: {
      type: Date,
      default: null
    },
    investigationReference: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    sandboxAcknowledgement: {
      type: mongoose.Schema.Types.Mixed,
      default: null
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

module.exports = mongoose.models.SahyogAction || mongoose.model("SahyogAction", sahyogActionSchema);
