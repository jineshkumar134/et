/**
 * routes/case.js
 * Phase 10 — Graph API + Investigation Reports + Export
 *
 * GET /api/v1/cases/:caseId/summary
 * GET /api/v1/cases/:caseId/graph
 * GET /api/v1/cases/:caseId/report
 * GET /api/v1/cases/:caseId/export/json
 * GET /api/v1/cases/:caseId/export/transactions.csv
 * GET /api/v1/cases/:caseId/export/graph.json
 * GET /api/v1/cases/:caseId/export/candidates.json
 */
"use strict";

const express = require("express");
const router = express.Router({ mergeParams: true });

const caseSummaryService = require("../services/caseSummaryService");
const graphService = require("../services/graphService");
const reportService = require("../services/reportService");
const exportService = require("../services/exportService");

/**
 * GET /api/v1/cases/:caseId/summary
 */
router.get("/summary", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const summary = await caseSummaryService.getCaseSummary(caseId);
    return res.status(200).json({
      success: true,
      ...summary
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/graph
 */
router.get("/graph", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const filterOpts = {
      depth: req.query.depth !== undefined ? Number(req.query.depth) : undefined,
      nodeType: req.query.nodeType,
      includeIntermediaries: req.query.includeIntermediaries !== undefined ? String(req.query.includeIntermediaries) !== "false" : undefined,
      includeUnknown: req.query.includeUnknown !== undefined ? String(req.query.includeUnknown) !== "false" : undefined,
      candidateOnly: req.query.candidateOnly !== undefined ? String(req.query.candidateOnly) === "true" : undefined
    };

    const graphData = await graphService.buildGraph(caseId, filterOpts);
    return res.status(200).json({
      success: true,
      caseId,
      graph: {
        nodes: graphData.nodes,
        edges: graphData.edges
      },
      highlightedPath: graphData.highlightedPath,
      highlightedEdges: graphData.highlightedEdges,
      metadata: graphData.metadata,
      dataProvenance: graphData.dataProvenance,
      status: graphData.status || "OK"
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/report
 */
router.get("/report", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const report = await reportService.generateInvestigationReport(caseId);
    return res.status(200).json({
      success: true,
      report
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/export/json
 */
router.get("/export/json", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const jsonExport = await exportService.exportCaseAsJSON(caseId);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="case-${caseId}-investigation.json"`);
    return res.status(200).json(jsonExport);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/export/transactions.csv
 */
router.get("/export/transactions.csv", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const csvContent = await exportService.exportCaseTransactionsAsCSV(caseId);

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="case-${caseId}-transactions.csv"`);
    return res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/export/graph.json
 */
router.get("/export/graph.json", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const graphExport = await exportService.exportCaseGraphAsJSON(caseId);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="case-${caseId}-graph.json"`);
    return res.status(200).json(graphExport);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/export/candidates.json
 */
router.get("/export/candidates.json", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const candidateExport = await exportService.exportCaseCandidatesAsJSON(caseId);

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="case-${caseId}-candidates.json"`);
    return res.status(200).json(candidateExport);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/cases/:caseId/sahyog/actions
 */
router.get("/sahyog/actions", async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const sahyogActionService = require("../services/sahyogActionService");
    const result = await sahyogActionService.listActionsByCaseId(caseId);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
