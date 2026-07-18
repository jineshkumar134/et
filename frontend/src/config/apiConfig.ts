export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 30000,
};

export const ENDPOINTS = {
  dashboard: '/api/dashboard',
  forecast: '/api/forecast',
  grids: '/api/grids',
  gridDetail: (id: number) => `/api/grids/${id}`,
  metrics: '/api/model/performance',
  metricsLoss: '/api/model/performance/loss',
  health: '/health',
};
