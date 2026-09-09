/**
 * adapters/sahyog/index.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * SAHYOG Adapter Factory.
 * Resolves active adapter based on environment configuration.
 * Defaults to SandboxAdapter.
 */
"use strict";

const SandboxAdapter = require("./sandboxAdapter");
const config = require("../../config/config");

const sandboxInstance = new SandboxAdapter();

function getSahyogAdapter() {
  const sahyogMode = String(process.env.SAHYOG_MODE || "SANDBOX").toUpperCase().trim();

  if (sahyogMode === "PRODUCTION") {
    const err = new Error("PRODUCTION_ADAPTER_NOT_CONFIGURED: Production SAHYOG adapter is not configured. Falling back safely.");
    err.statusCode = 501;
    err.code = "PRODUCTION_ADAPTER_NOT_CONFIGURED";
    throw err;
  }

  return sandboxInstance;
}

module.exports = {
  getSahyogAdapter,
  sandboxInstance
};
