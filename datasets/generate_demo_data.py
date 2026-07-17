"""
Synthetic Demo Data Generator for Hyperlocal AQI Forecasting System
====================================================================
Generates realistic CSV datasets for all 5 data source types:
  - caaqms.csv      (station readings: pollutants + AQI)
  - weather.csv     (per-grid weather forecasts)
  - satellite.csv   (Sentinel-5P / MODIS features)
  - traffic.csv     (vehicle density, speed, congestion)
  - spatial.csv     (static per-grid spatial features)

Generated data mirrors the EXACT schema expected by the ML pipeline loaders.
Replace these CSVs with real data by pointing loaders to your real files.
"""

import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta
import sys

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from config.settings import settings
    GRID_ROWS = settings.GRID_ROWS
    GRID_COLS = settings.GRID_COLS
    LAT_MIN = getattr(settings, 'CITY_LAT_MIN', getattr(settings, 'LAT_MIN', 28.40))
    LAT_MAX = getattr(settings, 'CITY_LAT_MAX', getattr(settings, 'LAT_MAX', 28.88))
    LON_MIN = getattr(settings, 'CITY_LON_MIN', getattr(settings, 'LON_MIN', 76.84))
    LON_MAX = getattr(settings, 'CITY_LON_MAX', getattr(settings, 'LON_MAX', 77.35))
except Exception:
    # Standalone fallback
    GRID_ROWS, GRID_COLS = 20, 20
    LAT_MIN, LAT_MAX = 28.40, 28.88
    LON_MIN, LON_MAX = 76.84, 77.35

NUM_GRIDS = GRID_ROWS * GRID_COLS
LAT_STEP = (LAT_MAX - LAT_MIN) / GRID_ROWS
LON_STEP = (LON_MAX - LON_MIN) / GRID_COLS

# ── Simulation Parameters ──────────────────────────────────────────────────────

np.random.seed(42)

# 30 days of hourly data
DAYS = 30
START_TIME = datetime.utcnow() - timedelta(days=DAYS)
TIMESTAMPS = [START_TIME + timedelta(hours=h) for h in range(DAYS * 24)]

# Number of CAAQMS stations (a subset of grids)
STATION_GRID_IDS = [10, 45, 110, 155, 200, 245, 290, 335, 380, 12, 87, 178]


# ── Helper Functions ──────────────────────────────────────────────────────────

def grid_center(grid_id: int):
    row = grid_id // GRID_COLS
    col = grid_id % GRID_COLS
    lat = LAT_MIN + (row + 0.5) * LAT_STEP
    lon = LON_MIN + (col + 0.5) * LON_STEP
    return lat, lon


def zone_base_aqi(grid_id: int) -> float:
    """Assign base AQI per zone type: industrial > traffic > residential > green."""
    row = grid_id // GRID_COLS
    col = grid_id % GRID_COLS
    # Industrial: top-left quadrant
    if row < 5 and col < 5:
        return np.random.uniform(220, 320)
    # Heavy traffic corridors: main diagonal
    if abs(row - col) <= 1:
        return np.random.uniform(160, 250)
    # Green zones: bottom-right
    if row > 15 and col > 15:
        return np.random.uniform(35, 85)
    # Construction zones: random cluster
    if 8 <= row <= 10 and 12 <= col <= 15:
        return np.random.uniform(180, 280)
    return np.random.uniform(80, 170)


def diurnal_factor(hour: int) -> float:
    """Traffic + atmospheric mixing pattern."""
    if 7 <= hour <= 10:   return 1.35   # morning rush
    if 17 <= hour <= 20:  return 1.45   # evening rush
    if 0 <= hour <= 4:    return 0.70   # night dispersion
    if 11 <= hour <= 15:  return 0.90   # midday mixing
    return 1.0


def seasonal_factor(month: int) -> float:
    """Winter = worse AQI (temp inversion, crop burning in N. India)."""
    if month in [11, 12, 1]:  return 1.40
    if month in [3, 9, 10]:   return 1.15
    return 1.0


