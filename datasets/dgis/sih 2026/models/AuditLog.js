const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    action: {
      type: String,
      enum: [
        // Phase 8 actions
        'CASE_CREATED',
        'INVESTIGATION_STARTED',
        'TRACE_EXECUTED',
        'ATTRIBUTION_COMPLETED',
        'EVIDENCE_GENERATED',
        'REPORT_GENERATED',
        'SAHYOG_ACTION_PREPARED',
        'SAHYOG_ACTION_SUBMITTED',
        // Phase 9: stage-level audit actions
        'STAGE_STARTED',
        'STAGE_COMPLETED',
        'STAGE_FAILED',
        'FUND_FLOW_ANALYZED',
        'SCORING_COMPLETED',
        'RANKING_COMPLETED',
        'INVESTIGATION_COMPLETED',
        'INVESTIGATION_FAILED',
        'EVIDENCE_BUNDLE_CREATED',
        'PROVENANCE_RECORDED'
      ],
      required: true
    },
    // Phase 9: which pipeline stage this log belongs to
    stage: {
      type: String,
      default: null
    },
    // Phase 9: actor (system component or user ID) that triggered the action
    actor: {
      type: String,
      default: 'SYSTEM'
    },
    // Phase 9: how long the stage/action took in milliseconds
    durationMs: {
      type: Number,
      default: null
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
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

module.exports = mongoose.models.AuditLog || mongoose.model('AuditLog', auditLogSchema);

