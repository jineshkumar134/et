from fastapi import APIRouter, Request, Query
from datetime import datetime, timezone
import numpy as np
from backend.services.real_aqi import fetch_real_aqi

router = APIRouter()

# City coordinates lookup
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

@router.get('/dashboard')
async def get_dashboard(
    request: Request,
    city: str = Query('bengaluru'),
    model: str = Query('ensemble'),
    resolution: str = Query('1km'),
    sources: str = Query('caaqms,weather')
):
    """Returns real-time live city-wide dashboard statistics from Open-Meteo or fallback simulation."""
    service = request.app.state.prediction_service
    base_summary = service.get_city_summary()
    
    city_key = city.lower()
    lat, lon = CITY_COORDS.get(city_key, (12.9716, 77.5946))
    
    # Fetch real live data
    real_data = fetch_real_aqi(lat, lon)
    
    city_display_names = {
        'bengaluru': 'Bengaluru',
        'delhi': 'Delhi',
        'mumbai': 'Mumbai',
        'chennai': 'Chennai',
        'kolkata': 'Kolkata',
        'hyderabad': 'Hyderabad',
        'ahmedabad': 'Ahmedabad',
        'pune': 'Pune'
    }
    city_name = city_display_names.get(city_key, city.title())
    
    if real_data:
        # Use real data from API
        avg_aqi = real_data['aqi']
        # Determine dominant pollutant based on largest value or key metrics
        dominant = 'PM2.5' if real_data['pm25'] > 15 else 'PM10'
    else:
        # Fallback simulation if offline
        seed = abs(hash(city + model + resolution)) % (2**32)
        rng = np.random.default_rng(seed)
        multipliers = {
            'delhi': 3.1, 'kolkata': 2.3, 'ahmedabad': 1.9,
            'mumbai': 1.6, 'pune': 1.4, 'hyderabad': 1.3,
            'chennai': 1.1, 'bengaluru': 0.9
        }
        city_factor = multipliers.get(city_key, 1.0)
        avg_aqi = float(rng.uniform(70, 110) * city_factor)
        dominant = 'PM2.5' if city_key in ['delhi', 'kolkata', 'ahmedabad'] else 'PM10'

    # Resolve dominant category based on AQI
    if avg_aqi <= 50:
        dominant_cat = 'Good'
    elif avg_aqi <= 100:
        dominant_cat = 'Satisfactory'
    elif avg_aqi <= 200:
        dominant_cat = 'Moderate'
    elif avg_aqi <= 300:
        dominant_cat = 'Poor'
    elif avg_aqi <= 400:
        dominant_cat = 'Very Poor'
    else:
        dominant_cat = 'Severe'
        
    # Generate category counts representing 400 grids total
    if avg_aqi <= 50:
        good_cnt, satisfactory_cnt, moderate_cnt, poor_cnt, very_poor_cnt, severe_cnt = 320, 70, 10, 0, 0, 0
    elif avg_aqi <= 100:
        good_cnt, satisfactory_cnt, moderate_cnt, poor_cnt, very_poor_cnt, severe_cnt = 80, 270, 45, 5, 0, 0
    elif avg_aqi <= 200:
        good_cnt, satisfactory_cnt, moderate_cnt, poor_cnt, very_poor_cnt, severe_cnt = 15, 95, 235, 45, 10, 0
    elif avg_aqi <= 300:
        good_cnt, satisfactory_cnt, moderate_cnt, poor_cnt, very_poor_cnt, severe_cnt = 0, 10, 80, 210, 80, 20
    else:
        good_cnt, satisfactory_cnt, moderate_cnt, poor_cnt, very_poor_cnt, severe_cnt = 0, 0, 15, 65, 200, 120

    city_stations = {
        'bengaluru': 26, 'delhi': 40, 'mumbai': 35, 'chennai': 18,
        'kolkata': 22, 'hyderabad': 14, 'ahmedabad': 12, 'pune': 10
    }
    stations_count = city_stations.get(city_key, 26)
        
    return {
        'city_name': city_name,
        'city_aqi': round(avg_aqi, 1),
        'city_category': dominant_cat,
        'dominant_pollutant': dominant,
        'monitoring_stations': stations_count,
        'last_updated': datetime.now(timezone.utc).isoformat(),
        'num_grids': base_summary['num_grids'],
        'grid_statistics': [
            {'title': 'Good Grids', 'count': good_cnt, 'color': '#16A34A', 'key': 'Good'},
            {'title': 'Satisfactory Grids', 'count': satisfactory_cnt, 'color': '#84CC16', 'key': 'Satisfactory'},
            {'title': 'Moderate Grids', 'count': moderate_cnt, 'color': '#F59E0B', 'key': 'Moderate'},
            {'title': 'Severe Grids', 'count': severe_cnt, 'color': '#7C3AED', 'key': 'Severe'}
        ],
        'pollutants': [
            {'key': 'pm25', 'label': 'PM2.5', 'unit': 'µg/m³'},
            {'key': 'pm10', 'label': 'PM10', 'unit': 'µg/m³'},
            {'key': 'no2', 'label': 'NO₂', 'unit': 'µg/m³'},
            {'key': 'so2', 'label': 'SO₂', 'unit': 'µg/m³'},
            {'key': 'co', 'label': 'CO', 'unit': 'mg/m³'},
            {'key': 'o3', 'label': 'O₃', 'unit': 'µg/m³'},
            {'key': 'nh3', 'label': 'NH₃', 'unit': 'µg/m³'}
        ],
        'aqi_categories': {
            'Good': {'range': [0, 50], 'color': '#16A34A', 'bgColor': 'bg-green-600', 'textColor': 'text-green-400'},
            'Satisfactory': {'range': [51, 100], 'color': '#84CC16', 'bgColor': 'bg-lime-650', 'textColor': 'text-lime-400'},
            'Moderate': {'range': [101, 200], 'color': '#F59E0B', 'bgColor': 'bg-yellow-600', 'textColor': 'text-yellow-400'},
            'Poor': {'range': [201, 300], 'color': '#EA580C', 'bgColor': 'bg-orange-650', 'textColor': 'text-orange-400'},
            'Very Poor': {'range': [301, 400], 'color': '#DC2626', 'bgColor': 'bg-red-600', 'textColor': 'text-red-400'},
            'Severe': {'range': [401, 500], 'color': '#7C3AED', 'bgColor': 'bg-purple-600', 'textColor': 'text-purple-400'}
        }
    }
