import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, CircleMarker, Polyline, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { EnforcementRecommendation } from '../../api/aqi';

interface EnforcementMapProps {
  recommendations: EnforcementRecommendation[];
  optimizedRoute: EnforcementRecommendation[];
  selectedRec: EnforcementRecommendation | null;
  onGridClick: (gridId: number) => void;
  showRoute: boolean;
}

const RecenterMap: React.FC<{ center: [number, number] }> = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 11);
  }, [center[0], center[1], map]);
  return null;
};

const EnforcementLegend: React.FC = () => {
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
          <p style="font-weight:700; text-transform:uppercase; margin:0 0 6px 0;">Priority Levels</p>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:3px; background:#dc2626; display:inline-block;"></span>
            <span>Critical Priority</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:3px; background:#ea580c; display:inline-block;"></span>
            <span>High Priority</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:3px; background:#eab308; display:inline-block;"></span>
            <span>Medium Priority</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">
            <span style="width:10px; height:10px; border-radius:3px; background:#16a34a; display:inline-block;"></span>
            <span>Low Priority</span>
          </div>
          <div style="display:flex; align-items:center; gap:6px; margin-top:8px;">
            <span style="width:14px; height:2px; border-top:2px dashed #3b82f6; display:inline-block;"></span>
            <span>Inspector Deployment Route</span>
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

export const EnforcementMap: React.FC<EnforcementMapProps> = ({
  recommendations,
  optimizedRoute,
  selectedRec,
  onGridClick,
  showRoute
}) => {
  // Compute map center
  const center: [number, number] = recommendations.length > 0
    ? [
        recommendations.reduce((sum, r) => sum + r.lat, 0) / recommendations.length,
        recommendations.reduce((sum, r) => sum + r.lon, 0) / recommendations.length
      ]
    : [12.9716, 77.5946];

  const getPriorityColor = (priority: string) => {
    if (priority === 'Critical') return '#dc2626'; // Red
    if (priority === 'High') return '#ea580c'; // Orange
    if (priority === 'Medium') return '#eab308'; // Yellow
    return '#16a34a'; // Green for Low
  };

  const getGridBounds = (r: EnforcementRecommendation): [[number, number], [number, number]] => {
    return [
      [r.lat - 0.0045, r.lon - 0.0045],
      [r.lat + 0.0045, r.lon + 0.0045]
    ];
  };

  // Convert optimized route grids to Leaflet polyline points
  const routePoints = optimizedRoute.map(r => [r.lat, r.lon] as [number, number]);

  return (
    <div className="h-full w-full relative">
      <MapContainer center={center} zoom={11} className="h-full w-full">
        <RecenterMap center={center} />
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        <EnforcementLegend />

        {/* 1. Grid Cells */}
        {recommendations.map(r => {
          const color = getPriorityColor(r.priority);
          const isSelected = selectedRec?.grid_id === r.grid_id;
          
          return (
            <Rectangle
              key={r.grid_id}
              bounds={getGridBounds(r)}
              pathOptions={{
                color: isSelected ? '#2563eb' : color,
                weight: isSelected ? 2.5 : 0.8,
                fillColor: color,
                fillOpacity: isSelected ? 0.35 : 0.15
              }}
              eventHandlers={{
                click: () => onGridClick(r.grid_id)
              }}
            />
          );
        })}

        {/* 2. Highlight GIS targets when a cell is inspected */}
        {selectedRec && selectedRec.nearby_sources.map((src, i) => {
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

        {/* 3. Optimized Deployment Route Polyline */}
        {showRoute && routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            pathOptions={{
              color: '#3b82f6',
              weight: 3.0,
              opacity: 0.8,
              dashArray: '8, 8'
            }}
          />
        )}

        {/* 4. Sequence number markers along the route */}
        {showRoute && optimizedRoute.map((r, idx) => (
          <CircleMarker
            key={`route-seq-${idx}`}
            center={[r.lat, r.lon]}
            radius={8}
            pathOptions={{
              color: '#3b82f6',
              weight: 1.5,
              fillColor: '#ffffff',
              fillOpacity: 0.95
            }}
          >
            <Popup>
              <div className="text-xs font-sans font-semibold text-slate-800 p-0.5">
                Stop #{idx + 1}: Sector {r.grid_id + 1} ({r.priority})
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </MapContainer>
    </div>
  );
};
export default EnforcementMap;
