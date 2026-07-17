from config.settings import settings
from ml.utils.grid_utils import grid_id_to_latlon, get_grid_bounds

class GridService:
    def __init__(self):
        pass

    def get_all_grids(self) -> list:
        """Returns bounds and coordinates for all 400 grids."""
        grids = []
        for grid_id in range(settings.GRID_SIZE):
            lat, lon = grid_id_to_latlon(grid_id, settings)
            bounds = get_grid_bounds(grid_id, settings)
            grids.append({
                'grid_id': grid_id,
                'row': grid_id // settings.GRID_COLS,
                'col': grid_id % settings.GRID_COLS,
                'lat': lat,
                'lon': lon,
                'lat_min': bounds[0],
                'lat_max': bounds[1],
                'lon_min': bounds[2],
                'lon_max': bounds[3],
                'area_name': f"Sector {grid_id + 1}"
            })
        return grids

    def get_grid_by_id(self, grid_id: int) -> dict:
        if grid_id < 0 or grid_id >= settings.GRID_SIZE:
            return None
        lat, lon = grid_id_to_latlon(grid_id, settings)
        bounds = get_grid_bounds(grid_id, settings)
        return {
            'grid_id': grid_id,
            'row': grid_id // settings.GRID_COLS,
            'col': grid_id % settings.GRID_COLS,
            'lat': lat,
            'lon': lon,
            'lat_min': bounds[0],
            'lat_max': bounds[1],
            'lon_min': bounds[2],
            'lon_max': bounds[3],
            'area_name': f"Sector {grid_id + 1}"
        }