def compute_aqi(pm25, pm10, no2, so2, co, o3, nh3) -> float:
    """Simplified CPCB sub-index calculation."""
    def sub_idx(c, bp):
        for cl, ch, il, ih in bp:
            if cl <= c <= ch:
                return il + (c - cl) / (ch - cl) * (ih - il)
        return 500.0

    pm25_bp = [(0,30,0,50),(30,60,51,100),(60,90,101,200),(90,120,201,300),(120,250,301,400),(250,500,401,500)]
    pm10_bp = [(0,50,0,50),(50,100,51,100),(100,250,101,200),(250,350,201,300),(350,430,301,400),(430,600,401,500)]
    no2_bp  = [(0,40,0,50),(40,80,51,100),(80,180,101,200),(180,280,201,300),(280,400,301,400),(400,800,401,500)]
    so2_bp  = [(0,40,0,50),(40,80,51,100),(80,380,101,200),(380,800,201,300),(800,1600,301,400),(1600,2000,401,500)]
    co_bp   = [(0,1,0,50),(1,2,51,100),(2,10,101,200),(10,17,201,300),(17,34,301,400),(34,50,401,500)]
    o3_bp   = [(0,50,0,50),(50,100,51,100),(100,168,101,200),(168,208,201,300),(208,748,301,400),(748,1000,401,500)]
    nh3_bp  = [(0,200,0,50),(200,400,51,100),(400,800,101,200),(800,1200,201,300),(1200,1800,301,400),(1800,2400,401,500)]

    subs = [
        sub_idx(pm25, pm25_bp), sub_idx(pm10, pm10_bp),
        sub_idx(no2, no2_bp),   sub_idx(so2, so2_bp),
        sub_idx(co, co_bp),     sub_idx(o3, o3_bp),
        sub_idx(nh3, nh3_bp),
    ]
    return float(np.clip(max(subs), 0, 500))


# ── Pre-compute Base AQI per Grid (constant, zone-determined) ─────────────────

print("Computing base AQI profiles per grid...")
BASE_AQI = {gid: zone_base_aqi(gid) for gid in range(NUM_GRIDS)}

# Grid-level random state for reproducibility
GRID_NOISE_SEEDS = {gid: np.random.RandomState(gid) for gid in range(NUM_GRIDS)}


# ── 1. CAAQMS Station Data ────────────────────────────────────────────────────

def generate_caaqms() -> pd.DataFrame:
    """Hourly readings from CAAQMS stations."""
    print(f"Generating CAAQMS data for {len(STATION_GRID_IDS)} stations × {len(TIMESTAMPS)} hours...")
    rows = []
    for ts in TIMESTAMPS:
        hour = ts.hour
        month = ts.month
        df = diurnal_factor(hour)
        sf = seasonal_factor(month)

        for station_id, grid_id in enumerate(STATION_GRID_IDS):
            rng = GRID_NOISE_SEEDS[grid_id]
            base = BASE_AQI[grid_id] * df * sf

            pm25  = float(np.clip(base * 0.30 + rng.normal(0, 5), 5, 300))
            pm10  = float(np.clip(base * 0.50 + rng.normal(0, 8), 10, 500))
            no2   = float(np.clip(base * 0.15 + rng.normal(0, 4), 5, 150))
            so2   = float(np.clip(base * 0.08 + rng.normal(0, 3), 2, 120))
            co    = float(np.clip(base * 0.02 + rng.normal(0, 0.3), 0.3, 15))
            o3    = float(np.clip(55 + rng.normal(0, 12), 10, 200))
            nh3   = float(np.clip(base * 0.04 + rng.normal(0, 5), 5, 150))
            aqi   = compute_aqi(pm25, pm10, no2, so2, co, o3, nh3)

            # Simulate ~2% missing values
            if rng.random() < 0.02:
                pm25 = np.nan
            if rng.random() < 0.015:
                pm10 = np.nan

            rows.append({
                'timestamp': ts.isoformat(),
                'station_id': f'CAAQMS_{station_id:03d}',
                'grid_id': grid_id,
                'pm25': pm25, 'pm10': pm10, 'no2': no2,
                'so2': so2, 'co': co, 'o3': o3, 'nh3': nh3,
                'aqi': aqi,
            })

    df_out = pd.DataFrame(rows)
    df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
    print(f"  → {len(df_out):,} rows, {df_out['aqi'].isna().sum()} AQI nulls")
    return df_out


# ── 2. Weather Data ───────────────────────────────────────────────────────────

