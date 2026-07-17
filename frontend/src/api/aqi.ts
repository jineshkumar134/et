import { apiClient } from './client';
import { ENDPOINTS } from '../config/apiConfig';
import type { Prediction, GridDetail, ModelMetric } from '../types';

export interface FetchParams {
  city: string;
  resolution: string;
}

export interface Contribution {
  source: string;
  percentage: number;
  confidence: number;
}

export interface NearbySource {
  name: string;
  type: string;
  distance_km: number;
  lat: number;
  lon: number;
}

export interface SourceAttribution {
  grid_id: number;
  current_aqi: number;
  dominant_pollutant: string;
  contributions: Contribution[];
  confidence: number;
  evidence: string[];
  nearby_sources: NearbySource[];
  wind_speed_mps: number;
  wind_direction_deg: number;
}

export interface EnforcementRecommendation {
  grid_id: number;
  ward: string;
  lat: number;
  lon: number;
  current_aqi: number;
  forecast_aqi: number;
  primary_source: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  priority_score: number;
  reason: string;
  suggested_action: string;
  department: string;
  expected_impact: string;
  confidence: number;
  evidence: string[];
  nearby_sources: NearbySource[];
  urgency: string;
  estimated_inspection_time: string;
  status: 'Pending' | 'Assigned' | 'In Progress' | 'Completed' | 'Rejected';
  assigned_inspector: string;
  compliance_notes: string;
  last_updated: string;
}

export interface EnforcementPayload {
  recommendations: EnforcementRecommendation[];
  optimized_route: EnforcementRecommendation[];
  summary: {
    total_alerts: number;
    critical_count: number;
    high_count: number;
    completed_inspections: number;
    pending_actions: number;
  };
}

export interface PopulationAdvisory {
  category: string;
  precautions: string;
  action: string;
}

export interface FacilityDirective {
  name: string;
  type: string;
  distance_km: number;
  directive: string;
}

export interface NotificationTemplates {
  sms: string;
  whatsapp: string;
  push_notification: string;
  ivr_script: string;
  email_subject: string;
  email_body: string;
  public_display_board: string;
}

export interface HealthAdvisory {
  grid_id: number;
  ward: string;
  lat: number;
  lon: number;
  current_aqi: number;
  forecast_aqi_24h: number;
  forecast_aqi_48h: number;
  forecast_aqi_72h: number;
  dominant_pollutant: string;
  risk_level: 'Very Low' | 'Low' | 'Moderate' | 'High' | 'Severe';
  risk_colour: string;
  risk_score: number;
  confidence: number;
  population_advisories: PopulationAdvisory[];
  nearby_facilities: FacilityDirective[];
  notification_templates: NotificationTemplates;
  translated_phrases: Record<string, string>;
  language: string;
  language_meta: { code: string; name: string; dir: string };
  weather_note: string;
  temperature_c: number;
  humidity_pct: number;
  population_exposed: number;
  generated_at: string;
}

export interface HealthSummary {
  total_grids: number;
  risk_distribution: Record<string, number>;
  high_severe_count: number;
  moderate_count: number;
  total_population_exposed: number;
  schools_at_risk: number;
  hospitals_on_alert: number;
  emergency_alerts: number;
  worst_aqi: number;
  worst_ward: string;
}

export interface HealthPayload {
  advisories: HealthAdvisory[];
  summary: HealthSummary;
  city: string;
  language: string;
  supported_languages: string[];
  facilities: {
    schools: { name: string; lat: number; lon: number }[];
    hospitals: { name: string; lat: number; lon: number }[];
    old_age_homes: { name: string; lat: number; lon: number }[];
    parks: { name: string; lat: number; lon: number }[];
  };
}

export const fetchDashboard = async (params: FetchParams): Promise<any> => {
  const response = await apiClient.get(ENDPOINTS.dashboard, {
    params: {
      city: params.city,
      resolution: params.resolution,
      model: 'ensemble',
      sources: 'caaqms,weather,sentinel5p,modis,traffic',
    }
  });
  return response.data;
};

export const fetchForecast = async (horizon: string, params: FetchParams): Promise<Prediction[]> => {
  const response = await apiClient.get(ENDPOINTS.forecast, {
    params: {
      horizon,
      city: params.city,
      resolution: params.resolution,
      model: 'ensemble',
      sources: 'caaqms,weather,sentinel5p,modis,traffic',
    }
  });
  return response.data;
};

