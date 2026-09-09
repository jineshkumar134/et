// src/api/client.js
// Axios base client — all requests go to /api/v1 (proxied to :5001 in dev)
import axios from 'axios';

const client = axios.create({
  baseURL: '/api/v1',
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor — normalise ALL errors into plain Error objects with .message string
client.interceptors.response.use(
  (res) => res,
  (err) => {
    // Try to extract a human-readable message from the backend response
    const data = err?.response?.data;
    let message = 'An unknown error occurred.';

    if (data) {
      // Backend shape: { error: { message, code } }
      if (data.error?.message) {
        message = String(data.error.message);
      }
      // Backend shape: { message: '...' }
      else if (typeof data.message === 'string') {
        message = data.message;
      }
      // Backend shape: { error: 'string' }
      else if (typeof data.error === 'string') {
        message = data.error;
      }
      // Fallback: stringify (never expose the raw object)
      else if (typeof data === 'string') {
        message = data;
      }
    } else if (err?.message) {
      message = String(err.message);
    }

    // Attach HTTP status for callers that need it
    const normalized = new Error(message);
    normalized.status = err?.response?.status || 0;
    normalized.code   = err?.response?.data?.error?.code || 'NETWORK_ERROR';
    return Promise.reject(normalized);
  }
);

export default client;

/**
 * Safe error formatter — always returns a plain string.
 * Use this everywhere you render an error in JSX.
 *
 * Handles: Error, string, Axios error, backend error object,
 *          validation array, unknown object.
 * Never exposes stack traces or raw [object Object].
 */
export function formatApiError(err) {
  if (!err) return 'An unknown error occurred.';
  if (typeof err === 'string') return err;
  if (err instanceof Error) return err.message || 'Request failed.';
  if (typeof err === 'object') {
    if (err.error?.message) return String(err.error.message);
    if (err.message)        return String(err.message);
    if (err.error)          return typeof err.error === 'string' ? err.error : JSON.stringify(err.error);
    return JSON.stringify(err);
  }
  return String(err);
}
