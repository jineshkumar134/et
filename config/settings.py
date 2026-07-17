"""
Application settings — loaded from environment variables or .env file.
All values have sensible defaults so the app runs out-of-the-box in demo mode.
"""
from __future__ import annotations

import os
from typing import List
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ──────────────────────────────────────────────────────────────────
    APP_NAME: str = "AQI Forecasting API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    # ── City / Grid ───────────────────────────────────────────────────────────
    CITY_NAME: str = "Bengaluru"
    # Bounding box (Bengaluru)
    LAT_MIN: float = 12.834
    LAT_MAX: float = 13.143
    LON_MIN: float = 77.460
    LON_MAX: float = 77.780
    GRID_ROWS: int = 20
    GRID_COLS: int = 20  # 20x20 = 400 grids

    # ── Database ──────────────────────────────────────────────────────────────
    USE_SQLITE: bool = True
    SQLITE_URL: str = "sqlite+aiosqlite:///./aqi_demo.db"
    DATABASE_URL: str = "postgresql+asyncpg://aqi:aqi_secret@localhost:5432/aqi_db"

    # ── Cache ─────────────────────────────────────────────────────────────────
    CACHE_TTL_SECONDS: int = 300  # 5 minutes

    # ── CORS ──────────────────────────────────────────────────────────────────
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:5173",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v

    # ── ML ────────────────────────────────────────────────────────────────────
    MODEL_DIR: str = "ml/models"
    DEFAULT_MODEL: str = "ensemble"

    # ── Groq AI ───────────────────────────────────────────────────────────────
    GROQ_API_KEY: str = ""
    GROQ_MODEL_NAME: str = "llama-3.3-70b-versatile"

    # ── Derived helpers (not env vars) ────────────────────────────────────────
    @property
    def GRID_SIZE(self) -> int:
        return self.GRID_ROWS * self.GRID_COLS

    @property
    def LAT_STEP(self) -> float:
        return (self.LAT_MAX - self.LAT_MIN) / self.GRID_ROWS

    @property
    def LON_STEP(self) -> float:
        return (self.LON_MAX - self.LON_MIN) / self.GRID_COLS


settings = Settings()
