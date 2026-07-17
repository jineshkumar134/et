import React, { useEffect, useRef } from 'react';
import type { HealthAdvisory } from '../../api/aqi';

interface Facility {
  name: string;
  lat: number;
  lon: number;
}

interface FacilitiesLayer {
  schools: Facility[];
  hospitals: Facility[];
  old_age_homes: Facility[];
  parks: Facility[];
}

interface Props {
  advisories: HealthAdvisory[];
  facilities: FacilitiesLayer | null;
  selectedGridId: number | null;
  onGridSelect: (advisory: HealthAdvisory) => void;
  showSchools: boolean;
  showHospitals: boolean;
  showOldAgeHomes: boolean;
  showParks: boolean;
  showSensitiveZones?: boolean;
}

const RISK_COLOURS: Record<string, { fill: string; stroke: string; opacity: number }> = {
  'Very Low': { fill: '#16a34a', stroke: '#15803d', opacity: 0.35 },
  'Low':      { fill: '#84cc16', stroke: '#65a30d', opacity: 0.40 },
  'Moderate': { fill: '#f59e0b', stroke: '#d97706', opacity: 0.50 },
  'High':     { fill: '#ef4444', stroke: '#dc2626', opacity: 0.65 },
  'Severe':   { fill: '#7c3aed', stroke: '#6d28d9', opacity: 0.80 },
};

