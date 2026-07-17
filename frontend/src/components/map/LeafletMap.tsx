import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Prediction } from '../../types';

// Fix Leaflet default icon paths
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

interface LeafletMapProps {
  predictions: Prediction[];
  activeHorizon: 'current' | '24h' | '48h' | '72h';
  onGridClick: (gridId: number) => void;
}

/* Dynamically re-center map when city changes */
const RecenterMap: React.FC<{ center: [number, number]; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center[0], center[1]]);
  return null;
};

/* AQI Legend floating overlay */
const AQILegend: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const legend = new (L.Control as any)({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div');
      div.innerHTML = `
        <div style="
          background:#fff;border:1px solid #E5E7EB;border-radius:8px;
          padding:10px 12px;font-family:Inter,sans-serif;font-size:11px;
          box-shadow:0 2px 8px rgba(0,0,0,0.1);min-width:130px;
        ">
          <p style="font-size:10px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.06em;margin:0 0 8px">AQI Scale</p>
          ${[
            ['#16A34A','Good','0–50'],
            ['#84CC16','Satisfactory','51–100'],
            ['#F59E0B','Moderate','101–200'],
            ['#EA580C','Poor','201–300'],
            ['#DC2626','Very Poor','301–400'],
            ['#7C3AED','Severe','401+'],
          ].map(([c,l,r]) => `
            <div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">
              <span style="width:12px;height:12px;border-radius:3px;background:${c};display:inline-block;flex-shrink:0"></span>
              <span style="color:#374151;font-weight:600">${l}</span>
              <span style="color:#9CA3AF;margin-left:auto">${r}</span>
            </div>
          `).join('')}
        </div>
      `;
      return div;
    };
    legend.addTo(map);
    return () => { legend.remove(); };
  }, [map]);
  return null;
};

export const LeafletMap: React.FC<LeafletMapProps> = ({ predictions, activeHorizon, onGridClick }) => {
  const center: [number, number] = predictions.length > 0
    ? [
        predictions.reduce((s, p) => s + p.lat, 0) / predictions.length,
        predictions.reduce((s, p) => s + p.lon, 0) / predictions.length,
      ]
    : [12.9716, 77.5946];

  const getAQI = (p: Prediction) => {
    if (activeHorizon === '24h') return p.aqi_24h;
    if (activeHorizon === '48h') return p.aqi_48h;
    if (activeHorizon === '72h') return p.aqi_72h;
    return p.current_aqi;
  };

  const getColor = (p: Prediction) => {
    if (activeHorizon === '24h') return p.aqi_24h_color;
    if (activeHorizon === '48h') return p.aqi_48h_color;
    if (activeHorizon === '72h') return p.aqi_72h_color;
    return p.current_color;
  };

  const getCategory = (p: Prediction) => {
    if (activeHorizon === '24h') return p.aqi_24h_category;
    if (activeHorizon === '48h') return p.aqi_48h_category;
    if (activeHorizon === '72h') return p.aqi_72h_category;
    return p.current_category;
  };

  return (
    <div className="h-full w-full">
      <MapContainer center={center} zoom={11} className="h-full w-full" zoomControl>
        <RecenterMap center={center} zoom={11} />
        {/* CartoDB Positron — clean professional light map */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
          maxZoom={19}
        />
        <AQILegend />

        {predictions.map(p => {
          const aqi      = getAQI(p);
          const color    = getColor(p);
          const category = getCategory(p);
          return (
            <Rectangle
              key={p.grid_id}
              bounds={[[p.lat_min, p.lon_min], [p.lat_max, p.lon_max]]}
              pathOptions={{
                color: color,
                weight: 0.5,
                fillColor: color,
                fillOpacity: 0.45,
                opacity: 0.7,
              }}
              eventHandlers={{ click: () => onGridClick(p.grid_id) }}
            >
              <Popup className="aqi-popup" maxWidth={220}>
                <div style={{ padding: '12px', fontFamily: 'Inter,sans-serif', minWidth: 190 }}>
                  {/* Grid name */}
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8 }}>
                    {p.area_name || `Grid ${p.grid_id + 1}`}
                  </p>
                  {/* AQI value */}
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>
                      {Math.round(aqi)}
                    </span>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                      background: color + '20', color, padding: '2px 6px',
                      borderRadius: 4, letterSpacing: '.05em',
                    }}>
                      {category}
                    </span>
                  </div>
                  {/* Confidence */}
                  <div style={{ marginBottom: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 10, color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 }}>
                        Model Confidence
                      </span>
                      <span style={{ fontSize: 10, color: '#374151', fontWeight: 700 }}>
                        {Math.round(p.confidence)}%
                      </span>
                    </div>
                    <div style={{ height: 3, background: '#F3F4F6', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${p.confidence}%`, background: '#16A34A', borderRadius: 99 }} />
                    </div>
                  </div>
                  {/* Coords */}
                  <p style={{ fontSize: 10, color: '#9CA3AF', marginTop: 8, fontFamily: 'monospace' }}>
                    {p.lat.toFixed(4)}°N, {p.lon.toFixed(4)}°E
                  </p>
                </div>
              </Popup>
            </Rectangle>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default LeafletMap;
