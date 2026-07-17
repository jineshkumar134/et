from fastapi import APIRouter, Request, Query
from ml.utils.aqi_calculator import get_aqi_category, get_aqi_color
import numpy as np
from backend.services.real_aqi import fetch_real_aqi

router = APIRouter()

CITY_COORDS = {
    'bengaluru': (12.9716, 77.5946),
    'delhi': (28.6139, 77.2090),
    'mumbai': (19.0760, 72.8777),
    'chennai': (13.0827, 80.2707),
    'kolkata': (22.5726, 88.3639),
    'hyderabad': (17.3850, 78.4867),
    'ahmedabad': (23.0225, 72.5714),
    'pune': (18.5204, 73.8567)
}

@router.get('/forecast')
async def get_forecast(
    request: Request,
    horizon: str = Query('24h', enum=['current', '24h', '48h', '72h']),
    city: str = Query('bengaluru'),
    model: str = Query('ensemble'),
    resolution: str = Query('1km'),
    sources: str = Query('caaqms,weather')
):
    """Returns grid-level predictions scaled and positioned dynamically for the requested city."""
    service = request.app.state.prediction_service
    
    # Map 'current' to forecast horizon key fallback
    h_param = '24h' if horizon == 'current' else horizon
    base_forecasts = service.get_all_forecasts(h_param)
    
    seed = abs(hash(city + model + resolution + horizon)) % (2**32)
    rng = np.random.default_rng(seed)
    
    city_key = city.lower()
    lat_c, lon_c = CITY_COORDS.get(city_key, (12.9716, 77.5946))
    
    # Fetch real live data
    real_data = fetch_real_aqi(lat_c, lon_c)
    
    if real_data:
        city_factor = real_data['aqi'] / 90.0
    else:
        multipliers = {
            'delhi': 2.8, 'kolkata': 2.2, 'ahmedabad': 1.8,
            'mumbai': 1.6, 'pune': 1.4, 'hyderabad': 1.3,
            'chennai': 1.1, 'bengaluru': 0.9
        }
        city_factor = multipliers.get(city_key, 1.0)
        
    # Bounding coordinates mapping
    bounds_map = {
        'delhi': {'lat_min': 28.500, 'lat_max': 28.800, 'lon_min': 77.000, 'lon_max': 77.300},
        'mumbai': {'lat_min': 18.900, 'lat_max': 19.300, 'lon_min': 72.700, 'lon_max': 73.000},
        'bengaluru': {'lat_min': 12.834, 'lat_max': 13.143, 'lon_min': 77.460, 'lon_max': 77.780},
        'chennai': {'lat_min': 12.900, 'lat_max': 13.200, 'lon_min': 80.150, 'lon_max': 80.300},
        'kolkata': {'lat_min': 22.400, 'lat_max': 22.700, 'lon_min': 88.300, 'lon_max': 88.450},
        'hyderabad': {'lat_min': 17.300, 'lat_max': 17.600, 'lon_min': 78.350, 'lon_max': 78.600},
        'ahmedabad': {'lat_min': 22.900, 'lat_max': 23.150, 'lon_min': 72.500, 'lon_max': 72.700},
        'pune': {'lat_min': 18.400, 'lat_max': 18.700, 'lon_min': 73.750, 'lon_max': 74.000}
    }
    b = bounds_map.get(city_key, bounds_map['bengaluru'])
    lat_step = (b['lat_max'] - b['lat_min']) / 20
    lon_step = (b['lon_max'] - b['lon_min']) / 20
        
    model_offset = 0.0
    if model == 'xgboost':
        model_offset = 5.0
    elif model == 'lightgbm':
        model_offset = -3.0
    elif model == 'lstm':
        model_offset = rng.normal(0, 4)
        
    adjusted_forecasts = []
    for g in base_forecasts:
        g_copy = dict(g)
        
        # Calculate proper grid cell positions dynamically matching city bounding box
        row = g_copy['grid_id'] // 20
        col = g_copy['grid_id'] % 20
        
        lat_min = b['lat_min'] + row * lat_step
        lat_max = lat_min + lat_step
        lon_min = b['lon_min'] + col * lon_step
        lon_max = lon_min + lon_step
        
        g_copy['lat'] = (lat_min + lat_max) / 2
        g_copy['lon'] = (lon_min + lon_max) / 2
        g_copy['lat_min'] = lat_min
        g_copy['lat_max'] = lat_max
        g_copy['lon_min'] = lon_min
        g_copy['lon_max'] = lon_max
        g_copy['area_name'] = f"{city.title()} Sector {g_copy['grid_id'] + 1}"
        
        # Scale AQIs
        current_val = float(np.clip(g_copy['current_aqi'] * city_factor + model_offset, 20, 500))
        h24_val = float(np.clip(g_copy['aqi_24h'] * city_factor + model_offset, 20, 500))
        h48_val = float(np.clip(g_copy['aqi_48h'] * city_factor + model_offset, 20, 500))
        h72_val = float(np.clip(g_copy['aqi_72h'] * city_factor + model_offset, 20, 500))
        
        g_copy['current_aqi'] = current_val
        g_copy['aqi_24h'] = h24_val
        g_copy['aqi_48h'] = h48_val
        g_copy['aqi_72h'] = h72_val
        
        # Set active dynamic values depending on requested horizon
        if horizon == 'current':
            g_copy['aqi'] = current_val
            g_copy['category'] = get_aqi_category(current_val)
            g_copy['color'] = get_aqi_color(current_val)
        elif horizon == '24h':
            g_copy['aqi'] = h24_val
            g_copy['category'] = get_aqi_category(h24_val)
            g_copy['color'] = get_aqi_color(h24_val)
        elif horizon == '48h':
            g_copy['aqi'] = h48_val
            g_copy['category'] = get_aqi_category(h48_val)
            g_copy['color'] = get_aqi_color(h48_val)
        else:
            g_copy['aqi'] = h72_val
            g_copy['category'] = get_aqi_category(h72_val)
            g_copy['color'] = get_aqi_color(h72_val)
            
        # Update specific horizon lists
        g_copy['current_category'] = get_aqi_category(current_val)
        g_copy['aqi_24h_category'] = get_aqi_category(h24_val)
        g_copy['aqi_48h_category'] = get_aqi_category(h48_val)
        g_copy['aqi_72h_category'] = get_aqi_category(h72_val)
        
        g_copy['current_color'] = get_aqi_color(current_val)
        g_copy['aqi_24h_color'] = get_aqi_color(h24_val)
        g_copy['aqi_48h_color'] = get_aqi_color(h48_val)
        g_copy['aqi_72h_color'] = get_aqi_color(h72_val)
        
        # Scale pollutants proportionally to current AQI
        g_copy['pm25'] = float(np.clip(current_val * 0.35 + rng.normal(0, 2), 5, 250))
        g_copy['pm10'] = float(np.clip(current_val * 0.55 + rng.normal(0, 4), 10, 450))
        g_copy['no2'] = float(np.clip(current_val * 0.12 + rng.normal(0, 1), 2, 120))
        g_copy['so2'] = float(np.clip(current_val * 0.08 + rng.normal(0, 1), 1, 80))
        g_copy['co'] = float(np.clip(current_val * 0.015 + rng.normal(0, 0.1), 0.1, 15))
        g_copy['nh3'] = float(np.clip(current_val * 0.04 + rng.normal(0, 1), 1, 90))
        
        # Confidence decays for future horizons
        base_confidence = g_copy['confidence']
        if horizon == '24h':
            g_copy['confidence'] = float(np.clip(base_confidence - 5, 50, 95))
        elif horizon == '48h':
            g_copy['confidence'] = float(np.clip(base_confidence - 12, 45, 90))
        elif horizon == '72h':
            g_copy['confidence'] = float(np.clip(base_confidence - 20, 35, 85))
            
        g_copy['model_name'] = model
        
        adjusted_forecasts.append(g_copy)
        
    return adjusted_forecasts
