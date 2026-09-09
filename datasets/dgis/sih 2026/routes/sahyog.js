/**
 * routes/sahyog.js
 * Phase 11 — SAHYOG-Compatible Sandbox Workflow
 *
 * POST /api/v1/sahyog/investigations          — Receive & execute SAHYOG investigation request
 * GET  /api/v1/sahyog/investigations/:requestId — Retrieve SAHYOG request details & case mapping
 * POST /api/v1/sahyog/actions                  — Prepare a Lawful Action (DISCLOSURE / FREEZING)
 * GET  /api/v1/sahyog/actions/:actionId        — Retrieve action details
 * POST /api/v1/sahyog/actions/:actionId/submit — Submit action in Sandbox mode
 */
"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });

const sahyogService = require("../services/sahyogService");
const sahyogActionService = require("../services/sahyogActionService");

/**
 * POST /api/v1/sahyog/investigations
 */
router.post("/investigations", async (req, res, next) => {
  try {
    const result = await sahyogService.receiveInvestigation(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sahyog/investigations/:requestId
 */
router.get("/investigations/:requestId", async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const result = await sahyogService.getSahyogRequest(requestId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sahyog/actions
 */
router.post("/actions", async (req, res, next) => {
  try {
    const result = await sahyogActionService.prepareAction(req.body);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/sahyog/actions/:actionId
 */
router.get("/actions/:actionId", async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const result = await sahyogActionService.getAction(actionId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/sahyog/actions/:actionId/submit
 */
router.post("/actions/:actionId/submit", async (req, res, next) => {
  try {
    const { actionId } = req.params;
    const result = await sahyogActionService.submitAction(actionId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
