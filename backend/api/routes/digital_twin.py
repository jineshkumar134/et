from fastapi import APIRouter, Request, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.services.digital_twin_service import DigitalTwinAgent

router = APIRouter()
agent = DigitalTwinAgent()


# ─── POST /api/simulate ───────────────────────────────────────────────────────
class SimulateRequest(BaseModel):
    city: str = 'bengaluru'
    interventions: List[str]


@router.post('/simulate')
async def simulate_scenario(
    payload: SimulateRequest,
    request: Request,
):
    """Executes a policy bundle simulation on the city digital twin."""
    if not payload.interventions:
        raise HTTPException(status_code=400, detail='At least one intervention must be specified.')

    forecast_service = request.app.state.prediction_service
    result = agent.simulate_scenario(
        city=payload.city,
        intervention_keys=payload.interventions,
        forecast_service=forecast_service,
    )
    return result


# ─── GET /api/simulation/history ──────────────────────────────────────────────
@router.get('/simulation/history')
async def get_simulation_history():
    """Returns log metadata for all previous simulation runs in this session."""
    return agent.get_history()


# ─── GET /api/simulation/{id} ─────────────────────────────────────────────────
@router.get('/simulation/{id}')
async def get_simulation_detail(id: str):
    """Returns full parameter details and grid mappings for a single completed simulation."""
    detail = agent.get_simulation_detail(id)
    if detail is None:
        raise HTTPException(status_code=404, detail=f'Simulation run "{id}" not found.')
    return detail


# ─── POST /api/compare ────────────────────────────────────────────────────────
class CompareRequest(BaseModel):
    city: str = 'bengaluru'
    scenarios: List[List[str]]  # List of intervention bundles


@router.post('/compare')
async def compare_scenarios(
    payload: CompareRequest,
    request: Request,
):
    """Compares multiple scenarios side-by-side, returning comparative scores and rankings."""
    if len(payload.scenarios) < 2:
        raise HTTPException(status_code=400, detail='Provide at least two scenarios for comparison.')

    forecast_service = request.app.state.prediction_service
    results = []
    for idx, sc in enumerate(payload.scenarios, 1):
        sim = agent.simulate_scenario(
            city=payload.city,
            intervention_keys=sc,
            forecast_service=forecast_service,
        )
        results.append({
            'scenario_index': idx,
            'simulation_id': sim['simulation_id'],
            'interventions': sc,
            'intervention_names': sim['intervention_names'],
            'aqi_reduction_pct': sim['summary']['aqi_reduction_pct'],
            'avg_aqi_after': sim['summary']['avg_aqi_after'],
            'hospital_visits_prevented': sim['health_impact']['hospital_visits_prevented'],
            'estimated_budget_inr': sim['resources']['estimated_budget_inr'],
            'overall_score': sim['policy_score']['priority'],
            'recommendation': sim['policy_score']['recommendation'],
        })

    # Sort by expected AQI reduction (best strategy first)
    results.sort(key=lambda x: x['aqi_reduction_pct'], reverse=True)

    return {
        'city': payload.city,
        'comparisons': results,
        'best_strategy_index': results[0]['scenario_index'],
    }


# ─── GET /api/simulation/recommendations ──────────────────────────────────────
@router.get('/simulation/recommendations')
async def get_ai_recommendations(
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns AI-optimized strategy bundles recommendation based on current forecasts."""
    forecast_service = request.app.state.prediction_service
    recs = agent.get_ai_recommendations(city, forecast_service)
    return recs