def generate_weather() -> pd.DataFrame:
    """Hourly weather per grid."""
    print(f"Generating weather data for {NUM_GRIDS} grids × {len(TIMESTAMPS)} hours...")
    rows = []

    # Seasonal temp baseline (Delhi)
    for ts in TIMESTAMPS:
        hour  = ts.hour
        month = ts.month
        # Base temperature by month (°C)
        base_temp = {1:14, 2:17, 3:23, 4:29, 5:34, 6:33,
                     7:29, 8:28, 9:28, 10:26, 11:20, 12:15}[month]
        diurnal_temp = 6 * np.sin(np.pi * (hour - 6) / 12)  # peak at 2pm

        for grid_id in range(NUM_GRIDS):
            rng = GRID_NOISE_SEEDS[grid_id]
            lat, lon = grid_center(grid_id)

            temp = base_temp + diurnal_temp + rng.normal(0, 1.5)
            humidity = float(np.clip(55 + rng.normal(0, 10) - 0.5 * diurnal_temp, 20, 99))
            wind_speed = float(np.clip(abs(rng.normal(8, 4)), 0.5, 35))
            wind_direction = float(rng.uniform(0, 360))
            pressure = float(np.clip(1013 + rng.normal(0, 5), 995, 1030))
            # Rainfall: mostly 0, occasional showers in monsoon
            rainfall = 0.0
            if month in [6, 7, 8] and rng.random() < 0.08:
                rainfall = float(np.clip(rng.exponential(3), 0.1, 50))
            solar_rad = float(np.clip(800 * max(0, np.sin(np.pi * (hour - 6) / 12)) + rng.normal(0, 30), 0, 1000))

            rows.append({
                'timestamp': ts.isoformat(),
                'grid_id': grid_id,
                'temperature': round(float(temp), 2),
                'humidity': round(humidity, 2),
                'wind_speed': round(wind_speed, 2),
                'wind_direction': round(wind_direction, 2),
                'pressure': round(pressure, 2),
                'rainfall': round(rainfall, 3),
                'solar_radiation': round(solar_rad, 2),
            })

    df_out = pd.DataFrame(rows)
    df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
    print(f"  → {len(df_out):,} rows")
    return df_out


# ── 3. Satellite Data ─────────────────────────────────────────────────────────

def generate_satellite() -> pd.DataFrame:
    """Daily satellite overpass data (Sentinel-5P / MODIS) — 1 pass per day."""
    print(f"Generating satellite data for {NUM_GRIDS} grids × {DAYS} days...")
    rows = []
    # Use only one timestamp per day (satellite overpass ~10:30 UTC)
    daily_timestamps = [START_TIME + timedelta(days=d, hours=10, minutes=30)
                        for d in range(DAYS)]

    for ts in daily_timestamps:
        month = ts.month
        sf = seasonal_factor(month)
        for grid_id in range(NUM_GRIDS):
            rng = GRID_NOISE_SEEDS[grid_id]
            base = BASE_AQI[grid_id] * sf

            aod      = float(np.clip(base / 500 * 1.2 + rng.normal(0, 0.05), 0.01, 2.0))
            sat_no2  = float(np.clip(base * 0.12 + rng.normal(0, 3), 1, 120))
            sat_so2  = float(np.clip(base * 0.06 + rng.normal(0, 2), 0.5, 80))
            sat_co   = float(np.clip(base * 0.018 + rng.normal(0, 0.2), 0.1, 12))
            cloud_cover = float(np.clip(abs(rng.normal(0.3, 0.2)), 0, 1))

            rows.append({
                'timestamp': ts.isoformat(),
                'grid_id': grid_id,
                'aod': round(aod, 4),
                'sat_no2': round(sat_no2, 3),
                'sat_so2': round(sat_so2, 3),
                'sat_co': round(sat_co, 4),
                'cloud_cover': round(cloud_cover, 3),
            })

    df_out = pd.DataFrame(rows)
    df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
    print(f"  → {len(df_out):,} rows")
    return df_out


# ── 4. Traffic Data ───────────────────────────────────────────────────────────

def generate_traffic() -> pd.DataFrame:
    """Hourly traffic metrics per grid."""
    print(f"Generating traffic data for {NUM_GRIDS} grids × {len(TIMESTAMPS)} hours...")
    rows = []

    # Define high-traffic grids (main roads, intersections)
    high_traffic_rows = {5, 10, 15}
    high_traffic_cols = {5, 10, 15}

    for ts in TIMESTAMPS:
        hour = ts.hour
        is_weekend = ts.weekday() >= 5
        # Traffic pattern: morning + evening peaks
        if not is_weekend:
            if 7 <= hour <= 10:   peak = 0.90
            elif 17 <= hour <= 20: peak = 0.95
            elif 0 <= hour <= 4:   peak = 0.05
            else:                  peak = 0.45
        else:
            if 10 <= hour <= 14:   peak = 0.55
            elif 0 <= hour <= 5:   peak = 0.03
            else:                  peak = 0.30

        for grid_id in range(NUM_GRIDS):
            rng = GRID_NOISE_SEEDS[grid_id]
            row = grid_id // GRID_COLS
            col = grid_id % GRID_COLS
            is_high_traffic = (row in high_traffic_rows or col in high_traffic_cols)
            traffic_mult = 1.5 if is_high_traffic else 0.6

            vehicle_density = float(np.clip(peak * 800 * traffic_mult + rng.normal(0, 20), 0, 2000))
            avg_speed = float(np.clip(80 - peak * 50 * traffic_mult + rng.normal(0, 5), 5, 120))
            congestion_index = float(np.clip(peak * traffic_mult + rng.normal(0, 0.05), 0, 1))
            heavy_vehicle_pct = float(np.clip(
                (0.25 if is_high_traffic else 0.10) + rng.normal(0, 0.03), 0.01, 0.60
            ))

            rows.append({
                'timestamp': ts.isoformat(),
                'grid_id': grid_id,
                'vehicle_density': round(vehicle_density, 1),
                'avg_speed': round(avg_speed, 1),
                'congestion_index': round(congestion_index, 3),
                'heavy_vehicle_pct': round(heavy_vehicle_pct, 3),
            })

    df_out = pd.DataFrame(rows)
    df_out['timestamp'] = pd.to_datetime(df_out['timestamp'])
    print(f"  → {len(df_out):,} rows")
    return df_out


