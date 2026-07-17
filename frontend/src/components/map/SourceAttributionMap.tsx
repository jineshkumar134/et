import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { SourceAttribution } from '../../api/aqi';

interface SourceAttributionMapProps {
  attributions: SourceAttribution[];
  selectedAttr: SourceAttribution | null;
  onGridClick: (gridId: number) => void;
  filterSource: string;
  satelliteOverlay: boolean;
}

const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 11);
  }, [center[0], center[1], map]);
  return null;
};

// Custom Legend for Source Map
const SourceLegend: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const legend = new (L.Control as any)({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.innerHTML = `
        <div style="
          background:#1f2937; border:1px solid #374151; border-radius:8px;
          padding:10px; font-family:Inter,sans-serif; font-size:11px; color:#f9fafb;
          box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.1);
        ">
          <p style="font-weight:700; text-transform:uppercase; margin:0 0 6px 0;">GIS Layers</p>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#ef4444; display:inline-block;"></span>
            <span>Industrial Stack</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#f59e0b; display:inline-block;"></span>
            <span>Construction Permit</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:50%; background:#3b82f6; display:inline-block;"></span>
            <span>CAAQMS Monitor</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
            <span style="width:14px; height:2px; background:#10b981; display:inline-block;"></span>
            <span>Wind Vectors</span>
          </div>
        </div>
      `;
      return div;
    };
    legend.addTo(map);
    return () => legend.remove();
  }, [map]);
  return null;
};

export const SourceAttributionMap: React.FC<SourceAttributionMapProps> = ({
  attributions,
  selectedAttr,
  onGridClick,
  filterSource,
  satelliteOverlay
}) => {
  // Center map on average coords of all loaded grids
  const center: [number, number] = attributions.length > 0
    ? [
        attributions.reduce((sum, a) => sum + (a.nearby_sources[0]?.lat || 12.9716), 0) / attributions.length,
        attributions.reduce((sum, a) => sum + (a.nearby_sources[0]?.lon || 77.5946), 0) / attributions.length
      ]
    : [12.9716, 77.5946];

  // Resolve grid boundaries to render bounding box
  const getGridBounds = (g: SourceAttribution): [[number, number], [number, number]] => {
    // Generate simulated bounding box around center coordinate
    const lat = g.nearby_sources[0]?.lat ?? center[0];
    const lon = g.nearby_sources[0]?.lon ?? center[1];
    // Offset for ~1km grid (approx 0.009 degrees latitude)
    return [
      [lat - 0.0045, lon - 0.0045],
      [lat + 0.0045, lon + 0.0045]
    ];
  };

  // Determine display color for each grid cell based on its dominant pollution source contribution
  const getGridColor = (g: SourceAttribution) => {
    if (selectedAttr && selectedAttr.grid_id === g.grid_id) {
      return '#2563eb'; // Blue highlight for selected
    }
    const maxContribution = maxContributionSource(g);
    if (filterSource && filterSource !== maxContribution) {
      return 'transparent'; // Dim grids not matching filter
    }
    
    // Calm corporate colors for sources
    if (maxContribution === 'Traffic') return '#3b82f6'; // Clean Blue
    if (maxContribution === 'Industry') return '#ef4444'; // Red
    if (maxContribution === 'Construction') return '#f59e0b'; // Amber
    if (maxContribution === 'Waste Burning') return '#ec4899'; // Pink
    return '#10b981'; // Green for Dust
  };

  const maxContributionSource = (g: SourceAttribution): string => {
    if (!g.contributions || g.contributions.length === 0) return 'Traffic';
    return g.contributions.reduce((max, c) => c.percentage > max.percentage ? c : max).source;
  };

  // Calculate wind transport polyline coordinates (starts from grid center pointing downwind)
  const getWindPolyline = (g: SourceAttribution): [number, number][] => {
    const lat = g.nearby_sources[0]?.lat ?? center[0];
    const lon = g.nearby_sources[0]?.lon ?? center[1];
    
    // Wind direction is from deg, so downwind is deg + 180
    const bearingRad = ((g.wind_direction_deg + 180) * Math.PI) / 180;
    // Scale line length with wind speed (approx 0.01 degree offset per m/s)
    const lengthFactor = 0.0015 * g.wind_speed_mps;
    
    const endLat = lat + Math.cos(bearingRad) * lengthFactor;
    const endLon = lon + Math.sin(bearingRad) * lengthFactor;
    
    return [[lat, lon], [endLat, endLon]];
  };

  return (
    <div className="h-full w-full relative">
      <MapContainer center={center} zoom={11} className="h-full w-full">
        <RecenterMap center={center} />
        {/* CartoDB light map base for neat GIS visualization */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <SourceLegend />

        {/* 1. Grid Cells overlays */}
        {attributions.map(g => {
          const bounds = getGridBounds(g);
          const color = getGridColor(g);
          if (color === 'transparent') return null;
          
          return (
            <Rectangle
              key={g.grid_id}
              bounds={bounds}
              pathOptions={{
                color: color,
                weight: selectedAttr?.grid_id === g.grid_id ? 2.5 : 0.8,
                fillColor: color,
                fillOpacity: selectedAttr?.grid_id === g.grid_id ? 0.35 : 0.15
              }}
              eventHandlers={{
                click: () => onGridClick(g.grid_id)
              }}
            />
          );
        })}

        {/* 2. Highlight Nearby GIS Sources if a grid cell is selected */}
        {selectedAttr && selectedAttr.nearby_sources.map((src, i) => {
          const markerColor = 
            src.type === 'Industry' ? '#ef4444' : 
            src.type === 'Construction Site' ? '#f59e0b' : '#3b82f6';
            
          return (
            <CircleMarker
              key={i}
              center={[src.lat, src.lon]}
              radius={7}
              pathOptions={{
                color: '#ffffff',
                weight: 1.5,
                fillColor: markerColor,
                fillOpacity: 0.95
              }}
            >
              <Popup>
                <div className="text-[11px] font-sans p-1 text-slate-800">
                  <p className="font-bold">{src.name}</p>
                  <p className="text-slate-500 font-semibold">{src.type}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">{src.distance_km}km from grid center</p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}

        {/* 3. Wind Vector Arrow Polyline on Selected Grid */}
        {selectedAttr && (
          <Polyline
            positions={getWindPolyline(selectedAttr)}
            pathOptions={{
              color: '#10b981',
              weight: 3.5,
              opacity: 0.9,
              dashArray: '5, 5'
            }}
          />
        )}

        {/* 4. Satellite AOD Layer Heatmap Simulation */}
        {satelliteOverlay && attributions.map((g, idx) => {
          const lat = g.nearby_sources[0]?.lat ?? center[0];
          const lon = g.nearby_sources[0]?.lon ?? center[1];
          if (idx % 4 !== 0) return null; // Sparse rendering for visual cleanliness
          
          return (
            <CircleMarker
              key={`sat-${idx}`}
              center={[lat, lon]}
              radius={24}
              pathOptions={{
                color: 'transparent',
                fillColor: '#8b5cf6', // Violet satellite overlay
                fillOpacity: 0.08
              }}
            />
          );
        })}
      </MapContainer>
    </div>
  );
};
export default SourceAttributionMap;
