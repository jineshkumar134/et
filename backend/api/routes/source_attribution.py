from fastapi import APIRouter, Request, Query, HTTPException
from backend.services.source_attribution_service import SourceAttributionAgent
import numpy as np

router = APIRouter()
agent = SourceAttributionAgent()

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

@router.get('/source-attribution')
async def get_all_attributions(
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km'),
    source: str = Query(None), # Filter by dominant source
    pollutant: str = Query(None), # PM2.5, PM10, NO2, CO, SO2
    time_range: str = Query('today')
):
    """Returns explainable source attribution breakdown for all 400 grids positioned within city boundaries."""
    city_key = city.lower()
    lat_c, lon_c = CITY_COORDS.get(city_key, (12.9716, 77.5946))
    
    # We can fetch grid forecast values to compute real AQI bases
    forecast_service = request.app.state.prediction_service
    
    # Map time_range query to horizon forecasts
    horizon_map = {
        'today': 'current',
        'yesterday': '24h',
        'last_week': '72h'
    }
    horizon = horizon_map.get(time_range.lower(), 'current')
    
    try:
        forecasts = forecast_service.get_all_forecasts(horizon)
    except Exception:
        forecasts = []
        
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
    
    # Seed generator for meteorological parameters
    seed = abs(hash(city + resolution + time_range)) % (2**32)
    rng = np.random.default_rng(seed)
    
    # Static wind vector for the day
    wind_speed = float(rng.uniform(2.0, 7.5))
    wind_direction = float(rng.uniform(0.0, 360.0))
    
    attributions = []
    for g in forecasts:
        # Calculate coordinates matching city boundaries dynamically
        row = g['grid_id'] // 20
        col = g['grid_id'] % 20
        
        lat_min = b['lat_min'] + row * lat_step
        lat_max = lat_min + lat_step
        lon_min = b['lon_min'] + col * lon_step
        lon_max = lon_min + lon_step
        
        g_lat = (lat_min + lat_max) / 2
        g_lon = (lon_min + lon_max) / 2
        
        # Fetch individual attribution
        attr = agent.compute_attribution(
            grid_id=g['grid_id'],
            lat=g_lat,
            lon=g_lon,
            city=city,
            aqi=g['aqi'],
            wind_speed=wind_speed,
            wind_direction=wind_direction
        )
        
        # Apply filters if defined
        if source:
            dominant_source = max(attr['contributions'], key=lambda c: c['percentage'])['source']
            if dominant_source.lower() != source.lower():
                continue
                
        if pollutant:
            if attr['dominant_pollutant'].upper() != pollutant.upper():
                continue
                
        attributions.append(attr)
        
    return attributions

@router.get('/source-attribution/{grid_id}')
async def get_grid_attribution(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km'),
    time_range: str = Query('today')
):
    """Returns comprehensive XAI explanation details for a single grid cell."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f"Grid ID {grid_id} not found.")
        
    # Get coordinates and AQI of this grid cell
    city_key = city.lower()
    
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
    b = bounds.get(city_key, bounds['bengaluru'])
    lat_step = (b['lat_max'] - b['lat_min']) / 20
    lon_step = (b['lon_max'] - b['lon_min']) / 20
    
    row = grid_id // 20
    col = grid_id % 20
    lat_min = b['lat_min'] + row * lat_step
    lat_max = lat_min + lat_step
    lon_min = b['lon_min'] + col * lon_step
    lon_max = lon_min + lon_step
    lat = (lat_min + lat_max) / 2
    lon = (lon_min + lon_max) / 2
    
    # Get AQI
    forecast_service = request.app.state.prediction_service
    
    # Map horizon
    horizon_map = {'today': 'current', 'yesterday': '24h', 'last_week': '72h'}
    horizon = horizon_map.get(time_range.lower(), 'current')
    
    try:
        grid_detail = forecast_service.get_grid_detail(grid_id)
        aqi = grid_detail['current_aqi']
    except Exception:
        aqi = 120.0 # Default fallback
        
    attr = agent.compute_attribution(
        grid_id=grid_id,
        lat=lat,
        lon=lon,
        city=city,
        aqi=aqi
    )
    return attr

@router.get('/evidence/{grid_id}')
async def get_grid_evidence(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km'),
    time_range: str = Query('today')
):
    """Returns evidence list for the specified grid cell."""
    attr = await get_grid_attribution(
        grid_id=grid_id,
        request=request,
        city=city,
        resolution=resolution,
        time_range=time_range
    )
    return {
        'grid_id': grid_id,
        'evidence': attr['evidence'],
        'confidence': attr['confidence']
    }