# ── 5. Spatial Data (Static) ──────────────────────────────────────────────────

def generate_spatial() -> pd.DataFrame:
    """Static per-grid spatial features (one row per grid)."""
    print(f"Generating spatial data for {NUM_GRIDS} grids...")
    rows = []
    rng = np.random.RandomState(100)

    for grid_id in range(NUM_GRIDS):
        row = grid_id // GRID_COLS
        col = grid_id % GRID_COLS
        lat, lon = grid_center(grid_id)

        # Industrial: top-left
        industrial_pct = float(np.clip(rng.uniform(0.3, 0.6) if row < 5 and col < 5 else rng.uniform(0, 0.15), 0, 1))
        # Green: bottom-right
        green_pct = float(np.clip(rng.uniform(0.4, 0.7) if row > 15 and col > 15 else rng.uniform(0.02, 0.25), 0, 1))
        # Road density: main arteries
        is_artery = (row in {5,10,15} or col in {5,10,15})
        road_density = float(np.clip(rng.uniform(0.6, 0.9) if is_artery else rng.uniform(0.1, 0.5), 0, 1))
        # Construction
        construction_pct = float(np.clip(rng.uniform(0.15, 0.35) if 8 <= row <= 10 and 12 <= col <= 15 else rng.uniform(0, 0.1), 0, 1))
        # Residential fills the rest
        residential_pct = float(np.clip(1 - industrial_pct - green_pct - construction_pct, 0, 1))
        # Elevation: Delhi is relatively flat, slight gradient
        elevation = float(np.clip(216 + (row * 0.5) + rng.normal(0, 3), 200, 250))

        rows.append({
            'grid_id': grid_id,
            'lat': round(lat, 6),
            'lon': round(lon, 6),
            'road_density': round(road_density, 4),
            'industrial_area_pct': round(industrial_pct, 4),
            'green_cover_pct': round(green_pct, 4),
            'elevation': round(elevation, 2),
            'construction_zone_pct': round(construction_pct, 4),
            'residential_pct': round(residential_pct, 4),
        })

    df_out = pd.DataFrame(rows)
    print(f"  → {len(df_out)} rows (static)")
    return df_out


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    output_dir = Path(__file__).parent
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=" * 60)
    print("AQI Forecasting Demo Data Generator")
    print(f"City: Delhi | Grids: {GRID_ROWS}×{GRID_COLS} = {NUM_GRIDS}")
    print(f"Period: {DAYS} days ({DAYS*24} hourly timesteps)")
    print("=" * 60)

    datasets = {
        'caaqms.csv':    generate_caaqms,
        'weather.csv':   generate_weather,
        'satellite.csv': generate_satellite,
        'traffic.csv':   generate_traffic,
        'spatial.csv':   generate_spatial,
    }

    for filename, generator_fn in datasets.items():
        path = output_dir / filename
        if path.exists():
            print(f"\n[SKIP] {filename} already exists. Delete to regenerate.")
            continue
        print(f"\nGenerating {filename}...")
        df = generator_fn()
        df.to_csv(path, index=False)
        size_mb = path.stat().st_size / 1024 / 1024
        print(f"  ✓ Saved → {path} ({size_mb:.1f} MB)")

    print("\n" + "=" * 60)
    print("Data generation complete!")
    print("Schema Summary:")
    print("  caaqms.csv   → [timestamp, station_id, grid_id, pm25, pm10, no2, so2, co, o3, nh3, aqi]")
    print("  weather.csv  → [timestamp, grid_id, temperature, humidity, wind_speed, wind_direction, pressure, rainfall, solar_radiation]")
    print("  satellite.csv→ [timestamp, grid_id, aod, sat_no2, sat_so2, sat_co, cloud_cover]")
    print("  traffic.csv  → [timestamp, grid_id, vehicle_density, avg_speed, congestion_index, heavy_vehicle_pct]")
    print("  spatial.csv  → [grid_id, lat, lon, road_density, industrial_area_pct, green_cover_pct, elevation, construction_zone_pct, residential_pct]")
    print("=" * 60)


if __name__ == '__main__':
    main()
