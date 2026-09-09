/**
 * scripts/smokeTest.js
 * Phase 12 — Final Integration + Full System Testing + Demo Readiness
 *
 * Comprehensive end-to-end smoke test suite for BIVAE.
 */
"use strict";

const http = require("http");
const config = require("../config/config");
const { startServer } = require("../server");
const seedData = require("./seed");
const repositories = require("../repositories");

async function httpRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const parsed = res.headers["content-type"] && res.headers["content-type"].includes("application/json")
            ? JSON.parse(data)
            : data;
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        }
      });
    });
    req.on("error", (err) => reject(err));
    if (postData) {
      req.write(typeof postData === "string" ? postData : JSON.stringify(postData));
    }
    req.end();
  });
}

async function runSmokeTest() {
  console.log("==================================================");
  console.log(" BIVAE PHASE 12 END-TO-END SYSTEM SMOKE TEST");
  console.log("==================================================\n");

  let serverObj = null;
  let allPassed = true;

  function logPass(title) {
    console.log("[PASS] " + title);
  }

  function logFail(title, detail) {
    console.error("[FAIL] " + title, detail || "");
    allPassed = false;
  }

  try {
    // 1. Seed Synthetic VASP Intelligence
    await seedData();

    // 2. Start Server
    serverObj = await startServer(config.port);
    console.log("[SmokeTest] HTTP Server running on port " + config.port + "\n");

    // 3. Health Endpoint
    const healthRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/health",
      method: "GET"
    });

    if (
      healthRes.status === 200 &&
      healthRes.body.success === true &&
      healthRes.body.status === "HEALTHY" &&
      healthRes.body.database &&
      healthRes.body.blockchain
    ) {
      logPass("Health endpoint");
    } else {
      logFail("Health endpoint", healthRes.body);
    }

    // 4. Create & Execute Synthetic E2E Investigation
    const caseId = "CASE_SMOKE_E2E_" + Date.now();
    const invRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/investigations",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      caseId,
      walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      chain: "ethereum",
      maxDepth: 3
    });

    if (invRes.status === 200 && invRes.body.success === true) {
      logPass("Investigation created");
    } else {
      logFail("Investigation created", invRes.body);
    }

    const invData = invRes.body ? (invRes.body.data || invRes.body) : null;

    if (invData && invData.status === "COMPLETED") {
      logPass("Investigation completed");
    } else {
      logFail("Investigation completed", invData ? invData.status : "NO_DATA");
    }

    // 5. Verify 2-hop Path & Topological Trace
    const visitedNodes = invData && invData.tracing ? invData.tracing.visitedNodes : [];
    if (visitedNodes.length === 3) {
      logPass("2-hop path");
    } else {
      logFail("2-hop path", visitedNodes);
    }

    // 6. Verify Fund Continuity (80%) & Time Difference (7 minutes)
    const rels = invData && invData.fundFlow ? invData.fundFlow.relationships : [];
    const rel = rels.length > 0 ? rels[0] : null;

    if (rel && rel.amountContinuity === 0.8) {
      logPass("Fund continuity = 80%");
    } else {
      logFail("Fund continuity = 80%", rel ? rel.amountContinuity : "MISSING");
    }

    if (rel && rel.timeDifferenceMinutes === 7) {
      logPass("Time difference = 7 minutes");
    } else {
      logFail("Time difference = 7 minutes", rel ? rel.timeDifferenceMinutes : "MISSING");
    }

    // 7. Verify Direct VASP Attribution & Confidence 95
    const topCand = invData ? invData.topCandidate : null;
    const vaspName = topCand && topCand.vasp ? topCand.vasp.name : null;
    const attrType = topCand && topCand.vasp ? topCand.vasp.attributionType : null;
    const confidence = topCand && topCand.vasp ? topCand.vasp.intelligenceConfidence : null;

    if (vaspName === "Exchange Demo A") {
      logPass("Direct VASP attribution");
    } else {
      logFail("Direct VASP attribution", vaspName);
    }

    if (confidence === 95 && attrType === "DIRECT") {
      logPass("VASP confidence = 95");
    } else {
      logFail("VASP confidence = 95", { confidence, attrType });
    }

    // 8. Verify Score
    if (topCand && typeof topCand.overallScore === "number" && topCand.overallScore >= 0 && topCand.overallScore <= 100) {
      logPass("Score generated (overallScore=" + topCand.overallScore + ")");
    } else {
      logFail("Score generated", topCand ? topCand.overallScore : "MISSING");
    }

    // 9. Evidence & SHA-256 Fingerprint
    const evidenceRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/cases/" + caseId + "/evidence",
      method: "GET"
    });

    const evBundle = evidenceRes.body && evidenceRes.body.evidence ? evidenceRes.body.evidence[0] : null;

    if (evBundle && evBundle.caseId === caseId) {
      logPass("Evidence generated");
    } else {
      logFail("Evidence generated", evidenceRes.body);
    }

    if (evBundle && evBundle.fingerprintHash && evBundle.fingerprintHash.startsWith("sha256:")) {
      logPass("SHA-256 evidence fingerprint generated");
    } else {
      logFail("SHA-256 evidence fingerprint generated", evBundle ? evBundle.fingerprintHash : "MISSING");
    }

    // 10. Provenance Verification
    if (evBundle && evBundle.isSynthetic === true && evBundle.analysisVersion === "1.0.0") {
      logPass("Provenance generated");
    } else {
      logFail("Provenance generated", evBundle);
    }

    // 11. Audit Trail Verification
    const auditRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/cases/" + caseId + "/evidence/audit",
      method: "GET"
    });

    if (auditRes.status === 200 && auditRes.body.count >= 5) {
      logPass("Audit trail generated");
    } else {
      logFail("Audit trail generated", auditRes.body);
    }

    // 12. Graph API Verification
    const graphRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/cases/" + caseId + "/graph",
      method: "GET"
    });

    if (graphRes.status === 200 && graphRes.body.graph && graphRes.body.graph.nodes.length === 3 && graphRes.body.graph.edges.length === 2) {
      logPass("Graph generated");
    } else {
      logFail("Graph generated", graphRes.body);
    }

    // 13. Report API Verification
    const reportRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/cases/" + caseId + "/report",
      method: "GET"
    });

    if (reportRes.status === 200 && reportRes.body.report && reportRes.body.report.reportType === "BLOCKCHAIN_VASP_INVESTIGATION") {
      logPass("Report generated");
    } else {
      logFail("Report generated", reportRes.body);
    }

    // 14. SAHYOG Sandbox Intake
    const sahyogReqId = "SAHYOG_SMOKE_" + Date.now();
    const sahyogInvRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/sahyog/investigations",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      requestId: sahyogReqId,
      walletAddress: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      chain: "ethereum",
      priority: "HIGH"
    });

    if (
      sahyogInvRes.status === 200 &&
      sahyogInvRes.body.success === true &&
      sahyogInvRes.body.data.integration.mode === "SANDBOX" &&
      sahyogInvRes.body.data.integration.productionConnected === false
    ) {
      logPass("SAHYOG sandbox investigation");
    } else {
      logFail("SAHYOG sandbox investigation", sahyogInvRes.body);
    }

    const sahyogCaseId = sahyogInvRes.body?.data?.caseId || ("CASE_SAHYOG_" + sahyogReqId);

    // 15. Lawful Action Preparation
    const sahyogActionPrepRes = await httpRequest({
      host: "localhost",
      port: config.port,
      path: "/api/v1/sahyog/actions",
      method: "POST",
      headers: { "Content-Type": "application/json" }
    }, {
      requestId: sahyogReqId,
      caseId: sahyogCaseId,
      actionType: "DISCLOSURE_REQUEST",
      lawfulBasis: "AUTHORIZED_LEA_INVESTIGATION_SEC_91",
      justification: "Action prepared based on the highest-ranked VASP candidate identified from transaction-path and VASP intelligence analysis."
    });

    const actionData = sahyogActionPrepRes.body ? sahyogActionPrepRes.body.data : null;

    if (sahyogActionPrepRes.status === 200 && actionData && actionData.status === "READY" && actionData.target.vasp === "Exchange Demo A") {
      logPass("Disclosure action prepared");
    } else {
      logFail("Disclosure action prepared", sahyogActionPrepRes.body);
    }

    // 16. Sandbox Action Submission
    if (actionData && actionData.actionId) {
      const sahyogSubmitRes = await httpRequest({
        host: "localhost",
        port: config.port,
        path: "/api/v1/sahyog/actions/" + actionData.actionId + "/submit",
        method: "POST"
      });

      const submitData = sahyogSubmitRes.body ? sahyogSubmitRes.body.data : null;

      if (
        sahyogSubmitRes.status === 200 &&
        submitData &&
        submitData.status === "SUBMITTED" &&
        submitData.mode === "SANDBOX"
      ) {
        logPass("Sandbox submission");
      } else {
        logFail("Sandbox submission", sahyogSubmitRes.body);
      }

      if (submitData && submitData.externalSubmission === false) {
        logPass("No external submission");
      } else {
        logFail("No external submission", submitData);
      }
    } else {
      logFail("Sandbox submission", "Action preparation failed earlier");
      logFail("No external submission", "Action preparation failed earlier");
    }

  } catch (error) {
    console.error("[SmokeTest] Unexpected error:", error);
    allPassed = false;
  } finally {
    if (serverObj && serverObj.server) {
      serverObj.server.close();
    }
  }

  console.log("\n==================================================");
  if (allPassed) {
    console.log(" SMOKE TEST RESULT: PASS");
    console.log("==================================================\n");
    process.exit(0);
  } else {
    console.error(" SMOKE TEST RESULT: FAIL");
    console.log("==================================================\n");
    process.exit(1);
  }
}

runSmokeTest();