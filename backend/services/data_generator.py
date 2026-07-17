"""
Synthetic data generator for the AQI Forecasting demo.
Produces realistic, spatially-coherent predictions for all 400 grids
without requiring any real sensor data or a trained ML model.
"""
from __future__ import annotations

import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List

from config.settings import settings
from config.constants import AQI_BREAKPOINTS
from ml.utils.aqi_calculator import get_aqi_category, get_aqi_color
from ml.utils.grid_utils import grid_id_to_latlon, get_grid_bounds


# ── Zone definitions ──────────────────────────────────────────────────────────
# Industrial corridor — top 2 rows
INDUSTRIAL_GRIDS: set[int] = set(range(0, 40))
# Green / residential — bottom-right quadrant
GREEN_GRIDS: set[int] = set(range(360, 400))
# Major road intersections
TRAFFIC_HOTSPOTS: set[int] = {100, 101, 120, 121, 200, 201, 220, 221}


def _base_aqi(grid_id: int, now: datetime) -> float:
    """Return a spatially and temporally modulated base AQI."""
    rng = np.random.default_rng(grid_id)            # reproducible per grid

    if grid_id in INDUSTRIAL_GRIDS:
        base = rng.uniform(200, 320)
    elif grid_id in GREEN_GRIDS:
        base = rng.uniform(40, 90)
    elif grid_id in TRAFFIC_HOTSPOTS:
        base = rng.uniform(150, 250)
    else:
        base = rng.uniform(80, 180)

    # Diurnal modulation
    hour = now.hour
    if 7 <= hour <= 10 or 17 <= hour <= 20:
        base *= 1.2
    elif 2 <= hour <= 5:
        base *= 0.8

    # Small stochastic perturbation (seeded with current minute for stability)
    noise_rng = np.random.default_rng(grid_id * 1000 + now.minute)
    base += noise_rng.normal(0, 10)
    return float(np.clip(base, 20, 450))


def generate_synthetic_predictions(num_grids: int = 400) -> List[Dict]:
    """
    Generate realistic synthetic predictions for all grids.
    Returns a list of dicts — one per grid_id.
    """
    now = datetime.utcnow()
    predictions: List[Dict] = []

    for grid_id in range(num_grids):
        rng = np.random.default_rng(grid_id + 9999)      # separate seed

        base_aqi = _base_aqi(grid_id, now)

        # 24/48/72-h forecast with drift
        trend_factor = rng.choice([-1, 0, 1], p=[0.3, 0.4, 0.3])
        aqi_24h = float(np.clip(
            base_aqi + trend_factor * rng.uniform(5, 30) + rng.normal(0, 8),
            20, 450,
        ))
        aqi_48h = float(np.clip(
            aqi_24h + trend_factor * rng.uniform(5, 20) + rng.normal(0, 10),
            20, 450,
        ))
        aqi_72h = float(np.clip(
            aqi_48h + trend_factor * rng.uniform(5, 15) + rng.normal(0, 12),
            20, 450,
        ))

        # Trend label
        delta = aqi_72h - base_aqi
        if delta > 15:
            trend = "Increasing"
        elif delta < -15:
            trend = "Decreasing"
        else:
            trend = "Stable"

        # Model confidence (higher near present, lower for distant horizons)
        conf = float(np.clip(
            85 - (grid_id % 20) * 0.5 + rng.normal(0, 5),
            55, 95,
        ))

        # Pollutant breakdown (proportional + noise)
        pm25 = float(np.clip(base_aqi * 0.30 + rng.normal(0, 5), 5, 200))
        pm10 = float(np.clip(base_aqi * 0.50 + rng.normal(0, 8), 10, 400))
        no2  = float(np.clip(base_aqi * 0.15 + rng.normal(0, 3), 5, 100))
        so2  = float(np.clip(base_aqi * 0.10 + rng.normal(0, 2), 2, 60))
        co   = float(np.clip(base_aqi * 0.02 + rng.normal(0, 0.3), 0.3, 10))
        o3   = float(np.clip(50 + rng.normal(0, 15), 10, 150))
        nh3  = float(np.clip(base_aqi * 0.05 + rng.normal(0, 5), 5, 80))

        # Spatial features
        industrial_pct = 0.4 if grid_id in INDUSTRIAL_GRIDS else float(rng.uniform(0, 0.2))
        green_pct      = 0.5 if grid_id in GREEN_GRIDS      else float(rng.uniform(0, 0.3))

        lat, lon = grid_id_to_latlon(grid_id, settings)
        lat_min, lat_max, lon_min, lon_max = get_grid_bounds(grid_id, settings)

        predictions.append({
            "grid_id": grid_id,
            "lat": lat,
            "lon": lon,
            "lat_min": lat_min,
            "lat_max": lat_max,
            "lon_min": lon_min,
            "lon_max": lon_max,
            "row": grid_id // settings.GRID_COLS,
            "col": grid_id % settings.GRID_COLS,
            "timestamp": now.isoformat(),
            # AQI values
            "current_aqi": base_aqi,
            "aqi_24h": aqi_24h,
            "aqi_48h": aqi_48h,
            "aqi_72h": aqi_72h,
            "confidence": conf,
            "trend": trend,
            # Categories
            "current_category": get_aqi_category(base_aqi),
            "aqi_24h_category": get_aqi_category(aqi_24h),
            "aqi_48h_category": get_aqi_category(aqi_48h),
            "aqi_72h_category": get_aqi_category(aqi_72h),
            # Colours
            "current_color": get_aqi_color(base_aqi),
            "aqi_24h_color": get_aqi_color(aqi_24h),
            "aqi_48h_color": get_aqi_color(aqi_48h),
            "aqi_72h_color": get_aqi_color(aqi_72h),
            # Pollutants
            "pm25": pm25,
            "pm10": pm10,
            "no2": no2,
            "so2": so2,
            "co": co,
            "o3": o3,
            "nh3": nh3,
            # Model
            "model_name": "ensemble",
            # Spatial metadata
            "industrial_area_pct": industrial_pct,
            "green_cover_pct": green_pct,
            "road_density": float(rng.uniform(0.1, 0.8)),
            "elevation": float(rng.uniform(200, 280)),
            "construction_zone_pct": float(rng.uniform(0, 0.15)),
            "residential_pct": float(rng.uniform(0.1, 0.6)),
        })

    return predictions


