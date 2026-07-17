"""
Data Fusion & Data Quality Agent
=================================
Central intelligence layer that collects, validates, cleans, enriches,
fuses, and prepares a unified feature store for all downstream AI agents.

Architecture:
  Raw Sources → Ingestion → Validation → Cleaning → Spatial Fusion
                → Temporal Fusion → Feature Engineering → Quality Scoring
                → Anomaly Detection → Feature Store (published)

All processing is modular, traceable, and pluggable for real APIs later.
"""

import numpy as np
import math
from datetime import datetime, timezone, timedelta
from typing import Optional
import hashlib

# ─── City Bounds (canonical) ──────────────────────────────────────────────────
CITY_BOUNDS = {
    'delhi':     {'lat_min': 28.500, 'lat_max': 28.800, 'lon_min': 77.000, 'lon_max': 77.300, 'lat_c': 28.6139, 'lon_c': 77.2090},
    'mumbai':    {'lat_min': 18.900, 'lat_max': 19.300, 'lon_min': 72.700, 'lon_max': 73.000, 'lat_c': 19.0760, 'lon_c': 72.8777},
    'bengaluru': {'lat_min': 12.834, 'lat_max': 13.143, 'lon_min': 77.460, 'lon_max': 77.780, 'lat_c': 12.9716, 'lon_c': 77.5946},
    'chennai':   {'lat_min': 12.900, 'lat_max': 13.200, 'lon_min': 80.150, 'lon_max': 80.300, 'lat_c': 13.0827, 'lon_c': 80.2707},
    'kolkata':   {'lat_min': 22.400, 'lat_max': 22.700, 'lon_min': 88.300, 'lon_max': 88.450, 'lat_c': 22.5726, 'lon_c': 88.3639},
    'hyderabad': {'lat_min': 17.300, 'lat_max': 17.600, 'lon_min': 78.350, 'lon_max': 78.600, 'lat_c': 17.3850, 'lon_c': 78.4867},
    'ahmedabad': {'lat_min': 22.900, 'lat_max': 23.150, 'lon_min': 72.500, 'lon_max': 72.700, 'lat_c': 23.0225, 'lon_c': 72.5714},
    'pune':      {'lat_min': 18.400, 'lat_max': 18.700, 'lon_min': 73.750, 'lon_max': 74.000, 'lat_c': 18.5204, 'lon_c': 73.8567},
}

# ─── Data Source Definitions ──────────────────────────────────────────────────
DATA_SOURCES = {
    'caaqms': {
        'name': 'CPCB CAAQMS Network',
        'type': 'Ground Station',
        'provider': 'Central Pollution Control Board (CPCB)',
        'endpoint': 'https://app.cpcbccr.com/ccr/#/caaqm-dashboard-all/caaqm-landing/data',
        'parameters': ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3', 'NH3', 'AQI'],
        'update_frequency': '15 min',
        'spatial_coverage': 'Point (station)',
        'format': 'JSON API',
        'auth': 'API Key',
        'pluggable': True,
    },
    'sentinel5p': {
        'name': 'Sentinel-5P TROPOMI',
        'type': 'Satellite',
        'provider': 'ESA Copernicus',
        'endpoint': 'https://s5phub.copernicus.eu/dhus/',
        'parameters': ['NO2', 'SO2', 'CO', 'Aerosol Index', 'CH4', 'HCHO'],
        'update_frequency': '1 day (revisit)',
        'spatial_coverage': '1km × 1km',
        'format': 'NetCDF / GeoTIFF',
        'auth': 'OAuth2',
        'pluggable': True,
    },
    'modis': {
        'name': 'MODIS Terra/Aqua',
        'type': 'Satellite',
        'provider': 'NASA EOSDIS',
        'endpoint': 'https://earthdata.nasa.gov/',
        'parameters': ['AOD', 'Land Surface Temp', 'Fire Detection', 'NDVI'],
        'update_frequency': '1–2 days',
        'spatial_coverage': '500m–1km',
        'format': 'HDF / GeoTIFF',
        'auth': 'Earthdata Login',
        'pluggable': True,
    },
    'weather': {
        'name': 'Open-Meteo / IMD Weather API',
        'type': 'Weather API',
        'provider': 'Open-Meteo (free) / India Meteorological Department (IMD)',
        'endpoint': 'https://api.open-meteo.com/v1/forecast',
        'parameters': ['Temperature', 'Humidity', 'Pressure', 'Wind Speed', 'Wind Dir', 'Rainfall', 'BLH'],
        'update_frequency': '1 hour',
        'spatial_coverage': '1km grid',
        'format': 'JSON',
        'auth': 'None (Open-Meteo) / API Key (IMD)',
        'pluggable': True,
    },
    'traffic': {
        'name': 'HERE / TomTom Traffic API',
        'type': 'Traffic API',
        'provider': 'HERE Technologies / TomTom',
        'endpoint': 'https://data.traffic.hereapi.com/v7/flow',
        'parameters': ['Vehicle Count', 'Speed', 'Congestion Index', 'Heavy Vehicles'],
        'update_frequency': '5 min',
        'spatial_coverage': 'Road segment',
        'format': 'JSON',
        'auth': 'API Key',
        'pluggable': True,
    },
    'gis_osm': {
        'name': 'OpenStreetMap GIS Layers',
        'type': 'GIS',
        'provider': 'OpenStreetMap / Overpass API',
        'endpoint': 'https://overpass-api.de/api/interpreter',
        'parameters': ['Roads', 'Buildings', 'Parks', 'Industry', 'Hospitals', 'Schools'],
        'update_frequency': 'Daily diff',
        'spatial_coverage': 'Vector polygons',
        'format': 'GeoJSON / PBF',
        'auth': 'None',
        'pluggable': True,
    },
    'govt_registry': {
        'name': 'Government Construction & Industrial Registry',
        'type': 'Government Database',
        'provider': 'State PCB / Municipal Corporation',
        'endpoint': 'Internal API (pluggable)',
        'parameters': ['Construction Permits', 'Industrial Registry', 'Waste Sites', 'Crop Burning'],
        'update_frequency': 'Daily',
        'spatial_coverage': 'Point / polygon',
        'format': 'CSV / JSON',
        'auth': 'OAuth2',
        'pluggable': True,
    },
}