export const fetchGrids = async (params: FetchParams): Promise<any[]> => {
  const response = await apiClient.get(ENDPOINTS.grids, {
    params: {
      city: params.city,
      resolution: params.resolution,
    }
  });
  return response.data;
};

export const fetchGridDetail = async (gridId: number, params: FetchParams): Promise<GridDetail> => {
  const response = await apiClient.get(ENDPOINTS.gridDetail(gridId), {
    params: {
      city: params.city,
      resolution: params.resolution,
      model: 'ensemble',
      sources: 'caaqms,weather,sentinel5p,modis,traffic',
    }
  });
  return response.data;
};

export const fetchMetrics = (params: FetchParams): Promise<ModelMetric[]> => {
  return apiClient.get(ENDPOINTS.metrics, {
    params: {
      city: params.city,
      model: 'ensemble',
    }
  }).then(r => r.data);
};

export const fetchLossCurves = (params: FetchParams): Promise<{ train_loss: number[], val_loss: number[] }> => {
  return apiClient.get(ENDPOINTS.metricsLoss, {
    params: {
      city: params.city,
      model: 'ensemble',
    }
  }).then(r => r.data);
};

export const fetchSourceAttributions = async (
  params: FetchParams,
  filters: { source?: string; pollutant?: string; timeRange?: string }
): Promise<SourceAttribution[]> => {
  const response = await apiClient.get('/api/source-attribution', {
    params: {
      city: params.city,
      resolution: params.resolution,
      source: filters.source || undefined,
      pollutant: filters.pollutant || undefined,
      time_range: filters.timeRange || 'today'
    }
  });
  return response.data;
};

export const fetchGridAttribution = async (
  gridId: number,
  params: FetchParams,
  timeRange?: string
): Promise<SourceAttribution> => {
  const response = await apiClient.get(`/api/source-attribution/${gridId}`, {
    params: {
      city: params.city,
      resolution: params.resolution,
      time_range: timeRange || 'today'
    }
  });
  return response.data;
};

export const fetchEnforcementRecommendations = async (
  params: FetchParams,
  filters: { priority?: string; source?: string; ward?: string }
): Promise<EnforcementPayload> => {
  const response = await apiClient.get('/api/enforcement/recommendations', {
    params: {
      city: params.city,
      resolution: params.resolution,
      priority: filters.priority || undefined,
      source: filters.source || undefined,
      ward: filters.ward || undefined
    }
  });
  return response.data;
};

export const assignInspector = async (
  gridId: number,
  city: string,
  inspectorName: string
): Promise<any> => {
  const response = await apiClient.post('/api/enforcement/assign', {
    grid_id: gridId,
    city,
    inspector_name: inspectorName
  });
  return response.data;
};

export const updateInspectionStatus = async (
  gridId: number,
  city: string,
  status: string,
  complianceNotes?: string
): Promise<any> => {
  const response = await apiClient.post('/api/enforcement/update', {
    grid_id: gridId,
    city,
    status,
    compliance_notes: complianceNotes || ''
  });
  return response.data;
};
export default fetchDashboard;

// ─── Health Advisory API ──────────────────────────────────────────────────────
export const fetchHealthAdvisories = async (
  params: FetchParams,
  filters: { lang?: string; riskLevel?: string; ward?: string }
): Promise<HealthPayload> => {
  const response = await apiClient.get('/api/health/risk', {
    params: {
      city: params.city,
      resolution: params.resolution,
      lang: filters.lang || 'english',
      risk_level: filters.riskLevel || undefined,
      ward: filters.ward || undefined,
    }
  });
  return response.data;
};

export const fetchHealthGrid = async (
  gridId: number,
  params: FetchParams,
  lang: string = 'english'
): Promise<HealthAdvisory> => {
  const response = await apiClient.get(`/api/health/grid/${gridId}`, {
    params: { city: params.city, resolution: params.resolution, lang }
  });
  return response.data;
};

export const fetchHealthWard = async (
  wardId: number,
  params: FetchParams,
  lang: string = 'english'
): Promise<HealthAdvisory> => {
  const response = await apiClient.get(`/api/health/ward/${wardId}`, {
    params: { city: params.city, resolution: params.resolution, lang }
  });
  return response.data;
};

export const sendNotification = async (
  gridId: number,
  city: string,
  lang: string,
  channels: string[]
): Promise<any> => {
  const response = await apiClient.post('/api/notifications/send', {
    grid_id: gridId,
    city,
    lang,
    channels,
  });
  return response.data;
};
