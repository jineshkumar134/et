from fastapi import APIRouter, Request, Query, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.services.data_fusion_service import get_engine, DATA_SOURCES

router = APIRouter()


def _ensure_pipeline(engine, city: str):
    """Run pipeline if engine hasn't been initialized for this session."""
    status = engine.get_status()
    if not status.get('initialized'):
        engine.run_pipeline(city)


# ─── GET /api/data/status ─────────────────────────────────────────────────────
@router.get('/data/status')
async def get_data_status(
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns live connection status, quality scores, latency, and anomalies for all sources."""
    engine = get_engine()
    _ensure_pipeline(engine, city)
    return engine.get_status()


# ─── GET /api/data/quality ────────────────────────────────────────────────────
@router.get('/data/quality')
async def get_data_quality(
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns detailed data quality metrics, scores, and overall health grade."""
    engine = get_engine()
    _ensure_pipeline(engine, city)
    return engine.get_quality()


# ─── GET /api/data/features/{grid_id} ────────────────────────────────────────
@router.get('/data/features/{grid_id}')
async def get_grid_features(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns the fused AI-ready feature vector for a single 1km² grid cell."""
    if grid_id < 0 or grid_id >= 400:
        raise HTTPException(status_code=404, detail=f'Grid {grid_id} not found.')

    engine = get_engine()
    _ensure_pipeline(engine, city)

    features = engine.get_grid_features(grid_id)
    if features is None:
        raise HTTPException(status_code=404, detail=f'Features for grid {grid_id} not yet computed.')

    return features


# ─── GET /api/data/features ───────────────────────────────────────────────────
@router.get('/data/features')
async def get_all_features(
    request: Request,
    city: str = Query('bengaluru'),
    limit: int = Query(400),
):
    """Returns all fused feature vectors (the full feature store)."""
    engine = get_engine()
    _ensure_pipeline(engine, city)

    store = engine._feature_store
    grids = list(store.values())[:limit]
    stats = engine.get_feature_statistics()

    return {
        'city': city,
        'total_grids': len(store),
        'features': grids,
        'statistics': stats,
    }


# ─── GET /api/data/sources ────────────────────────────────────────────────────
@router.get('/data/sources')
async def get_data_sources():
    """Returns metadata for all registered data source connectors."""
    engine = get_engine()
    return {
        'sources': engine.get_all_sources(),
        'total': len(DATA_SOURCES),
    }


# ─── GET /api/data/statistics ─────────────────────────────────────────────────
@router.get('/data/statistics')
async def get_feature_statistics(
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns min/max/mean statistics for all numeric features across all grids."""
    engine = get_engine()
    _ensure_pipeline(engine, city)
    return engine.get_feature_statistics()


# ─── GET /api/data/anomalies ──────────────────────────────────────────────────
@router.get('/data/anomalies')
async def get_anomalies(
    request: Request,
    city: str = Query('bengaluru'),
):
    """Returns all detected anomalies from the last pipeline run."""
    engine = get_engine()
    _ensure_pipeline(engine, city)
    status = engine.get_status()
    return {
        'anomalies': status.get('anomalies', []),
        'count': status.get('anomaly_count', 0),
    }


# ─── POST /api/data/refresh ───────────────────────────────────────────────────
class RefreshRequest(BaseModel):
    city: str = 'bengaluru'
    num_grids: Optional[int] = 400


@router.post('/data/refresh')
async def refresh_data(payload: RefreshRequest):
    """Triggers a full synchronization run of the data fusion pipeline."""
    engine = get_engine()
    result = engine.run_pipeline(payload.city, payload.num_grids or 400)
    return {
        'message': f'Pipeline refreshed for {payload.city}.',
        'grids_fused': result['feature_store_size'],
        'overall_health': result['overall_health'],
        'anomalies_detected': result['anomaly_count'],
        'refreshed_at': result['refreshed_at'],
    }


# ─── POST /api/data/recompute ─────────────────────────────────────────────────
class RecomputeRequest(BaseModel):
    city: str = 'bengaluru'
    grid_ids: Optional[List[int]] = None   # None = recompute all


@router.post('/data/recompute')
async def recompute_features(payload: RecomputeRequest):
    """Rebuilds the fused feature dataset (full or partial grid recompute)."""
    engine = get_engine()
    num = len(payload.grid_ids) if payload.grid_ids else 400
    result = engine.run_pipeline(payload.city, 400)
    return {
        'message': f'Feature store recomputed for {payload.city}.',
        'grids_recomputed': num,
        'overall_health': result['overall_health'],
        'refreshed_at': result['refreshed_at'],
    }
