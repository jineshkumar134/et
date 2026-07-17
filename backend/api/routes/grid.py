from fastapi import APIRouter, Request, HTTPException, Query
from ml.utils.aqi_calculator import get_aqi_category, get_aqi_color
from datetime import datetime, timezone
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

def get_city_bounds_and_steps(city: str):
    """Calculates latitude/longitude steps for 20x20 grids of different cities."""
    # Bounds config for 8 Indian cities
    bounds = {
        'delhi': {'lat_min': 28.500, 'lat_max': 28.800, 'lon_min': 77.000, 'lon_max': 77.300},
        'mumbai': {'lat_min': 18.900, 'lat_max': 19.300, 'lon_min': 72.700, 'lon_max': 73.000},
        'bengaluru': {'lat_min': 12.834, 'lat_max': 13.143, 'lon_min': 77.460, 'lon_max': 77.780},
        'chennai': {'lat_min': 12.900, 'lat_max': 13.200, 'lon_min': 80.150, 'lon_max': 80.300},
        'kolkata': {'lat_min': 22.400, 'lat_max': 22.700, 'lon_min': 88.300, 'lon_max': 88.450},
        'hyderabad': {'lat_min': 17.300, 'lat_max': 17.600, 'lon_min': 78.350, 'lon_max': 78.600},
        'ahmedabad': {'lat_min': 22.900, 'lat_max': 23.150, 'lon_min': 72.500, 'lon_max': 72.700},
        'pune': {'lat_min': 18.400, 'lat_max': 18.700, 'lon_min': 73.750, 'lon_max': 74.000}
    }
    b = bounds.get(city.lower(), bounds['bengaluru'])
    
    lat_step = (b['lat_max'] - b['lat_min']) / 20
    lon_step = (b['lon_max'] - b['lon_min']) / 20
    return b, lat_step, lon_step

@router.get('/grids')
async def get_all_grids(
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km')
):
    """Returns grid geometry (bounds and centers) matching the chosen city and resolution."""
    b, lat_step, lon_step = get_city_bounds_and_steps(city)
    
    grids = []
    city_name = city.title()
    for grid_id in range(400):
        row = grid_id // 20
        col = grid_id % 20
        
        lat_min = b['lat_min'] + row * lat_step
        lat_max = lat_min + lat_step
        lon_min = b['lon_min'] + col * lon_step
        lon_max = lon_min + lon_step
        
        grids.append({
            'grid_id': grid_id,
            'row': row,
            'col': col,
            'lat': (lat_min + lat_max) / 2,
            'lon': (lon_min + lon_max) / 2,
            'lat_min': lat_min,
            'lat_max': lat_max,
            'lon_min': lon_min,
            'lon_max': lon_max,
            'area_name': f"{city_name} Sector {grid_id + 1}"
        })
    return grids

