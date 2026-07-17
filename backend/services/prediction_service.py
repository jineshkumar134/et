from datetime import datetime, timezone
import numpy as np
from backend.services.data_generator import (
    generate_synthetic_predictions,
    generate_model_metrics,
    generate_aqi_time_series
)

class PredictionService:
    def __init__(self):
        self._cache = {}
        self._metrics = []
        self._initialized = False

    async def initialize(self) -> None:
        """Initialise in-memory cache on startup with pre-computed synthetic data."""
        if self._initialized:
            return
        # Load 400 grid predictions
        preds = generate_synthetic_predictions(num_grids=400)
        self._cache = {p['grid_id']: p for p in preds}
        
        # Load model metrics
        self._metrics = generate_model_metrics()
        self._initialized = True

    def get_all_current(self) -> list:
        """Returns current AQI for all grids."""
        return [
            {
                'grid_id': g['grid_id'],
                'lat': g['lat'],
                'lon': g['lon'],
                'lat_min': g['lat_min'],
                'lat_max': g['lat_max'],
                'lon_min': g['lon_min'],
                'lon_max': g['lon_max'],
                'aqi': g['current_aqi'],
                'category': g['current_category'],
                'color': g['current_color'],
                'confidence': g['confidence'],
                'trend': g['trend'],
                # Propagate all fields so frontend Prediction type is satisfied
                'current_aqi': g['current_aqi'],
                'aqi_24h': g['aqi_24h'],
                'aqi_48h': g['aqi_48h'],
                'aqi_72h': g['aqi_72h'],
                'current_category': g['current_category'],
                'aqi_24h_category': g['aqi_24h_category'],
                'aqi_48h_category': g['aqi_48h_category'],
                'aqi_72h_category': g['aqi_72h_category'],
                'current_color': g['current_color'],
                'aqi_24h_color': g['aqi_24h_color'],
                'aqi_48h_color': g['aqi_48h_color'],
                'aqi_72h_color': g['aqi_72h_color'],
                'pm25': g['pm25'],
                'pm10': g['pm10'],
                'no2': g['no2'],
                'so2': g['so2'],
                'co': g['co'],
                'o3': g['o3'],
                'nh3': g['nh3'],
                'road_density': g['road_density'],
                'industrial_area_pct': g['industrial_area_pct'],
                'green_cover_pct': g['green_cover_pct'],
                'elevation': g['elevation'],
                'row': g['row'],
                'col': g['col'],
                'timestamp': g['timestamp'],
                'model_name': g['model_name'],
            }
            for g in self._cache.values()
        ]

    def get_all_forecasts(self, horizon: str = '24h') -> list:
        """Returns predictions for specified horizon (24h, 48h, 72h)."""
        val_key = f'aqi_{horizon}'
        cat_key = f'aqi_{horizon}_category'
        color_key = f'aqi_{horizon}_color'
        
        return [
            {
                'grid_id': g['grid_id'],
                'lat': g['lat'],
                'lon': g['lon'],
                'lat_min': g['lat_min'],
                'lat_max': g['lat_max'],
                'lon_min': g['lon_min'],
                'lon_max': g['lon_max'],
                'aqi': g.get(val_key, g['aqi_24h']),
                'category': g.get(cat_key, g['aqi_24h_category']),
                'color': g.get(color_key, g['aqi_24h_color']),
                'confidence': g['confidence'],
                'trend': g['trend'],
                'current_aqi': g['current_aqi'],
                'aqi_24h': g['aqi_24h'],
                'aqi_48h': g['aqi_48h'],
                'aqi_72h': g['aqi_72h'],
                'current_category': g['current_category'],
                'aqi_24h_category': g['aqi_24h_category'],
                'aqi_48h_category': g['aqi_48h_category'],
                'aqi_72h_category': g['aqi_72h_category'],
                'current_color': g['current_color'],
                'aqi_24h_color': g['aqi_24h_color'],
                'aqi_48h_color': g['aqi_48h_color'],
                'aqi_72h_color': g['aqi_72h_color'],
                'pm25': g['pm25'],
                'pm10': g['pm10'],
                'no2': g['no2'],
                'so2': g['so2'],
                'co': g['co'],
                'o3': g['o3'],
                'nh3': g['nh3'],
                'road_density': g['road_density'],
                'industrial_area_pct': g['industrial_area_pct'],
                'green_cover_pct': g['green_cover_pct'],
                'elevation': g['elevation'],
                'row': g['row'],
                'col': g['col'],
                'timestamp': g['timestamp'],
                'model_name': g['model_name'],
            }
            for g in self._cache.values()
        ]

    def get_grid_detail(self, grid_id: int) -> dict:
        """Returns complete forecast detail, pollutant breakdown, and 7-day history."""
        grid_data = self._cache.get(grid_id)
        if not grid_data:
            raise KeyError(f"Grid ID {grid_id} not found.")
            
        detail = dict(grid_data)
        # Generate 7-day hourly history
        detail['time_series'] = generate_aqi_time_series(grid_id, hours=168)
        return detail

    def get_metrics(self) -> list:
        return self._metrics

    def get_city_summary(self) -> dict:
        """Computes average, minimum, and maximum AQI statistics across all grids."""
        aqi_vals = [g['current_aqi'] for g in self._cache.values()]
        avg_aqi = sum(aqi_vals) / len(aqi_vals)
        
        # Categories count
        cats = [g['current_category'] for g in self._cache.values()]

        grid_keys = list(self._cache.keys())
        best_grid_id = grid_keys[int(np.argmin(aqi_vals))]
        worst_grid_id = grid_keys[int(np.argmax(aqi_vals))]

        # Determine dominant category (most common)
        from collections import Counter
        dominant_cat = Counter(cats).most_common(1)[0][0]
        
        return {
            'city_aqi': round(avg_aqi, 1),
            'city_category': dominant_cat,
            'num_grids': len(aqi_vals),
            'num_good': cats.count('Good'),
            'num_satisfactory': cats.count('Satisfactory'),
            'num_moderate': cats.count('Moderate'),
            'num_poor': cats.count('Poor'),
            'num_very_poor': cats.count('Very Poor'),
            'num_severe': cats.count('Severe'),
            'worst_grid_id': worst_grid_id,
            'best_grid_id': best_grid_id,
            'dominant_pollutant': 'PM2.5',
            'last_updated': datetime.now(timezone.utc).isoformat()
        }

