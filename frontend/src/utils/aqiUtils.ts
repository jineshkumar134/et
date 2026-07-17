import type { AQICategory } from '../types';

export const AQI_CATEGORIES = {
  Good: { range: [0, 50], color: '#22c55e', bgColor: 'bg-green-500', textColor: 'text-green-400' },
  Satisfactory: { range: [51, 100], color: '#84cc16', bgColor: 'bg-lime-500', textColor: 'text-lime-400' },
  Moderate: { range: [101, 200], color: '#eab308', bgColor: 'bg-yellow-500', textColor: 'text-yellow-400' },
  Poor: { range: [201, 300], color: '#f97316', bgColor: 'bg-orange-500', textColor: 'text-orange-400' },
  'Very Poor': { range: [301, 400], color: '#ef4444', bgColor: 'bg-red-500', textColor: 'text-red-400' },
  Severe: { range: [401, 500], color: '#7c3aed', bgColor: 'bg-purple-700', textColor: 'text-purple-400' },
};

export function getAQICategory(aqi: number): AQICategory {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

export function getAQIColor(aqi: number): string {
  const cat = getAQICategory(aqi);
  return AQI_CATEGORIES[cat]?.color || '#7c3aed';
}

export function getAQIStyle(aqi: number) {
  const cat = getAQICategory(aqi);
  return AQI_CATEGORIES[cat] || AQI_CATEGORIES.Severe;
}

export function getPollutantLabel(key: string): string {
  const labels: Record<string, string> = {
    pm25: 'PM2.5',
    pm10: 'PM10',
    no2: 'NO₂',
    so2: 'SO₂',
    co: 'CO',
    o3: 'O₃',
    nh3: 'NH₃',
  };
  return labels[key] || key.toUpperCase();
}

export function getPollutantUnit(key: string): string {
  const units: Record<string, string> = {
    co: 'mg/m³',
  };
  return units[key] || 'µg/m³';
}
