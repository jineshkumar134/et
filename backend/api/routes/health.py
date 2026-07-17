from fastapi import APIRouter, Request, Query, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from backend.services.health_advisory_service import HealthAdvisoryAgent, LANGUAGE_META, get_facilities

router = APIRouter()
agent = HealthAdvisoryAgent()

SUPPORTED_LANGUAGES = list(LANGUAGE_META.keys())


# ─── GET /api/health/risk ─────────────────────────────────────────────────────
@router.get('/health/risk')
async def get_all_health_risks(
    request: Request,
    city: str = Query('bengaluru'),
    lang: str = Query('english'),
    risk_level: str = Query(None),
    ward: str = Query(None),
    resolution: str = Query('1km'),
):
    """Returns health advisories for all grid cells in the city."""
    lang = lang.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        lang = 'english'

    forecast_service = request.app.state.prediction_service
    advisories = agent.get_all_advisories(
        city=city,
        forecast_service=forecast_service,
        lang=lang,
        risk_filter=risk_level,
        ward_filter=ward,
    )

    summary = agent.get_dashboard_summary(city, forecast_service)

    return {
        'advisories': advisories,
        'summary': summary,
        'city': city,
        'language': lang,
        'supported_languages': SUPPORTED_LANGUAGES,
        'facilities': get_facilities(city.lower()),
    }


# ─── GET /api/health/grid/{grid_id} ──────────────────────────────────────────
@router.get('/health/grid/{grid_id}')
async def get_grid_health(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    lang: str = Query('english'),
    resolution: str = Query('1km'),
):
    """Returns full health advisory for a single grid cell."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    lang = lang.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        lang = 'english'

    forecast_service = request.app.state.prediction_service
    advisory = agent.get_grid_advisory(
        grid_id=grid_id,
        city=city,
        forecast_service=forecast_service,
        lang=lang,
    )

    if advisory is None:
        raise HTTPException(status_code=404, detail=f'No advisory data for grid {grid_id}.')

    return advisory


# ─── GET /api/health/ward/{ward_id} ──────────────────────────────────────────
@router.get('/health/ward/{ward_id}')
async def get_ward_health(
    ward_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    lang: str = Query('english'),
    resolution: str = Query('1km'),
):
    """Returns aggregated worst-case health advisory for a ward."""
    if ward_id < 1 or ward_id > 25:
        raise HTTPException(status_code=400, detail='Ward ID must be between 1 and 25.')

    lang = lang.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        lang = 'english'

    forecast_service = request.app.state.prediction_service
    advisory = agent.get_ward_advisory(
        ward_id=ward_id,
        city=city,
        forecast_service=forecast_service,
        lang=lang,
    )

    if advisory is None:
        raise HTTPException(status_code=404, detail=f'No advisory data for Ward {ward_id}.')

    return advisory


# ─── GET /api/health/language/{lang} ─────────────────────────────────────────
@router.get('/health/language/{lang}')
async def get_health_in_language(
    lang: str,
    request: Request,
    city: str = Query('bengaluru'),
    risk_level: str = Query(None),
    resolution: str = Query('1km'),
):
    """Returns all health advisories translated into the specified language."""
    lang = lang.lower().strip()
    if lang not in SUPPORTED_LANGUAGES:
        raise HTTPException(
            status_code=400,
            detail=f'Language "{lang}" not supported. Supported: {SUPPORTED_LANGUAGES}'
        )

    forecast_service = request.app.state.prediction_service
    advisories = agent.get_all_advisories(
        city=city,
        forecast_service=forecast_service,
        lang=lang,
        risk_filter=risk_level,
    )

    return {
        'advisories': advisories,
        'language': lang,
        'language_meta': LANGUAGE_META[lang],
        'city': city,
    }


# ─── POST /api/notifications/send ─────────────────────────────────────────────
class NotificationRequest(BaseModel):
    grid_id: int
    city: str
    lang: Optional[str] = 'english'
    channels: Optional[List[str]] = ['sms', 'whatsapp', 'push', 'ivr', 'email', 'display_board']


@router.post('/notifications/send')
async def send_notifications(
    payload: NotificationRequest,
    request: Request,
):
    """Generates and returns notification templates for specified channels."""
    lang = (payload.lang or 'english').lower()
    if lang not in SUPPORTED_LANGUAGES:
        lang = 'english'

    forecast_service = request.app.state.prediction_service
    advisory = agent.get_grid_advisory(
        grid_id=payload.grid_id,
        city=payload.city,
        forecast_service=forecast_service,
        lang=lang,
    )

    if advisory is None:
        raise HTTPException(status_code=404, detail=f'No advisory data for grid {payload.grid_id}.')

    templates = advisory['notification_templates']

    # Filter to requested channels only
    channel_map = {
        'sms': templates.get('sms'),
        'whatsapp': templates.get('whatsapp'),
        'push': templates.get('push_notification'),
        'ivr': templates.get('ivr_script'),
        'email_subject': templates.get('email_subject'),
        'email_body': templates.get('email_body'),
        'display_board': templates.get('public_display_board'),
    }

    requested = {ch: channel_map[ch] for ch in payload.channels if ch in channel_map}

    return {
        'grid_id': payload.grid_id,
        'city': payload.city,
        'ward': advisory['ward'],
        'current_aqi': advisory['current_aqi'],
        'risk_level': advisory['risk_level'],
        'language': lang,
        'notifications': requested,
        'generated_at': advisory['generated_at'],
    }
