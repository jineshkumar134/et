from fastapi import APIRouter, Request, Query, HTTPException
from backend.services.explainability_service import ExplainabilityAgent

router = APIRouter()
agent = ExplainabilityAgent()


# ─── GET /api/explain/grid/{grid_id} ────────────────────────────────────────
@router.get('/explain/grid/{grid_id}')
async def get_grid_explanation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns complete XAI reasoning, SHAP metrics, what-if simulations, and decision tree paths for a grid."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    forecast_service = request.app.state.prediction_service
    explanation = await agent.explain_grid(grid_id, city, forecast_service)
    return explanation


# ─── GET /api/explain/forecast/{grid_id} ────────────────────────────────────
@router.get('/explain/forecast/{grid_id}')
async def get_forecast_explanation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns detailed explanation specifically regarding the forecasting logic."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    forecast_service = request.app.state.prediction_service
    explanation = await agent.explain_grid(grid_id, city, forecast_service)
    return {
        'grid_id': grid_id,
        'city': city,
        'forecast_aqi_24h': explanation['forecast_24h'],
        'confidence': explanation['forecast_confidence'],
        'uncertainty_bounds': explanation['uncertainty_analysis'],
        'feature_importance': explanation['feature_importance'],
        'natural_language': explanation['natural_language_explanation'],
        'supporting_evidence': explanation['supporting_evidence'],
    }


# ─── GET /api/explain/source/{grid_id} ──────────────────────────────────────
@router.get('/explain/source/{grid_id}')
async def get_source_explanation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns explainable evidence parameters for the source attribution output."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    forecast_service = request.app.state.prediction_service
    explanation = await agent.explain_grid(grid_id, city, forecast_service)
    return {
        'grid_id': grid_id,
        'city': city,
        'source_attribution': explanation['source_attribution'],
    }


# ─── GET /api/explain/enforcement/{grid_id} ─────────────────────────────────
@router.get('/explain/enforcement/{grid_id}')
async def get_enforcement_explanation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns justifications for prioritization metrics and recommended inspector enforcement."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    forecast_service = request.app.state.prediction_service
    explanation = await agent.explain_grid(grid_id, city, forecast_service)
    return {
        'grid_id': grid_id,
        'city': city,
        'enforcement_reasoning': explanation['enforcement_reasoning'],
    }


# ─── GET /api/explain/health/{grid_id} ──────────────────────────────────────
@router.get('/explain/health/{grid_id}')
async def get_health_explanation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns justifications and confidence parameters for target group medical recommendations."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    forecast_service = request.app.state.prediction_service
    explanation = await agent.explain_grid(grid_id, city, forecast_service)
    return {
        'grid_id': grid_id,
        'city': city,
        'health_reasoning': explanation['health_reasoning'],
    }
