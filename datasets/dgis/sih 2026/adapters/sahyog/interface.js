/**
 * adapters/sahyog/interface.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * Abstract SAHYOG Adapter Interface.
 * Defines the contract for SAHYOG integration.
 */
"use strict";

class ISahyogAdapter {
  constructor(mode = "SANDBOX") {
    this.mode = mode;
  }

  async receiveInvestigation(payload) {
    throw new Error("receiveInvestigation() must be implemented by concrete adapter");
  }

  async prepareAction(actionData) {
    throw new Error("prepareAction() must be implemented by concrete adapter");
  }

  async submitAction(actionRecord) {
    throw new Error("submitAction() must be implemented by concrete adapter");
  }
}

module.exports = ISahyogAdapter;
