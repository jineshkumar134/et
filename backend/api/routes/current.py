from fastapi import APIRouter, Request

router = APIRouter()

@router.get('/current')
async def get_current_aqi(request: Request):
    """Returns the latest real-time AQI predictions for all 400 grids."""
    service = request.app.state.prediction_service
    return service.get_all_current()

@router.get('/current/summary')
async def get_current_summary(request: Request):
    """Returns a city-wide AQI overview summary."""
    service = request.app.state.prediction_service
    return service.get_city_summary()
