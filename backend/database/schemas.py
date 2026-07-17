"""
Pydantic v2 schemas for API request/response serialisation.
All datetime fields are serialised to ISO-8601 strings.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_serializer


# ── Shared config ─────────────────────────────────────────────────────────────
class _BaseSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ── Grid schemas ──────────────────────────────────────────────────────────────
class GridSchema(_BaseSchema):
    id: int
    row: int
    col: int
    lat: float
    lon: float
    lat_min: Optional[float] = None
    lat_max: Optional[float] = None
    lon_min: Optional[float] = None
    lon_max: Optional[float] = None
    area_name: Optional[str] = None
    road_density: float = 0.0
    industrial_area_pct: float = 0.0
    green_cover_pct: float = 0.0
    elevation: float = 0.0
    construction_zone_pct: float = 0.0
    residential_pct: float = 0.0


class GridListItem(_BaseSchema):
    """Lightweight grid item used in list responses."""
    id: int
    row: int
    col: int
    lat: float
    lon: float
    lat_min: Optional[float] = None
    lat_max: Optional[float] = None
    lon_min: Optional[float] = None
    lon_max: Optional[float] = None
    area_name: Optional[str] = None


# ── Pollutant snapshot ────────────────────────────────────────────────────────
class PollutantSnapshot(_BaseSchema):
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    o3: Optional[float] = None
    nh3: Optional[float] = None


# ── Forecast horizon ──────────────────────────────────────────────────────────
class ForecastHorizon(_BaseSchema):
    aqi: float
    category: str
    color: str


# ── Prediction schema (DB row) ────────────────────────────────────────────────
class PredictionSchema(_BaseSchema):
    id: int
    grid_id: int
    timestamp: datetime
    current_aqi: float
    aqi_24h: Optional[float] = None
    aqi_48h: Optional[float] = None
    aqi_72h: Optional[float] = None
    confidence: Optional[float] = None
    trend: Optional[str] = None
    current_category: Optional[str] = None
    aqi_24h_category: Optional[str] = None
    aqi_48h_category: Optional[str] = None
    aqi_72h_category: Optional[str] = None
    current_color: Optional[str] = None
    aqi_24h_color: Optional[str] = None
    aqi_48h_color: Optional[str] = None
    aqi_72h_color: Optional[str] = None
    pm25: Optional[float] = None
    pm10: Optional[float] = None
    no2: Optional[float] = None
    so2: Optional[float] = None
    co: Optional[float] = None
    o3: Optional[float] = None
    nh3: Optional[float] = None
    model_name: Optional[str] = None
    is_latest: bool = True

    @field_serializer("timestamp")
    def _ser_ts(self, v: datetime) -> str:
        return v.isoformat()


# ── Current AQI (per grid, list) ──────────────────────────────────────────────
class CurrentAQIItem(_BaseSchema):
    grid_id: int
    lat: float
    lon: float
    lat_min: Optional[float] = None
    lat_max: Optional[float] = None
    lon_min: Optional[float] = None
    lon_max: Optional[float] = None
    current_aqi: float
    category: str
    color: str
    trend: Optional[str] = None
    confidence: Optional[float] = None
    timestamp: str                        # ISO-8601


class CurrentAQIResponse(_BaseSchema):
    count: int
    timestamp: str
    data: List[CurrentAQIItem]


# ── Forecast response ─────────────────────────────────────────────────────────
class ForecastItem(_BaseSchema):
    grid_id: int
    lat: float
    lon: float
    current_aqi: float
    current_category: str
    current_color: str
    forecast_24h: Optional[ForecastHorizon] = None
    forecast_48h: Optional[ForecastHorizon] = None
    forecast_72h: Optional[ForecastHorizon] = None
    trend: Optional[str] = None
    confidence: Optional[float] = None


class ForecastResponse(_BaseSchema):
    horizon: str
    count: int
    timestamp: str
    data: List[ForecastItem]


# ── Time-series point ─────────────────────────────────────────────────────────
class TimeSeriesPoint(_BaseSchema):
    timestamp: str
    aqi: float
    category: str
    color: str


# ── Grid detail (single grid full response) ───────────────────────────────────
class GridDetailResponse(_BaseSchema):
    grid_id: int
    lat: float
    lon: float
    lat_min: Optional[float] = None
    lat_max: Optional[float] = None
    lon_min: Optional[float] = None
    lon_max: Optional[float] = None
    area_name: Optional[str] = None

    # Spatial features
    road_density: float = 0.0
    industrial_area_pct: float = 0.0
    green_cover_pct: float = 0.0
    elevation: float = 0.0

    # Current AQI
    current_aqi: float
    current_category: str
    current_color: str
    trend: str
    confidence: float

    # Forecast
    forecast_24h: ForecastHorizon
    forecast_48h: ForecastHorizon
    forecast_72h: ForecastHorizon

    # Pollutants
    pollutants: PollutantSnapshot

    # Historical time series (past 7 days, hourly)
    time_series: List[TimeSeriesPoint]

    # Metadata
    model_name: str
    timestamp: str


# ── City-wide summary ─────────────────────────────────────────────────────────
class CategoryBreakdown(_BaseSchema):
    Good: int = 0
    Satisfactory: int = 0
    Moderate: int = 0
    Poor: int = 0
    VeryPoor: int = Field(0, alias="Very Poor")
    Severe: int = 0

    model_config = ConfigDict(populate_by_name=True)


class CurrentSummaryResponse(_BaseSchema):
    city: str
    timestamp: str
    total_grids: int
    avg_aqi: float
    max_aqi: float
    min_aqi: float
    dominant_category: str
    category_breakdown: Dict[str, int]
    hotspot_grid_id: int
    cleanest_grid_id: int


# ── Model metrics ─────────────────────────────────────────────────────────────
class ModelMetricsSchema(_BaseSchema):
    id: int
    model_name: str
    horizon: str
    rmse: Optional[float] = None
    mae: Optional[float] = None
    r2: Optional[float] = None
    persistence_rmse: Optional[float] = None
    improvement_pct: Optional[float] = None
    created_at: Optional[datetime] = None

    @field_serializer("created_at")
    def _ser_cat(self, v: Optional[datetime]) -> Optional[str]:
        return v.isoformat() if v else None


class LossCurveResponse(_BaseSchema):
    model_name: str
    horizon: Optional[str] = None
    train_loss: List[float]
    val_loss: List[float]


class MetricsResponse(_BaseSchema):
    count: int
    data: List[Dict[str, Any]]


# ── Health ────────────────────────────────────────────────────────────────────
class HealthResponse(_BaseSchema):
    status: str
    city: str
    grids: int
    version: str
    timestamp: str
