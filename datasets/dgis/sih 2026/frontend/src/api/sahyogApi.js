// src/api/sahyogApi.js
import client from './client';

/**
 * POST /api/v1/sahyog/investigations
 *
 * Backend requires: { requestId (string), walletAddress, chain, priority?, requestedScope? }
 * Returns: { success, data: { requestId, caseId, status, integration, attribution, dataProvenance, investigation } }
 */
export async function createSahyogInvestigation(payload) {
  const res = await client.post('/sahyog/investigations', payload);
  return res.data; // { success: true, data: {...} }
}

/**
 * POST /api/v1/sahyog/actions
 *
 * Backend requires: { requestId, caseId, actionType, targetVaspId? }
 * Returns: { success, data: { actionId, requestId, caseId, actionType, target, status, ... } }
 */
export async function createSahyogAction(payload) {
  const res = await client.post('/sahyog/actions', payload);
  return res.data;
}

/**
 * POST /api/v1/sahyog/actions/:actionId/submit
 * Returns: { success, data: { actionId, status: "SUBMITTED", mode: "SANDBOX", externalSubmission: false, ... } }
 */
export async function submitSahyogAction(actionId) {
  const res = await client.post(`/sahyog/actions/${actionId}/submit`);
  return res.data;
}
