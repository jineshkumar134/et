# Blockchain Intelligence & VASP Attribution Engine (BIVAE)

> **Tagline**: From Unknown Wallets to Explainable VASP Intelligence.

## Overview
BIVAE is an investigation-oriented cryptocurrency intelligence platform designed for Law Enforcement Agencies (LEAs). It automates multi-hop transaction graph tracing, fund-flow continuity analysis, VASP attribution intelligence lookup, explainable candidate scoring, audit logging, evidence bundling, graph visualization APIs, report generation, and SAHYOG-compatible sandbox integration.

---

## SAHYOG Integration

BIVAE currently implements a **SAHYOG-compatible sandbox adapter**. No real SAHYOG or government endpoint is contacted by the prototype.

- **Request Flow**: LEA/SAHYOG intake requests (`POST /api/v1/sahyog/investigations`) create an internal investigation case, trigger automated tracing, scoring, and attribution, and store structured integration metadata (`mode: "SANDBOX"`, `productionConnected: false`).
- **Lawful Action Preparation**: Investigators can prepare Disclosure Requests (`DISCLOSURE_REQUEST`) and Freezing Requests (`FREEZING_REQUEST`) based on top-ranked VASP attribution candidates.
- **Action Safeguards**: Disclosure and freezing actions are prepared for authorized workflows and are **not autonomously executed**. Actual sandbox submission records a local synthetic acknowledgment and does **not** send any external HTTP requests to external government or VASP APIs.
- **No-VASP Safety**: Action preparation fails safely (`NO_VASP_CANDIDATE`) if no ranked VASP candidate exists for the target wallet.
- **Completed Investigation Enforcement**: Actions can only be prepared for completed investigations (`status === "COMPLETED"`).

---

## Architecture & Pipeline

1. **Intake & Normalization**: Accepts suspect wallet addresses, normalizes chains (`ETH`, `BTC`), and validates input format. Rejects private keys and mnemonic seed phrases.
2. **Blockchain Data Abstraction**: Supports live & mock adapters (`IBlockchainAdapter`, `MockBlockchainAdapter`).
3. **Graph Construction & BFS Tracing**: Traverses transaction paths up to configured `maxDepth`.
4. **Fund-Flow Intelligence**: Analyzes amount continuity, temporal proximity, asset matching, and transfer ordering.
5. **VASP Attribution Intelligence**: Resolves wallet addresses to VASP entities (CEX, DEX, Mixer, Deposit Wallet).
6. **Explainable Scoring Engine**: Weighted multi-signal scoring (Hop Efficiency 20%, Fund Flow 35%, Temporal Proximity 15%, Attribution Confidence 30%). Categorizes candidates into analytical bands (`STRONG_ATTRIBUTION_PATH`, `MODERATE_ATTRIBUTION_PATH`, etc.).
7. **End-to-End Orchestrator**: Manages case lifecycle (`PENDING` → `RUNNING` → `COMPLETED` / `FAILED`).
8. **Evidence & Provenance & Audit**: SHA-256 canonical evidence fingerprinting, synthetic data provenance marking, and full stage-by-stage audit logging.
9. **Graph API & Exports**: Interactive graph representation (`nodes`, `edges`, `highlightedPath`), investigation reports, JSON/CSV exports.
10. **SAHYOG-Compatible Sandbox Workflow**: Lawful action preparation (`DISCLOSURE_REQUEST`, `FREEZING_REQUEST`) in local sandbox mode.

---

## API Endpoints Summary

### SAHYOG Integration
- `POST /api/v1/sahyog/investigations` — Receive & execute SAHYOG investigation request
- `GET  /api/v1/sahyog/investigations/:requestId` — Retrieve request & case details
- `POST /api/v1/sahyog/actions` — Prepare Lawful Action (`DISCLOSURE_REQUEST` / `FREEZING_REQUEST`)
- `GET  /api/v1/sahyog/actions/:actionId` — Retrieve action status & details
- `POST /api/v1/sahyog/actions/:actionId/submit` — Submit action in Sandbox mode
- `GET  /api/v1/cases/:caseId/sahyog/actions` — List all actions prepared for a case

### Investigations & Cases
- `POST /api/v1/investigations` — Start E2E investigation
- `GET  /api/v1/investigations/:caseId` — Retrieve investigation result
- `GET  /api/v1/cases/:caseId/summary` — Get investigator case summary
- `GET  /api/v1/cases/:caseId/graph` — Get graph topology (nodes, edges, highlighted path)
- `GET  /api/v1/cases/:caseId/report` — Get structured JSON report
- `GET  /api/v1/cases/:caseId/export/json` — Export full case JSON
- `GET  /api/v1/cases/:caseId/export/transactions.csv` — Export transaction CSV
- `GET  /api/v1/cases/:caseId/evidence` — Retrieve evidence bundle & SHA-256 fingerprint
- `GET  /api/v1/cases/:caseId/evidence/audit` — Retrieve full audit log

---

## Verification & Testing

To run the complete verification test suite across all 11 phases:

```bash
npm test
```

All data generated in demo mode carries `isSynthetic: true` and `dataMode: "DEMO"`.