export const HealthRiskMap: React.FC<Props> = ({
  advisories,
  facilities,
  selectedGridId,
  onGridSelect,
  showSchools,
  showHospitals,
  showOldAgeHomes,
  showParks,
  // showSensitiveZones reserved for future overlay
}) => {
  const mapRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const gridLayerRef = useRef<any>(null);
  const facilityLayersRef = useRef<Record<string, any>>({});

  useEffect(() => {
    if (mapInstanceRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    const center = advisories.length > 0
      ? [advisories[Math.floor(advisories.length / 2)].lat, advisories[Math.floor(advisories.length / 2)].lon] as [number, number]
      : [28.6139, 77.2090] as [number, number];

    const map = L.map(mapRef.current, {
      center,
      zoom: 12,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // Satellite / OSM hybrid base layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      opacity: 0.5,
      maxZoom: 19,
    }).addTo(map);

    mapInstanceRef.current = map;
  }, []);

  // Render grid cells whenever advisories change
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || advisories.length === 0) return;

    const map = mapInstanceRef.current;

    if (gridLayerRef.current) {
      gridLayerRef.current.clearLayers();
    } else {
      gridLayerRef.current = L.layerGroup().addTo(map);
    }

    const latStep = 0.015;
    const lonStep = 0.015;

    advisories.forEach(adv => {
      const style = RISK_COLOURS[adv.risk_level] || RISK_COLOURS['Low'];
      const isSelected = adv.grid_id === selectedGridId;

      const bounds = [
        [adv.lat - latStep / 2, adv.lon - lonStep / 2],
        [adv.lat + latStep / 2, adv.lon + lonStep / 2],
      ];

      const rect = L.rectangle(bounds, {
        color: isSelected ? '#ffffff' : style.stroke,
        weight: isSelected ? 2.5 : 0.6,
        fillColor: style.fill,
        fillOpacity: style.opacity,
        className: 'health-risk-cell',
      });

      rect.on('click', () => onGridSelect(adv));

      rect.bindTooltip(
        `<div style="font-family:Inter,sans-serif;font-size:11px;line-height:1.5;padding:2px 4px">
          <b>${adv.ward}</b> — Grid ${adv.grid_id}<br/>
          AQI: <b>${adv.current_aqi}</b> &nbsp;|&nbsp; Risk: <b style="color:${style.fill}">${adv.risk_level}</b><br/>
          Pollutant: <b>${adv.dominant_pollutant}</b>
        </div>`,
        { sticky: true, opacity: 0.97, className: 'health-tooltip' }
      );

      gridLayerRef.current.addLayer(rect);
    });

    // Fit map to advisory bounds
    if (advisories.length > 0) {
      const lats = advisories.map(a => a.lat);
      const lons = advisories.map(a => a.lon);
      map.fitBounds([
        [Math.min(...lats) - 0.02, Math.min(...lons) - 0.02],
        [Math.max(...lats) + 0.02, Math.max(...lons) + 0.02],
      ], { padding: [20, 20] });
    }
  }, [advisories, selectedGridId]);

  // ── Facility Layers ────────────────────────────────────────────────────────
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !facilities) return;
    const map = mapInstanceRef.current;

    // Remove old facility layers
    Object.values(facilityLayersRef.current).forEach((layer: any) => {
      map.removeLayer(layer);
    });
    facilityLayersRef.current = {};

    const addMarkers = (
      key: string,
      items: Facility[],
      emoji: string,
      colour: string,
      visible: boolean
    ) => {
      const layer = L.layerGroup();
      items.forEach(item => {
        const icon = L.divIcon({
          html: `<div style="
            width:22px;height:22px;border-radius:50%;
            background:${colour};border:2px solid rgba(255,255,255,0.8);
            display:flex;align-items:center;justify-content:center;
            font-size:11px;box-shadow:0 2px 6px rgba(0,0,0,0.4);
            cursor:pointer;
          ">${emoji}</div>`,
          className: '',
          iconSize: [22, 22],
          iconAnchor: [11, 11],
        });
        L.marker([item.lat, item.lon], { icon })
          .bindTooltip(`<b>${item.name}</b>`, { sticky: true, opacity: 0.95 })
          .addTo(layer);
      });
      if (visible) layer.addTo(map);
      facilityLayersRef.current[key] = layer;
    };

    addMarkers('schools',      facilities.schools || [],      '🏫', '#3b82f6', showSchools);
    addMarkers('hospitals',    facilities.hospitals || [],    '🏥', '#ef4444', showHospitals);
    addMarkers('old_age_homes',facilities.old_age_homes || [],'🏠', '#f59e0b', showOldAgeHomes);
    addMarkers('parks',        facilities.parks || [],        '🌳', '#22c55e', showParks);
  }, [facilities]);

  // Toggle facility layer visibility
  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current) return;
    const map = mapInstanceRef.current;
    const toggleLayer = (key: string, show: boolean) => {
      const layer = facilityLayersRef.current[key];
      if (!layer) return;
      if (show) { if (!map.hasLayer(layer)) map.addLayer(layer); }
      else       { if (map.hasLayer(layer))  map.removeLayer(layer); }
    };
    toggleLayer('schools',       showSchools);
    toggleLayer('hospitals',     showHospitals);
    toggleLayer('old_age_homes', showOldAgeHomes);
    toggleLayer('parks',         showParks);
  }, [showSchools, showHospitals, showOldAgeHomes, showParks]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapRef} className="w-full h-full" />

      {/* ── Legend ── */}
      <div className="absolute bottom-8 left-3 z-[1000] bg-[#1f2937]/95 border border-[#374151] rounded-lg p-3 text-[10px] text-[#9ca3af] space-y-1.5 shadow-xl">
        <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-2">Health Risk</p>
        {Object.entries(RISK_COLOURS).map(([level, style]) => (
          <div key={level} className="flex items-center gap-2">
            <div className="w-3.5 h-3 rounded-sm border border-white/20" style={{ background: style.fill }} />
            <span>{level}</span>
          </div>
        ))}
        <div className="border-t border-[#374151] pt-1.5 mt-1.5 space-y-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-[#6b7280] mb-1">GIS Overlays</p>
          <div className="flex items-center gap-1.5">🏫 <span>School</span></div>
          <div className="flex items-center gap-1.5">🏥 <span>Hospital</span></div>
          <div className="flex items-center gap-1.5">🏠 <span>Old Age Home</span></div>
          <div className="flex items-center gap-1.5">🌳 <span>Public Park</span></div>
        </div>
      </div>

      {/* ── Attribution ── */}
      <div className="absolute bottom-2 right-14 z-[1000] text-[9px] text-[#4b5563]">
        CPCB Health Advisory Platform • OpenStreetMap
      </div>
    </div>
  );
};

export default HealthRiskMap;
