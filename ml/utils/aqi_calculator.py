"""
AQI calculation utilities.
Implements CPCB (India) breakpoint-based AQI categorisation and color mapping.
"""
from __future__ import annotations

from config.constants import AQI_BREAKPOINTS, AQI_MAP_COLORS


def get_aqi_category(aqi: float) -> str:
    """Return the CPCB category string for a given AQI value."""
    aqi = float(aqi)
    for lo, hi, label, _ in AQI_BREAKPOINTS:
        if lo <= aqi <= hi:
            return label
    # Clamp to extremes
    if aqi < AQI_BREAKPOINTS[0][0]:
        return AQI_BREAKPOINTS[0][2]
    return AQI_BREAKPOINTS[-1][2]


def get_aqi_color(aqi: float) -> str:
    """Return a hex color string for the given AQI value."""
    category = get_aqi_category(aqi)
    return AQI_MAP_COLORS.get(category, "#7e0023")


def aqi_to_pollutant_aqi(
    concentration: float,
    pollutant: str,
) -> float:
    """
    Simplified sub-index calculation for a single pollutant.
    Uses linear interpolation between CPCB breakpoints.
    This is a demo approximation; production would use full CPCB tables.
    """
    # Rough CPCB PM2.5 breakpoints (µg/m³ → AQI sub-index)
    BREAKPOINTS: dict[str, list[tuple[float, float, float, float]]] = {
        "pm25": [
            (0, 30, 0, 50),
            (31, 60, 51, 100),
            (61, 90, 101, 200),
            (91, 120, 201, 300),
            (121, 250, 301, 400),
            (251, 500, 401, 500),
        ],
        "pm10": [
            (0, 50, 0, 50),
            (51, 100, 51, 100),
            (101, 250, 101, 200),
            (251, 350, 201, 300),
            (351, 430, 301, 400),
            (431, 600, 401, 500),
        ],
    }

    table = BREAKPOINTS.get(pollutant)
    if table is None:
        # Fall-back: linear scale
        return min(500.0, max(0.0, concentration * 2.0))

    for c_lo, c_hi, aqi_lo, aqi_hi in table:
        if c_lo <= concentration <= c_hi:
            return aqi_lo + (concentration - c_lo) / (c_hi - c_lo) * (aqi_hi - aqi_lo)

    return 500.0 if concentration > table[-1][1] else 0.0