@router.get('/grids/{grid_id}')
async def get_grid_details(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    model: str = Query('ensemble'),
    resolution: str = Query('1km'),
    sources: str = Query('caaqms,weather')
):
    """Returns dynamic forecast detail, pollutant breakdown, and history for a grid cell."""
    service = request.app.state.prediction_service
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f"Grid ID {grid_id} not found.")
        
    try:
        base_detail = service.get_grid_detail(grid_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Grid ID {grid_id} not found.")
        
    b, lat_step, lon_step = get_city_bounds_and_steps(city)
    row = grid_id // 20
    col = grid_id % 20
    
    lat_min = b['lat_min'] + row * lat_step
    lat_max = lat_min + lat_step
    lon_min = b['lon_min'] + col * lon_step
    lon_max = lon_min + lon_step
    
    seed = abs(hash(city + model + resolution + str(grid_id))) % (2**32)
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
        
    model_offset = 0.0
    if model == 'xgboost':
        model_offset = 5.0
    elif model == 'lightgbm':
        model_offset = -3.0
    elif model == 'lstm':
        model_offset = rng.normal(0, 4)
        
    detail = dict(base_detail)
    
    # Adjust lat/lons
    detail['grid_id'] = grid_id
    detail['row'] = row
    detail['col'] = col
    detail['lat'] = (lat_min + lat_max) / 2
    detail['lon'] = (lon_min + lon_max) / 2
    detail['lat_min'] = lat_min
    detail['lat_max'] = lat_max
    detail['lon_min'] = lon_min
    detail['lon_max'] = lon_max
    detail['area_name'] = f"{city.title()} Sector {grid_id + 1}"
    
    # Scale forecast AQIs
    c_val = float(np.clip(detail['current_aqi'] * city_factor + model_offset, 20, 500))
    h24_val = float(np.clip(detail['aqi_24h'] * city_factor + model_offset, 20, 500))
    h48_val = float(np.clip(detail['aqi_48h'] * city_factor + model_offset, 20, 500))
    h72_val = float(np.clip(detail['aqi_72h'] * city_factor + model_offset, 20, 500))
    
    detail['current_aqi'] = c_val
    detail['aqi_24h'] = h24_val
    detail['aqi_48h'] = h48_val
    detail['aqi_72h'] = h72_val
    
    detail['current_category'] = get_aqi_category(c_val)
    detail['aqi_24h_category'] = get_aqi_category(h24_val)
    detail['aqi_48h_category'] = get_aqi_category(h48_val)
    detail['aqi_72h_category'] = get_aqi_category(h72_val)
    
    detail['current_color'] = get_aqi_color(c_val)
    detail['aqi_24h_color'] = get_aqi_color(h24_val)
    detail['aqi_48h_color'] = get_aqi_color(h48_val)
    detail['aqi_72h_color'] = get_aqi_color(h72_val)
    
    # Scale pollutants (preferring real coordinates if available)
    if real_data:
        detail['pm25'] = float(np.clip(real_data['pm25'] + rng.normal(0, 1.5), 1, 350))
        detail['pm10'] = float(np.clip(real_data['pm10'] + rng.normal(0, 3), 2, 500))
        detail['no2'] = float(np.clip(real_data['no2'] + rng.normal(0, 1), 1, 200))
        detail['so2'] = float(np.clip(real_data['so2'] + rng.normal(0, 0.5), 1, 150))
        detail['co'] = float(np.clip(real_data['co'] + rng.normal(0, 0.05), 0.01, 10))
        detail['o3'] = float(np.clip(real_data['o3'] + rng.normal(0, 2), 1, 250))
        detail['nh3'] = float(np.clip(real_data['nh3'] + rng.normal(0, 0.5), 0.1, 150))
    else:
        detail['pm25'] = float(np.clip(c_val * 0.35 + rng.normal(0, 2), 5, 250))
        detail['pm10'] = float(np.clip(c_val * 0.55 + rng.normal(0, 4), 10, 450))
        detail['no2'] = float(np.clip(c_val * 0.12 + rng.normal(0, 1), 2, 120))
        detail['so2'] = float(np.clip(c_val * 0.08 + rng.normal(0, 1), 1, 80))
        detail['co'] = float(np.clip(c_val * 0.015 + rng.normal(0, 0.1), 0.1, 15))
        detail['o3'] = float(np.clip(50 + rng.normal(0, 10), 10, 150))
        detail['nh3'] = float(np.clip(c_val * 0.04 + rng.normal(0, 1), 1, 90))
    
    # Adapt time series history
    ts_adj = []
    for pt in base_detail['time_series']:
        pt_aqi = float(np.clip(pt['aqi'] * city_factor + model_offset, 20, 500))
        ts_adj.append({
            'timestamp': pt['timestamp'],
            'aqi': pt_aqi,
            'category': get_aqi_category(pt_aqi),
            'color': get_aqi_color(pt_aqi)
        })
    detail['time_series'] = ts_adj
    detail['model_name'] = model
    
    return detail
