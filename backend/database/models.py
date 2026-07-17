"""
SQLAlchemy ORM models for the AQI Forecasting platform.
"""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from backend.database.connection import Base


class Grid(Base):
    __tablename__ = "grids"

    id = Column(Integer, primary_key=True, index=True)
    row = Column(Integer, nullable=False)
    col = Column(Integer, nullable=False)
    lat = Column(Float, nullable=False)   # centre latitude
    lon = Column(Float, nullable=False)   # centre longitude
    lat_min = Column(Float, nullable=True)
    lat_max = Column(Float, nullable=True)
    lon_min = Column(Float, nullable=True)
    lon_max = Column(Float, nullable=True)
    area_name = Column(String, nullable=True)

    # Static spatial features
    road_density = Column(Float, default=0.0)
    industrial_area_pct = Column(Float, default=0.0)
    green_cover_pct = Column(Float, default=0.0)
    elevation = Column(Float, default=0.0)
    construction_zone_pct = Column(Float, default=0.0)
    residential_pct = Column(Float, default=0.0)

    __table_args__ = (UniqueConstraint("row", "col", name="uq_grid_rowcol"),)

    predictions = relationship(
        "Prediction", back_populates="grid", lazy="dynamic"
    )
    stations = relationship("Station", back_populates="grid", lazy="dynamic")


class Station(Base):
    __tablename__ = "stations"

    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    grid_id = Column(Integer, ForeignKey("grids.id"), nullable=True)
    lat = Column(Float, nullable=False)
    lon = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)

    grid = relationship("Grid", back_populates="stations")
    readings = relationship(
        "StationReading", back_populates="station", lazy="dynamic"
    )


class StationReading(Base):
    __tablename__ = "station_readings"

    id = Column(Integer, primary_key=True)
    station_id = Column(Integer, ForeignKey("stations.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # Pollutant concentrations (µg/m³, except CO in mg/m³)
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    co = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    nh3 = Column(Float, nullable=True)
    aqi = Column(Float, nullable=True)

    station = relationship("Station", back_populates="readings")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True)
    grid_id = Column(Integer, ForeignKey("grids.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    # AQI forecast
    current_aqi = Column(Float, nullable=False)
    aqi_24h = Column(Float, nullable=True)
    aqi_48h = Column(Float, nullable=True)
    aqi_72h = Column(Float, nullable=True)

    # Meta
    confidence = Column(Float, nullable=True)
    trend = Column(String, nullable=True)          # Increasing | Stable | Decreasing
    current_category = Column(String, nullable=True)
    aqi_24h_category = Column(String, nullable=True)
    aqi_48h_category = Column(String, nullable=True)
    aqi_72h_category = Column(String, nullable=True)

    # Color codes (hex)
    current_color = Column(String, nullable=True)
    aqi_24h_color = Column(String, nullable=True)
    aqi_48h_color = Column(String, nullable=True)
    aqi_72h_color = Column(String, nullable=True)

    # Pollutant predictions
    pm25 = Column(Float, nullable=True)
    pm10 = Column(Float, nullable=True)
    no2 = Column(Float, nullable=True)
    so2 = Column(Float, nullable=True)
    co = Column(Float, nullable=True)
    o3 = Column(Float, nullable=True)
    nh3 = Column(Float, nullable=True)

    # Bookkeeping
    model_name = Column(String, default="ensemble")
    is_latest = Column(Boolean, default=True, index=True)

    grid = relationship("Grid", back_populates="predictions")


class ModelMetrics(Base):
    __tablename__ = "model_metrics"

    id = Column(Integer, primary_key=True)
    model_name = Column(String, index=True, nullable=False)
    horizon = Column(String, nullable=False)        # '24h' | '48h' | '72h'
    rmse = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    r2 = Column(Float, nullable=True)
    persistence_rmse = Column(Float, nullable=True)
    improvement_pct = Column(Float, nullable=True)
    train_loss = Column(JSON, nullable=True)        # list[float]
    val_loss = Column(JSON, nullable=True)          # list[float]
    created_at = Column(DateTime, default=datetime.utcnow)
