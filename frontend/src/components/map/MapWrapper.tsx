import React from 'react';
import { MAP_CONFIG } from '../../config/mapConfig';
import { LeafletMap } from './LeafletMap';
import type { Prediction } from '../../types';

interface MapWrapperProps {
  predictions: Prediction[];
  activeHorizon: 'current' | '24h' | '48h' | '72h';
  onGridClick: (gridId: number) => void;
}

export const MapWrapper: React.FC<MapWrapperProps> = (props) => {
  if (MAP_CONFIG.provider === 'mapbox') {
    // Mapbox implementation would go here. For now we fallback safely.
    return <LeafletMap {...props} />;
  }
  return <LeafletMap {...props} />;
};
export default MapWrapper;
