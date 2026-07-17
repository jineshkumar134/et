export const API_CONFIG = {
  baseUrl: 'http://localhost:8000',
  timeout: 10000,
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