def generate_model_metrics() -> List[Dict]:
    """Generate realistic model performance metrics for 4 models × 3 horizons."""
    models = [
        {"name": "xgboost",  "rmse_24h": 18.3, "rmse_48h": 22.1, "rmse_72h": 26.4},
        {"name": "lightgbm", "rmse_24h": 17.8, "rmse_48h": 21.5, "rmse_72h": 25.9},
        {"name": "lstm",     "rmse_24h": 15.2, "rmse_48h": 19.7, "rmse_72h": 23.8},
        {"name": "ensemble", "rmse_24h": 13.6, "rmse_48h": 17.9, "rmse_72h": 22.1},
    ]
    persistence_rmse = {"24h": 32.1, "48h": 41.5, "72h": 48.7}

    metrics: List[Dict] = []
    for m in models:
        for h in ["24h", "48h", "72h"]:
            rmse = m[f"rmse_{h}"]
            p_rmse = persistence_rmse[h]
            improvement = (p_rmse - rmse) / p_rmse * 100

            seed = abs(hash(m["name"] + h)) % (2 ** 31)
            rng = np.random.default_rng(seed)

            train_loss = [
                float(30 * np.exp(-0.1 * i) + rng.normal(0, 0.5))
                for i in range(50)
            ]
            val_loss = [
                float(32 * np.exp(-0.09 * i) + rng.normal(0, 0.8))
                for i in range(50)
            ]

            metrics.append({
                "model_name": m["name"],
                "horizon": h,
                "rmse": rmse,
                "mae": round(rmse * 0.78 + float(rng.normal(0, 0.5)), 3),
                "r2": round(min(0.99, 0.72 + (32 - rmse) / 100), 4),
                "persistence_rmse": p_rmse,
                "improvement_pct": round(improvement, 2),
                "train_loss": train_loss,
                "val_loss": val_loss,
            })

    return metrics


def generate_aqi_time_series(grid_id: int, hours: int = 168) -> List[Dict]:
    """
    Generate an hourly AQI time series for the past `hours` hours (default 7 days).
    The diurnal pattern is consistent with the current-AQI generator.
    """
    rng = np.random.default_rng(grid_id)
    now = datetime.utcnow()

    # Zone-based baseline
    if grid_id in INDUSTRIAL_GRIDS:
        base = 240.0
    elif grid_id in GREEN_GRIDS:
        base = 65.0
    elif grid_id in TRAFFIC_HOTSPOTS:
        base = 190.0
    else:
        base = 130.0

    series: List[Dict] = []
    for i in range(hours, 0, -1):
        t = now - timedelta(hours=i)
        hour = t.hour

        if 7 <= hour <= 10:
            factor = 1.3
        elif 17 <= hour <= 20:
            factor = 1.4
        elif 0 <= hour <= 4:
            factor = 0.75
        else:
            factor = 1.0

        aqi = float(np.clip(base * factor + rng.normal(0, 12), 20, 450))
        series.append({
            "timestamp": t.isoformat(),
            "aqi": aqi,
            "category": get_aqi_category(aqi),
            "color": get_aqi_color(aqi),
        })

    return series