# ─── CAAQMS Station Registry per city ────────────────────────────────────────
CAAQMS_STATIONS = {
    'delhi': [
        {'id': 'DEL001', 'name': 'Anand Vihar',    'lat': 28.6469, 'lon': 77.3152, 'zone': 'East'},
        {'id': 'DEL002', 'name': 'RK Puram',        'lat': 28.5638, 'lon': 77.1840, 'zone': 'South'},
        {'id': 'DEL003', 'name': 'Punjabi Bagh',    'lat': 28.6685, 'lon': 77.1282, 'zone': 'West'},
        {'id': 'DEL004', 'name': 'Dwarka Sec 8',    'lat': 28.5733, 'lon': 77.0741, 'zone': 'SW'},
        {'id': 'DEL005', 'name': 'Jahangirpuri',    'lat': 28.7314, 'lon': 77.1625, 'zone': 'North'},
        {'id': 'DEL006', 'name': 'Bawana',          'lat': 28.7943, 'lon': 77.0394, 'zone': 'NW'},
        {'id': 'DEL007', 'name': 'Mundka',          'lat': 28.6848, 'lon': 77.0285, 'zone': 'West'},
        {'id': 'DEL008', 'name': 'Wazirpur',        'lat': 28.7000, 'lon': 77.1600, 'zone': 'North'},
        {'id': 'DEL009', 'name': 'Okhla Phase 2',   'lat': 28.5290, 'lon': 77.2714, 'zone': 'South'},
        {'id': 'DEL010', 'name': 'ITO',             'lat': 28.6274, 'lon': 77.2388, 'zone': 'Central'},
    ],
    'bengaluru': [
        {'id': 'BLR001', 'name': 'Hebbal',              'lat': 13.0350, 'lon': 77.5969, 'zone': 'North'},
        {'id': 'BLR002', 'name': 'Silk Board',          'lat': 12.9124, 'lon': 77.6230, 'zone': 'South'},
        {'id': 'BLR003', 'name': 'City Railway Station','lat': 12.9773, 'lon': 77.5713, 'zone': 'Central'},
        {'id': 'BLR004', 'name': 'Peenya',             'lat': 13.0284, 'lon': 77.5204, 'zone': 'West'},
    ],
    'mumbai': [
        {'id': 'MUM001', 'name': 'Bandra',   'lat': 19.0544, 'lon': 72.8402, 'zone': 'West'},
        {'id': 'MUM002', 'name': 'Colaba',   'lat': 18.9067, 'lon': 72.8147, 'zone': 'South'},
        {'id': 'MUM003', 'name': 'Sion',     'lat': 19.0413, 'lon': 72.8636, 'zone': 'Central'},
        {'id': 'MUM004', 'name': 'Borivali', 'lat': 19.2350, 'lon': 72.8580, 'zone': 'North'},
    ],
}

def _get_stations(city: str) -> list:
    key = city.lower()
    if key in CAAQMS_STATIONS:
        return CAAQMS_STATIONS[key]
    b = CITY_BOUNDS.get(key, CITY_BOUNDS['bengaluru'])
    # Generate 4 default stations spread across the city
    return [
        {'id': f'{key[:3].upper()}00{i}', 'name': f'Station {i}',
         'lat': b['lat_c'] + ((-1)**i) * 0.08, 'lon': b['lon_c'] + ((-1)**(i+1)) * 0.06,
         'zone': z}
        for i, z in enumerate(['North', 'South', 'East', 'West'], 1)
    ]

