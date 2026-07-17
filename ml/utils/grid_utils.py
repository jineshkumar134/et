"""
Grid geometry utilities.
Converts between flat grid_id (0-399) and (lat, lon) coordinates for a
configurable bounding box split into GRID_ROWS × GRID_COLS cells.
"""
from __future__ import annotations

from typing import Tuple


def grid_id_to_rowcol(grid_id: int, settings) -> Tuple[int, int]:
    """Return (row, col) for a flat grid_id."""
    row = grid_id // settings.GRID_COLS
    col = grid_id % settings.GRID_COLS
    return row, col


def grid_id_to_latlon(grid_id: int, settings) -> Tuple[float, float]:
    """Return the (lat, lon) centre of the grid cell."""
    row, col = grid_id_to_rowcol(grid_id, settings)
    lat = settings.LAT_MAX - (row + 0.5) * settings.LAT_STEP
    lon = settings.LON_MIN + (col + 0.5) * settings.LON_STEP
    return round(lat, 6), round(lon, 6)


def get_grid_bounds(
    grid_id: int, settings
) -> Tuple[float, float, float, float]:
    """Return (lat_min, lat_max, lon_min, lon_max) for the grid cell."""
    row, col = grid_id_to_rowcol(grid_id, settings)
    lat_max = settings.LAT_MAX - row * settings.LAT_STEP
    lat_min = lat_max - settings.LAT_STEP
    lon_min = settings.LON_MIN + col * settings.LON_STEP
    lon_max = lon_min + settings.LON_STEP
    return (
        round(lat_min, 6),
        round(lat_max, 6),
        round(lon_min, 6),
        round(lon_max, 6),
    )


def latlon_to_grid_id(lat: float, lon: float, settings) -> int | None:
    """
    Return the grid_id that contains the given (lat, lon).
    Returns None if the point is outside the bounding box.
    """
    if not (
        settings.LAT_MIN <= lat <= settings.LAT_MAX
        and settings.LON_MIN <= lon <= settings.LON_MAX
    ):
        return None

    row = int((settings.LAT_MAX - lat) / settings.LAT_STEP)
    col = int((lon - settings.LON_MIN) / settings.LON_STEP)

    # Clamp to valid range
    row = min(row, settings.GRID_ROWS - 1)
    col = min(col, settings.GRID_COLS - 1)

    return row * settings.GRID_COLS + col


def grids_in_bbox(
    lat_min: float,
    lat_max: float,
    lon_min: float,
    lon_max: float,
    settings,
) -> list[int]:
    """Return all grid_ids whose centres fall within the given bounding box."""
    result = []
    for grid_id in range(settings.GRID_ROWS * settings.GRID_COLS):
        lat, lon = grid_id_to_latlon(grid_id, settings)
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            result.append(grid_id)
    return result
