import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

export interface AppConfig {
  city: string;
  resolution: string;
  horizon: 'current' | '24h' | '48h' | '72h';
}

export interface PollutantInfo {
  key: string;
  label: string;
  unit: string;
}

export interface CategoryInfo {
  range: [number, number];
  color: string;
  bgColor: string;
  textColor: string;
}

export interface DashboardMetadata {
  city_name: string;
  city_aqi: number;
  city_category: string;
  dominant_pollutant: string;
  last_updated: string;
  num_grids: number;
  grid_statistics: { title: string; count: number; color: string; key: string }[];
  pollutants: PollutantInfo[];
  aqi_categories: Record<string, CategoryInfo>;
}

interface ConfigContextType {
  config: AppConfig | null;
  metadata: DashboardMetadata | null;
  loading: boolean;
  updateConfig: (newConfig: Partial<AppConfig>) => Promise<void>;
  clearConfig: () => void;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig | null>(() => {
    const saved = localStorage.getItem('aqi_forecast_config');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [metadata, setMetadata] = useState<DashboardMetadata | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetadata = async (currentConfig: AppConfig) => {
    try {
      setLoading(true);
      const res = await axios.get('http://localhost:8000/api/dashboard', {
        params: {
          city: currentConfig.city,
          resolution: currentConfig.resolution,
          // Dynamic internal defaults (hidden from UI)
          model: 'ensemble',
          sources: 'caaqms,weather,sentinel5p,modis,traffic',
        },
      });
      setMetadata(res.data);
    } catch (err) {
      console.error('Error fetching dashboard config metadata from backend', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (config) {
      fetchMetadata(config);
    } else {
      setLoading(false);
    }
  }, [config?.city, config?.resolution]);

  const updateConfig = async (newConfig: Partial<AppConfig>) => {
    setConfig((prev) => {
      const updated = prev
        ? { ...prev, ...newConfig }
        : {
            city: 'bengaluru',
            resolution: '1km',
            horizon: 'current',
            ...newConfig,
          } as AppConfig;
      localStorage.setItem('aqi_forecast_config', JSON.stringify(updated));
      return updated;
    });
  };

  const clearConfig = () => {
    localStorage.removeItem('aqi_forecast_config');
    setConfig(null);
    setMetadata(null);
  };

  return (
    <ConfigContext.Provider value={{ config, metadata, loading, updateConfig, clearConfig }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};