# ─── Validation Checks ────────────────────────────────────────────────────────
VALID_RANGES = {
    'PM2.5': (0, 1000),  'PM10': (0, 1500),   'NO2':  (0, 500),
    'SO2':   (0, 500),   'CO':   (0, 50),      'O3':   (0, 300),
    'NH3':   (0, 200),   'AQI':  (0, 500),
    'temperature': (-10, 55),  'humidity': (0, 100),
    'wind_speed':  (0, 50),    'pressure': (900, 1050),
}

def _rng(seed_str: str) -> np.random.Generator:
    seed = int(hashlib.md5(seed_str.encode()).hexdigest(), 16) % (2**32)
    return np.random.default_rng(seed)

def _dist_km(lat1, lon1, lat2, lon2) -> float:
    return math.sqrt((lat1 - lat2)**2 + (lon1 - lon2)**2) * 111.0


# ─── Data Fusion Engine ───────────────────────────────────────────────────────
class DataFusionEngine:
    """
    Central data fusion agent.
    Implements ingestion → validation → cleaning → spatial/temporal fusion
    → feature engineering → quality scoring → anomaly detection → feature store.
    """

    def __init__(self):
        self._feature_store: dict = {}   # grid_id → fused feature vector
        self._quality_log:   list = []   # per-run quality records
        self._anomaly_log:   list = []   # detected anomalies
        self._sync_log:      list = []   # synchronisation events
        self._last_refresh:  Optional[datetime] = None

    # ── 1. INGESTION ────────────────────────────────────────────────────────
    def _ingest_caaqms(self, city: str, rng: np.random.Generator) -> list:
        """Simulates CAAQMS station readings. Pluggable for real CPCB API."""
        stations = _get_stations(city)
        readings = []
        for s in stations:
            pm25 = float(rng.uniform(30, 380))
            readings.append({
                'source': 'caaqms',
                'station_id': s['id'],
                'station_name': s['name'],
                'lat': s['lat'], 'lon': s['lon'],
                'timestamp': datetime.now(timezone.utc).isoformat(),
                'PM2.5': round(pm25, 1),
                'PM10':  round(pm25 * rng.uniform(1.4, 2.2), 1),
                'NO2':   round(float(rng.uniform(10, 120)), 1),
                'SO2':   round(float(rng.uniform(5, 80)), 1),
                'CO':    round(float(rng.uniform(0.5, 8.0)), 2),
                'O3':    round(float(rng.uniform(20, 180)), 1),
                'NH3':   round(float(rng.uniform(5, 60)), 1),
                'AQI':   round(float(rng.uniform(50, 450))),
                'raw_valid': True,
            })
        return readings

    def _ingest_satellite(self, city: str, rng: np.random.Generator) -> dict:
        """Simulates Sentinel-5P + MODIS. Pluggable for ESA/NASA APIs."""
        # Simulate occasional missing tile (10% chance)
        tile_missing = rng.random() < 0.10
        return {
            'source': 'satellite',
            'sentinel5p': {
                'NO2_col_density':    round(float(rng.uniform(1e14, 8e14)), 2),
                'SO2_col_density':    round(float(rng.uniform(0.5e13, 4e13)), 2),
                'CO_col_density':     round(float(rng.uniform(2e17, 8e17)), 2),
                'aerosol_index':      round(float(rng.uniform(0.1, 3.5)), 3),
                'CH4_col_density':    round(float(rng.uniform(1820, 1920)), 2),
                'tile_available':     not tile_missing,
                'cloud_fraction':     round(float(rng.uniform(0.0, 0.5)), 3),
                'overpass_time':      datetime.now(timezone.utc).isoformat(),
            },
            'modis': {
                'AOD_550nm':          round(float(rng.uniform(0.1, 1.5)), 3),
                'land_surface_temp':  round(float(rng.uniform(25, 48)), 1),
                'fire_detected':      bool(rng.random() < 0.05),
                'dust_detected':      bool(rng.random() < 0.08),
                'NDVI':               round(float(rng.uniform(0.05, 0.65)), 3),
                'tile_available':     not tile_missing,
            },
        }

    def _ingest_weather(self, city: str, rng: np.random.Generator) -> dict:
        """Simulates weather API. Pluggable for Open-Meteo / IMD."""
        return {
            'source': 'weather',
            'temperature_c':     round(float(rng.uniform(18, 44)), 1),
            'humidity_pct':      round(float(rng.uniform(30, 95))),
            'pressure_hpa':      round(float(rng.uniform(990, 1015)), 1),
            'wind_speed_mps':    round(float(rng.uniform(0.5, 8.0)), 1),
            'wind_direction_deg':round(float(rng.uniform(0, 360))),
            'rainfall_mm':       round(float(rng.uniform(0, 5)), 2),
            'solar_radiation_wm2':round(float(rng.uniform(100, 900))),
            'boundary_layer_height_m': round(float(rng.uniform(200, 1500))),
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }

    def _ingest_traffic(self, city: str, rng: np.random.Generator) -> dict:
        """Simulates traffic API. Pluggable for HERE / TomTom."""
        # Simulate occasional feed delay (8% chance)
        feed_ok = rng.random() > 0.08
        return {
            'source': 'traffic',
            'feed_ok': bool(feed_ok),
            'vehicle_count_per_hr': int(rng.integers(200, 8000)),
            'heavy_vehicle_pct':    round(float(rng.uniform(5, 40)), 1),
            'avg_speed_kmh':        round(float(rng.uniform(8, 60)), 1),
            'congestion_index':     round(float(rng.uniform(0.1, 1.0)), 2),
            'road_density_km_km2':  round(float(rng.uniform(1.0, 12.0)), 2),
            'timestamp': datetime.now(timezone.utc).isoformat() if feed_ok else None,
        }

    def _ingest_gis(self, city: str, rng: np.random.Generator) -> dict:
        """Simulates GIS layer data. Pluggable for OSM / municipal GIS."""
        return {
            'source': 'gis',
            'road_length_km_in_grid': round(float(rng.uniform(0.5, 8.0)), 2),
            'industrial_area_pct':    round(float(rng.uniform(0, 35)), 1),
            'green_cover_pct':        round(float(rng.uniform(2, 45)), 1),
            'construction_sites':     int(rng.integers(0, 5)),
            'schools_count':          int(rng.integers(0, 4)),
            'hospitals_count':        int(rng.integers(0, 3)),
            'population_density':     int(rng.integers(3000, 50000)),
            'water_body_pct':         round(float(rng.uniform(0, 10)), 1),
            'land_use_type':          rng.choice(['Residential', 'Commercial', 'Industrial', 'Mixed', 'Green']),
        }

    def _ingest_govt_registry(self, city: str, rng: np.random.Generator) -> dict:
        """Simulates government construction permits & industrial registry."""
        return {
            'source': 'govt_registry',
            'active_construction_permits': int(rng.integers(0, 20)),
            'registered_industries':       int(rng.integers(0, 15)),
            'waste_burning_incidents_today': int(rng.integers(0, 5)),
            'crop_burning_alerts':         int(rng.integers(0, 3)),
            'festival_nearby':             bool(rng.random() < 0.05),
            'last_updated': datetime.now(timezone.utc).isoformat(),
        }

    # ── 2. VALIDATION ───────────────────────────────────────────────────────
    def _validate_caaqms(self, readings: list) -> tuple[list, list]:
        """Validates CAAQMS readings. Returns (valid_readings, validation_errors)."""
        valid, errors = [], []
        for r in readings:
            row_errors = []
            for param in ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3', 'NH3', 'AQI']:
                val = r.get(param)
                if val is None:
                    row_errors.append(f"Missing {param} at {r['station_id']}")
                    continue
                lo, hi = VALID_RANGES.get(param, (0, 9999))
                if val < 0:
                    row_errors.append(f"Negative {param}={val} at {r['station_id']}")
                elif val > hi:
                    row_errors.append(f"Outlier {param}={val} at {r['station_id']} (max={hi})")
            if not (-90 <= r['lat'] <= 90 and -180 <= r['lon'] <= 180):
                row_errors.append(f"Invalid coordinates ({r['lat']},{r['lon']}) at {r['station_id']}")
            if row_errors:
                errors.extend(row_errors)
                r['raw_valid'] = False
            valid.append(r)
        return valid, errors

    def _validate_weather(self, w: dict) -> list:
        """Validates weather readings."""
        errors = []
        checks = [
            ('temperature_c', 'temperature'), ('humidity_pct', 'humidity'),
            ('wind_speed_mps', 'wind_speed'), ('pressure_hpa', 'pressure'),
        ]
        for field, rng_key in checks:
            val = w.get(field)
            if val is None:
                errors.append(f"Missing weather field: {field}")
                continue
            lo, hi = VALID_RANGES.get(rng_key, (0, 9999))
            if not (lo <= val <= hi):
                errors.append(f"Weather {field}={val} out of range [{lo},{hi}]")
        return errors

    # ── 3. CLEANING ─────────────────────────────────────────────────────────
    def _clean_caaqms(self, readings: list, rng: np.random.Generator) -> list:
        """Imputes missing values, removes outliers, clips to valid range."""
        cleaned = []
        for r in readings:
            cr = dict(r)
            for param in ['PM2.5', 'PM10', 'NO2', 'SO2', 'CO', 'O3', 'NH3']:
                lo, hi = VALID_RANGES.get(param, (0, 9999))
                val = cr.get(param, 0.0)
                if val < 0:
                    cr[param] = 0.0   # negative → zero-clip
                elif val > hi:
                    cr[param] = hi    # extreme outlier → cap at max valid
            cr['cleaned'] = True
            cleaned.append(cr)
        return cleaned

    # ── 4. SPATIAL FUSION ───────────────────────────────────────────────────
    def _nearest_station(self, g_lat, g_lon, stations: list) -> dict:
        """Returns (station_id, distance_km) of nearest CAAQMS station."""
        best = min(stations, key=lambda s: _dist_km(g_lat, g_lon, s['lat'], s['lon']))
        return {
            'station_id':   best.get('id', best.get('station_id', 'UNKNOWN')),
            'station_name': best.get('name', best.get('station_name', 'Unknown Station')),
            'distance_km':  round(_dist_km(g_lat, g_lon, best['lat'], best['lon']), 2),
        }

    def _interpolate_aqi(self, g_lat, g_lon, readings: list) -> float:
        """Inverse-distance weighted interpolation from CAAQMS stations."""
        weights, values = [], []
        for r in readings:
            d = max(_dist_km(g_lat, g_lon, r['lat'], r['lon']), 0.1)
            w = 1.0 / (d ** 2)
            weights.append(w)
            values.append(r['AQI'])
        total_w = sum(weights)
        return round(sum(w * v for w, v in zip(weights, values)) / total_w, 1)

    # ── 5. FEATURE ENGINEERING ──────────────────────────────────────────────
    def _engineer_features(self, grid_id: int, g_lat: float, g_lon: float,
                           caaqms: list, weather: dict, traffic: dict,
                           satellite: dict, gis: dict, govt: dict,
                           rng: np.random.Generator) -> dict:
        """Generates 30+ AI-ready features for a single 1km² grid."""
        # Spatial
        nearest = self._nearest_station(g_lat, g_lon, caaqms)
        interp_aqi = self._interpolate_aqi(g_lat, g_lon, caaqms)

        # Wind transport index: low wind = high accumulation
        ws = weather.get('wind_speed_mps', 2.0)
        blh = weather.get('boundary_layer_height_m', 600)
        wind_transport_idx = round(max(0, 10 - ws) / 10.0, 3)  # 0=dispersive, 1=stagnant
        atm_stability = round(max(0, 1 - (blh / 1500)), 3)      # 0=unstable, 1=stable

        # Urban heat index
        t = weather.get('temperature_c', 30)
        rh = weather.get('humidity_pct', 60)
        uhi = round(t + 0.33 * (rh / 100 * 6.105 * math.exp(17.27 * t / (t + 237.3))) - 4.0, 2)

        # Dust potential index
        dust_idx = round(
            0.3 * (gis.get('industrial_area_pct', 0) / 35)
            + 0.3 * max(0, 1 - gis.get('green_cover_pct', 20) / 45)
            + 0.2 * (gis.get('construction_sites', 0) / 5)
            + 0.2 * max(0, 1 - ws / 8),
            3
        )

        # Vehicle emission index
        veh_count = traffic.get('vehicle_count_per_hr', 1000)
        heavy_pct = traffic.get('heavy_vehicle_pct', 15) / 100
        speed = max(traffic.get('avg_speed_kmh', 30), 5)
        vei = round((veh_count * (1 + 3 * heavy_pct)) / speed, 2)

        # Satellite-derived
        s5p = satellite.get('sentinel5p', {})
        modis = satellite.get('modis', {})
        aod = modis.get('AOD_550nm', 0.3)
        aerosol_idx = s5p.get('aerosol_index', 0.5)

        # Emission hotspot score (composite)
        hotspot = round(
            0.25 * min(interp_aqi / 400, 1.0)
            + 0.20 * min(gis.get('industrial_area_pct', 0) / 35, 1.0)
            + 0.15 * min(gis.get('construction_sites', 0) / 5, 1.0)
            + 0.15 * min(vei / 2000, 1.0)
            + 0.15 * wind_transport_idx
            + 0.10 * aod,
            3
        )

        return {
            # Identity
            'grid_id': grid_id, 'lat': g_lat, 'lon': g_lon,

            # CAAQMS-derived
            'interpolated_aqi':       interp_aqi,
            'nearest_station_id':     nearest['station_id'],
            'nearest_station_name':   nearest['station_name'],
            'nearest_station_dist_km':nearest['distance_km'],

            # Meteorological
            'temperature_c':            weather.get('temperature_c'),
            'humidity_pct':             weather.get('humidity_pct'),
            'pressure_hpa':             weather.get('pressure_hpa'),
            'wind_speed_mps':           ws,
            'wind_direction_deg':       weather.get('wind_direction_deg'),
            'rainfall_mm':              weather.get('rainfall_mm', 0),
            'solar_radiation_wm2':      weather.get('solar_radiation_wm2'),
            'boundary_layer_height_m':  blh,

            # Satellite
            'sentinel5p_no2':           s5p.get('NO2_col_density'),
            'sentinel5p_so2':           s5p.get('SO2_col_density'),
            'sentinel5p_co':            s5p.get('CO_col_density'),
            'sentinel5p_aerosol_idx':   aerosol_idx,
            'sentinel5p_ch4':           s5p.get('CH4_col_density'),
            'modis_aod':                aod,
            'modis_lst':                modis.get('land_surface_temp'),
            'modis_ndvi':               modis.get('NDVI'),
            'modis_fire':               modis.get('fire_detected', False),
            'satellite_tile_ok':        s5p.get('tile_available', True),

            # Traffic
            'vehicle_count_per_hr':     veh_count,
            'heavy_vehicle_pct':        heavy_pct * 100,
            'avg_speed_kmh':            speed,
            'congestion_index':         traffic.get('congestion_index', 0.3),
            'road_density_km_km2':      traffic.get('road_density_km_km2'),
            'traffic_feed_ok':          traffic.get('feed_ok', True),

            # GIS
            'industrial_area_pct':      gis.get('industrial_area_pct'),
            'green_cover_pct':          gis.get('green_cover_pct'),
            'construction_sites':       gis.get('construction_sites'),
            'population_density':       gis.get('population_density'),
            'schools_count':            gis.get('schools_count'),
            'hospitals_count':          gis.get('hospitals_count'),
            'water_body_pct':           gis.get('water_body_pct'),
            'land_use_type':            gis.get('land_use_type'),

            # Government registry
            'active_construction_permits': govt.get('active_construction_permits'),
            'registered_industries':       govt.get('registered_industries'),
            'waste_burning_incidents':     govt.get('waste_burning_incidents_today'),
            'crop_burning_alerts':         govt.get('crop_burning_alerts'),
            'festival_nearby':             govt.get('festival_nearby', False),

            # Engineered AI features
            'wind_transport_index':     wind_transport_idx,
            'atmospheric_stability':    atm_stability,
            'urban_heat_index':         uhi,
            'dust_potential_index':     dust_idx,
            'vehicle_emission_index':   vei,
            'emission_hotspot_score':   hotspot,

            'fused_at': datetime.now(timezone.utc).isoformat(),
        }

    # ── 6. QUALITY SCORING ──────────────────────────────────────────────────
    def _score_source_quality(self, source_key: str, data: dict | list,
                               errors: list, rng: np.random.Generator) -> dict:
        """Assigns 0–100 quality score to each data source."""
        base_scores = {
            'caaqms': 95, 'sentinel5p': 92, 'modis': 90,
            'weather': 98, 'traffic': 88, 'gis_osm': 94, 'govt_registry': 82,
        }
        base = base_scores.get(source_key, 85)
        penalty = len(errors) * 3
        # Small random drift ±3 to simulate real-world variability
        drift = int(rng.integers(-3, 4))
        score = int(np.clip(base - penalty + drift, 40, 100))

        # Specific checks
        latency_ms = int(rng.integers(80, 2500))
        records_processed = int(rng.integers(100, 50000))
        failed_records = int(len(errors))
        missing_pct = round(float(rng.uniform(0, 8)), 1)

        return {
            'source': source_key,
            'quality_score': score,
            'latency_ms': latency_ms,
            'records_processed': records_processed,
            'failed_records': failed_records,
            'missing_pct': missing_pct,
            'errors': errors[:5],  # first 5 errors only
            'status': 'Online' if score > 70 else ('Degraded' if score > 50 else 'Offline'),
            'last_updated': datetime.now(timezone.utc).isoformat(),
        }

    # ── 7. ANOMALY DETECTION ────────────────────────────────────────────────
    def _detect_anomalies(self, readings: list, weather: dict,
                          satellite: dict, traffic: dict,
                          rng: np.random.Generator) -> list:
        """Detects sensor faults, spikes, missing tiles, feed delays."""
        anomalies = []
        now = datetime.now(timezone.utc).isoformat()

        # Check for AQI spikes
        for r in readings:
            if r.get('AQI', 0) > 400:
                anomalies.append({
                    'type': 'AQI Spike',
                    'severity': 'High',
                    'source': 'caaqms',
                    'detail': f"Station {r['station_id']} reported AQI={r['AQI']} — above safe threshold",
                    'station_id': r['station_id'],
                    'detected_at': now,
                    'auto_resolved': False,
                })
            if not r.get('raw_valid', True):
                anomalies.append({
                    'type': 'Sensor Data Quality Failure',
                    'severity': 'Medium',
                    'source': 'caaqms',
                    'detail': f"Station {r['station_id']} reported invalid readings",
                    'station_id': r['station_id'],
                    'detected_at': now,
                    'auto_resolved': False,
                })

        # Satellite tile missing
        if not satellite.get('sentinel5p', {}).get('tile_available', True):
            anomalies.append({
                'type': 'Satellite Tile Missing',
                'severity': 'Medium',
                'source': 'sentinel5p',
                'detail': 'Sentinel-5P tile unavailable — cloud cover or overpass gap',
                'detected_at': now,
                'auto_resolved': False,
            })

        # Traffic feed delay
        if not traffic.get('feed_ok', True):
            anomalies.append({
                'type': 'Traffic Feed Delay',
                'severity': 'Low',
                'source': 'traffic',
                'detail': 'Traffic API feed delayed or unresponsive — last timestamp missing',
                'detected_at': now,
                'auto_resolved': False,
            })

        # Impossible weather
        t = weather.get('temperature_c', 25)
        if t > 50 or t < -15:
            anomalies.append({
                'type': 'Impossible Weather Value',
                'severity': 'High',
                'source': 'weather',
                'detail': f"Temperature={t}°C is outside valid range for Indian subcontinent",
                'detected_at': now,
                'auto_resolved': True,
            })

        # Random sensor offline (2% chance)
        if rng.random() < 0.02:
            anomalies.append({
                'type': 'Sensor Offline',
                'severity': 'High',
                'source': 'caaqms',
                'detail': 'One or more CAAQMS sensors not reporting — telemetry gap detected',
                'detected_at': now,
                'auto_resolved': False,
            })

        return anomalies

    # ── 8. FULL PIPELINE ────────────────────────────────────────────────────
    def run_pipeline(self, city: str, num_grids: int = 400) -> dict:
        """
        Executes the full data fusion pipeline for all grids in the city.
        Returns the feature store + quality report + anomaly log.
        """
        city_key = city.lower()
        b = CITY_BOUNDS.get(city_key, CITY_BOUNDS['bengaluru'])
        lat_step = (b['lat_max'] - b['lat_min']) / 20
        lon_step = (b['lon_max'] - b['lon_min']) / 20

        # Seed RNG deterministically per city (same results per session)
        rng = _rng(city_key + datetime.now(timezone.utc).strftime('%Y-%m-%d-%H'))

        # ── Step 1: Ingest all sources (city-level) ──────────────────
        raw_caaqms   = self._ingest_caaqms(city_key, rng)
        raw_weather  = self._ingest_weather(city_key, rng)
        raw_satellite= self._ingest_satellite(city_key, rng)
        raw_traffic  = self._ingest_traffic(city_key, rng)
        raw_gis      = self._ingest_gis(city_key, rng)
        raw_govt     = self._ingest_govt_registry(city_key, rng)

        # ── Step 2: Validate ─────────────────────────────────────────
        valid_caaqms, caaqms_errors = self._validate_caaqms(raw_caaqms)
        weather_errors = self._validate_weather(raw_weather)

        # ── Step 3: Clean ────────────────────────────────────────────
        clean_caaqms = self._clean_caaqms(valid_caaqms, rng)

        # ── Step 4: Quality scoring per source ──────────────────────
        quality_report = {
            'caaqms':       self._score_source_quality('caaqms', clean_caaqms, caaqms_errors, rng),
            'sentinel5p':   self._score_source_quality('sentinel5p', raw_satellite, [], rng),
            'modis':        self._score_source_quality('modis', raw_satellite, [], rng),
            'weather':      self._score_source_quality('weather', raw_weather, weather_errors, rng),
            'traffic':      self._score_source_quality('traffic', raw_traffic,
                               [] if raw_traffic['feed_ok'] else ['Feed delayed'], rng),
            'gis_osm':      self._score_source_quality('gis_osm', raw_gis, [], rng),
            'govt_registry':self._score_source_quality('govt_registry', raw_govt, [], rng),
        }

        # Overall health
        scores = [v['quality_score'] for v in quality_report.values()]
        overall_health = round(sum(scores) / len(scores))

        # ── Step 5: Anomaly detection ────────────────────────────────
        anomalies = self._detect_anomalies(
            clean_caaqms, raw_weather, raw_satellite, raw_traffic, rng
        )

        # ── Step 6: Spatial fusion — per grid ───────────────────────
        feature_store = {}
        for gid in range(num_grids):
            row = gid // 20
            col = gid % 20
            g_lat = b['lat_min'] + (row + 0.5) * lat_step
            g_lon = b['lon_min'] + (col + 0.5) * lon_step

            # Per-grid GIS slight variation
            g_rng = _rng(city_key + str(gid))
            g_gis = {
                'industrial_area_pct': round(float(g_rng.uniform(0, 35)), 1),
                'green_cover_pct':     round(float(g_rng.uniform(2, 45)), 1),
                'construction_sites':  int(g_rng.integers(0, 5)),
                'schools_count':       int(g_rng.integers(0, 4)),
                'hospitals_count':     int(g_rng.integers(0, 3)),
                'population_density':  int(g_rng.integers(3000, 50000)),
                'water_body_pct':      round(float(g_rng.uniform(0, 10)), 1),
                'land_use_type':       g_rng.choice(['Residential','Commercial','Industrial','Mixed','Green']),
            }
            g_traffic = {
                'feed_ok':              raw_traffic['feed_ok'],
                'vehicle_count_per_hr': int(g_rng.integers(200, 8000)),
                'heavy_vehicle_pct':    round(float(g_rng.uniform(5, 40)), 1),
                'avg_speed_kmh':        round(float(g_rng.uniform(8, 60)), 1),
                'congestion_index':     round(float(g_rng.uniform(0.1, 1.0)), 2),
                'road_density_km_km2':  round(float(g_rng.uniform(1.0, 12.0)), 2),
                'timestamp':            raw_traffic['timestamp'],
            }

            features = self._engineer_features(
                gid, round(g_lat, 6), round(g_lon, 6),
                clean_caaqms, raw_weather, g_traffic,
                raw_satellite, g_gis, raw_govt, g_rng
            )
            feature_store[gid] = features

        self._feature_store = feature_store
        self._quality_log   = list(quality_report.values())
        self._anomaly_log   = anomalies
        self._last_refresh  = datetime.now(timezone.utc)

        # ── Step 7: Build sync log ───────────────────────────────────
        self._sync_log = [
            {'source': k, 'synced_at': datetime.now(timezone.utc).isoformat(),
             'status': v['status'], 'latency_ms': v['latency_ms']}
            for k, v in quality_report.items()
        ]

        return {
            'feature_store_size': len(feature_store),
            'quality_report':     quality_report,
            'overall_health':     overall_health,
            'anomalies':          anomalies,
            'anomaly_count':      len(anomalies),
            'sync_log':           self._sync_log,
            'refreshed_at':       self._last_refresh.isoformat(),
        }

    # ── Getters ─────────────────────────────────────────────────────────────
    def get_status(self) -> dict:
        """Returns live connection status + quality summary."""
        if not self._last_refresh:
            return {'initialized': False}
        return {
            'initialized': True,
            'last_refresh': self._last_refresh.isoformat(),
            'feature_store_grids': len(self._feature_store),
            'sources': [
                {
                    'key': q['source'],
                    'name': DATA_SOURCES.get(q['source'], {}).get('name', q['source']),
                    'type': DATA_SOURCES.get(q['source'], {}).get('type', '—'),
                    'status': q['status'],
                    'quality_score': q['quality_score'],
                    'latency_ms': q['latency_ms'],
                    'records_processed': q['records_processed'],
                    'failed_records': q['failed_records'],
                    'missing_pct': q['missing_pct'],
                    'last_updated': q['last_updated'],
                    'update_frequency': DATA_SOURCES.get(q['source'], {}).get('update_frequency', '—'),
                    'parameters': DATA_SOURCES.get(q['source'], {}).get('parameters', []),
                    'pluggable': DATA_SOURCES.get(q['source'], {}).get('pluggable', True),
                }
                for q in self._quality_log
            ],
            'overall_health': round(sum(q['quality_score'] for q in self._quality_log) / max(len(self._quality_log), 1)),
            'anomalies': self._anomaly_log,
            'anomaly_count': len(self._anomaly_log),
            'sync_log': self._sync_log,
        }

    def get_quality(self) -> dict:
        """Returns detailed quality metrics for all sources."""
        if not self._quality_log:
            return {}
        scores = {q['source']: q for q in self._quality_log}
        overall = round(sum(q['quality_score'] for q in self._quality_log) / len(self._quality_log))
        return {
            'sources': scores,
            'overall_health': overall,
            'grade': 'A' if overall >= 90 else ('B' if overall >= 75 else ('C' if overall >= 60 else 'D')),
        }

    def get_grid_features(self, grid_id: int) -> Optional[dict]:
        """Returns the full fused feature vector for a single grid."""
        return self._feature_store.get(grid_id)

    def get_all_sources(self) -> list:
        """Returns metadata for all registered data sources."""
        return [
            {'key': k, **v}
            for k, v in DATA_SOURCES.items()
        ]

    def get_feature_statistics(self) -> dict:
        """Aggregated statistics across the feature store."""
        if not self._feature_store:
            return {}
        vals = list(self._feature_store.values())
        stats = {}
        numeric_keys = [
            'interpolated_aqi', 'temperature_c', 'humidity_pct', 'wind_speed_mps',
            'industrial_area_pct', 'green_cover_pct', 'population_density',
            'vehicle_emission_index', 'emission_hotspot_score', 'dust_potential_index',
            'wind_transport_index', 'atmospheric_stability', 'modis_aod',
        ]
        for key in numeric_keys:
            vs = [v[key] for v in vals if v.get(key) is not None]
            if vs:
                stats[key] = {
                    'min': round(min(vs), 2),
                    'max': round(max(vs), 2),
                    'mean': round(sum(vs) / len(vs), 2),
                    'count': len(vs),
                }
        return stats


# ─── Singleton instance ───────────────────────────────────────────────────────
_engine_instance: Optional[DataFusionEngine] = None

def get_engine() -> DataFusionEngine:
    global _engine_instance
    if _engine_instance is None:
        _engine_instance = DataFusionEngine()
    return _engine_instance
