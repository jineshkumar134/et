import urllib.request
import json
import ssl

def fetch_real_aqi(lat: float, lon: float) -> dict:
    """
    Fetches real-time live air quality data from Open-Meteo for given coordinates.
    Disables SSL verify to prevent common python certificate issues on macOS/Windows.
    """
    url = f"https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,sulphur_dioxide,carbon_monoxide,ozone,ammonia"
    try:
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(
            url, 
            headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            current = data.get('current', {})
            
            # Map Open-Meteo pollutant names to our standard keys
            return {
                'aqi': float(current.get('us_aqi', 50)),
                'pm25': float(current.get('pm2_5', 12.0)),
                'pm10': float(current.get('pm10', 20.0)),
                'no2': float(current.get('nitrogen_dioxide', 10.0)),
                'so2': float(current.get('sulphur_dioxide', 5.0)),
                'co': float(current.get('carbon_monoxide', 200.0) / 1000.0), # convert µg/m³ to mg/m³ for CO
                'o3': float(current.get('ozone', 40.0)),
                'nh3': float(current.get('ammonia', 2.0) if current.get('ammonia') is not None else 1.5)
            }
    except Exception as e:
        print(f"Error fetching live air quality from Open-Meteo: {e}")
        # Fallback empty/default dict so caller knows it failed
        return {}
