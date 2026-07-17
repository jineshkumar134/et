"""
Application-wide constants — AQI categories, color map, pollutant limits, etc.
These mirror US-EPA / CPCB breakpoints commonly used for Indian cities.
"""
from __future__ import annotations

# ── AQI category breakpoints (CPCB India) ────────────────────────────────────
AQI_BREAKPOINTS = [
    (0, 50, "Good", "#00e400"),
    (51, 100, "Satisfactory", "#a8e05f"),
    (101, 200, "Moderate", "#fdd64b"),
    (201, 300, "Poor", "#ff7e00"),
    (301, 400, "Very Poor", "#ff0000"),
    (401, 500, "Severe", "#7e0023"),
]

# ── Color map (category → hex color) ─────────────────────────────────────────
AQI_MAP_COLORS: dict[str, str] = {bp[2]: bp[3] for bp in AQI_BREAKPOINTS}

# ── Pollutant display names ───────────────────────────────────────────────────
POLLUTANT_LABELS: dict[str, str] = {
    "pm25": "PM2.5",
    "pm10": "PM10",
    "no2": "NO₂",
    "so2": "SO₂",
    "co": "CO",
    "o3": "O₃",
    "nh3": "NH₃",
}

# ── Pollutant units ───────────────────────────────────────────────────────────
POLLUTANT_UNITS: dict[str, str] = {
    "pm25": "µg/m³",
    "pm10": "µg/m³",
    "no2": "µg/m³",
    "so2": "µg/m³",
    "co": "mg/m³",
    "o3": "µg/m³",
    "nh3": "µg/m³",
}

# ── Model horizon labels ──────────────────────────────────────────────────────
VALID_HORIZONS = {"24h", "48h", "72h", "all"}

# ── Valid model names ─────────────────────────────────────────────────────────
VALID_MODEL_NAMES = {"xgboost", "lightgbm", "lstm", "ensemble"}
