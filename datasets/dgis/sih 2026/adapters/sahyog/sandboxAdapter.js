/**
 * adapters/sahyog/sandboxAdapter.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * Concrete Sandbox Adapter for SAHYOG compatibility.
 * Executes local sandbox simulations. Never performs external HTTP calls.
 */
"use strict";

const ISahyogAdapter = require("./interface");

class SandboxAdapter extends ISahyogAdapter {
  constructor() {
    super("SANDBOX");
    this.productionConnected = false;
  }

  async receiveInvestigation(payload) {
    return {
      source: "SAHYOG_API_ADAPTER",
      mode: "SANDBOX",
      productionConnected: false,
      receivedAt: new Date().toISOString()
    };
  }

  async prepareAction(actionData) {
    return {
      source: "SAHYOG_API_ADAPTER",
      mode: "SANDBOX",
      productionConnected: false,
      preparedAt: new Date().toISOString()
    };
  }

  /**
   * Simulates a sandbox action submission locally.
   * Does NOT send external HTTP requests to any government or VASP endpoint.
   */
  async submitAction(actionRecord) {
    const ackId = "SANDBOX-ACK-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    return {
      success: true,
      mode: "SANDBOX",
      productionConnected: false,
      externalSubmission: false,
      submittedAt: new Date().toISOString(),
      message: "Sandbox submission recorded. No real government or VASP request was sent.",
      sandboxAcknowledgement: {
        acknowledged: true,
        acknowledgementId: ackId,
        type: "SYNTHETIC_SANDBOX_ACKNOWLEDGEMENT",
        receivedAt: new Date().toISOString()
      }
    };
  }
}

module.exports = SandboxAdapter;
