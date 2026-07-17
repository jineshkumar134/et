export type AQICategory = 'Good' | 'Satisfactory' | 'Moderate' | 'Poor' | 'Very Poor' | 'Severe';
export type Trend = 'Increasing' | 'Stable' | 'Decreasing';
export type ForecastHorizon = 'current' | '24h' | '48h' | '72h';

export interface GridBounds {
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
}

export interface GridData {
  grid_id: number;
  row: number;
  col: number;
  lat: number;
  lon: number;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  area_name?: string;
  road_density: number;
  industrial_area_pct: number;
  green_cover_pct: number;
  elevation: number;
}

export interface PollutantData {
  pm25: number;
  pm10: number;
  no2: number;
  so2: number;
  co: number;
  o3: number;
  nh3: number;
}

export interface Prediction extends PollutantData {
  grid_id: number;
  lat: number;
  lon: number;
  lat_min: number;
  lat_max: number;
  lon_min: number;
  lon_max: number;
  row: number;
  col: number;
  timestamp: string;
  current_aqi: number;
  aqi_24h: number;
  aqi_48h: number;
  aqi_72h: number;
  confidence: number;
  trend: Trend;
  current_category: AQICategory;
  aqi_24h_category: AQICategory;
  aqi_48h_category: AQICategory;
  aqi_72h_category: AQICategory;
  current_color: string;
  aqi_24h_color: string;
  aqi_48h_color: string;
  aqi_72h_color: string;
  model_name: string;
  industrial_area_pct: number;
  green_cover_pct: number;
  road_density: number;
  elevation: number;
  aqi: number;
  area_name?: string;
  category?: AQICategory;
  color?: string;
}

export interface CurrentSummary {
  city_aqi: number;
  city_category: AQICategory;
  num_grids: number;
  num_good: number;
  num_satisfactory: number;
  num_moderate: number;
  num_poor: number;
  num_very_poor: number;
  num_severe: number;
  worst_grid_id: number;
  best_grid_id: number;
  dominant_pollutant: string;
  last_updated: string;
}

export interface ModelMetric {
  model_name: string;
  horizon: string;
  rmse: number;
  mae: number;
  r2: number;
  persistence_rmse: number;
  improvement_pct: number;
  train_loss: number[];
  val_loss: number[];
}

export interface TimeSeriesPoint {
  timestamp: string;
  aqi: number;
  category: AQICategory;
  color: string;
}

export interface GridDetail extends Prediction {
  time_series: TimeSeriesPoint[];
  area_name?: string;
}
