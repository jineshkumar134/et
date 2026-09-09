// src/api/investigationApi.js
import client from './client';

/**
 * POST /api/v1/investigations
 * Backend expects: { walletAddress, chain (UPPERCASE), maxDepth, maxTransactions, timeWindowHours, investigatorId }
 * Returns the full flat investigation result (caseId, status, suspect, candidates, topCandidate, fundFlow, provenance…)
 */
export async function runInvestigation(payload) {
  const res = await client.post('/investigations', payload);
  // Route returns: { success: true, caseId, status, ...result }
  return res.data;
}

/**
 * GET /api/v1/investigations/:caseId
 * Returns: { success: true, data: { ...investigationResult } }
 */
export async function getInvestigationById(caseId) {
  const res = await client.get(`/investigations/${caseId}`);
  return res.data?.data || res.data;
}

/**
 * GET /api/v1/health
 */
export async function getHealth() {
  const res = await client.get('/health');
  return res.data;
}

/**
 * GET /api/v1/cases  — does NOT exist in backend.
 * We simulate it by returning cached list from localStorage
 * and querying each caseId individually when needed.
 *
 * The backend has no list endpoint, so we maintain a local
 * session-level list and fetch from /investigations/:caseId.
 */
const SESSION_CASES_KEY = 'bivae_session_cases';

export function addCaseToSession(caseId, summary) {
  try {
    const existing = JSON.parse(localStorage.getItem(SESSION_CASES_KEY) || '[]');
    // Deduplicate by caseId
    const filtered = existing.filter((c) => c.caseId !== caseId);
    filtered.unshift({ caseId, ...summary, createdAt: summary.createdAt || new Date().toISOString() });
    // Keep only last 50
    localStorage.setItem(SESSION_CASES_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch {
    // Ignore localStorage errors
  }
}

export function getSessionCases() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_CASES_KEY) || '[]');
  } catch {
    return [];
  }
}
