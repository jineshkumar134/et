from fastapi import APIRouter, Request, Query, HTTPException, Body
from backend.services.enforcement_service import EnforcementEngine, INSPECTION_STORE
from datetime import datetime, timezone
from pydantic import BaseModel
from typing import Optional

router = APIRouter()
engine = EnforcementEngine()

# Pydantic models for request validation
class AssignInspectorRequest(BaseModel):
    grid_id: int
    city: str
    inspector_name: str

class UpdateStatusRequest(BaseModel):
    grid_id: int
    city: str
    status: str # Pending, Assigned, In Progress, Completed, Rejected
    compliance_notes: Optional[str] = ""

@router.get('/enforcement/recommendations')
async def get_all_recommendations(
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km'),
    priority: str = Query(None), # Critical, High, Medium, Low
    source: str = Query(None), # Traffic, Construction, Industry, Waste Burning
    ward: str = Query(None)
):
    """Returns prioritized municipal enforcement action directives for all polluted grids."""
    forecast_service = request.app.state.prediction_service
    recs = engine.get_city_recommendations(city, forecast_service, resolution)
    
    # Filter results
    filtered = []
    for r in recs:
        if priority and r['priority'].lower() != priority.lower():
            continue
        if source and r['primary_source'].lower() != source.lower():
            continue
        if ward and r['ward'].lower() != ward.lower():
            continue
        filtered.append(r)
        
    # Get optimized sequence route for high priority hotspots
    route = engine.get_optimized_route(filtered)
    
    return {
        'recommendations': filtered,
        'optimized_route': route,
        'summary': {
            'total_alerts': len(filtered),
            'critical_count': len([r for r in filtered if r['priority'] == 'Critical']),
            'high_count': len([r for r in filtered if r['priority'] == 'High']),
            'completed_inspections': len([r for r in filtered if r['status'] == 'Completed']),
            'pending_actions': len([r for r in filtered if r['status'] in ['Pending', 'Assigned', 'In Progress']])
        }
    }

@router.get('/enforcement/grid/{grid_id}')
async def get_grid_recommendation(
    grid_id: int,
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km')
):
    """Returns enforcement details for a single grid cell."""
    forecast_service = request.app.state.prediction_service
    recs = engine.get_city_recommendations(city, forecast_service, resolution)
    match = next((r for r in recs if r['grid_id'] == grid_id), None)
    if not match:
        raise HTTPException(status_code=404, detail=f"No enforcement recommendation found for Grid ID {grid_id}")
    return match

@router.get('/enforcement/critical')
async def get_critical_locations(
    request: Request,
    city: str = Query('bengaluru'),
    resolution: str = Query('1km')
):
    """Returns only critical or high-priority hotspot recommendations."""
    forecast_service = request.app.state.prediction_service
    recs = engine.get_city_recommendations(city, forecast_service, resolution)
    critical_zones = [r for r in recs if r['priority'] in ['Critical', 'High']]
    return critical_zones

@router.post('/enforcement/assign')
async def assign_inspector(req: AssignInspectorRequest = Body(...)):
    """Assigns an inspector to a grid cell enforcement recommendation."""
    task_key = f"{req.city.lower()}_{req.grid_id}"
    if task_key not in INSPECTION_STORE:
        INSPECTION_STORE[task_key] = {
            'status': 'Assigned',
            'assigned_inspector': req.inspector_name,
            'compliance_notes': '',
            'last_updated': datetime.now(timezone.utc).isoformat()
        }
    else:
        INSPECTION_STORE[task_key]['status'] = 'Assigned'
        INSPECTION_STORE[task_key]['assigned_inspector'] = req.inspector_name
        INSPECTION_STORE[task_key]['last_updated'] = datetime.now(timezone.utc).isoformat()
        
    return {
        'status': 'success',
        'message': f"Assigned inspector {req.inspector_name} to Grid {req.grid_id}.",
        'data': INSPECTION_STORE[task_key]
    }

@router.post('/enforcement/update')
async def update_status(req: UpdateStatusRequest = Body(...)):
    """Updates inspection workflow status and compliance remarks."""
    task_key = f"{req.city.lower()}_{req.grid_id}"
    valid_statuses = ['Pending', 'Assigned', 'In Progress', 'Completed', 'Rejected']
    if req.status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of {valid_statuses}")
        
    if task_key not in INSPECTION_STORE:
        INSPECTION_STORE[task_key] = {
            'status': req.status,
            'assigned_inspector': '—',
            'compliance_notes': req.compliance_notes or '',
            'last_updated': datetime.now(timezone.utc).isoformat()
        }
    else:
        INSPECTION_STORE[task_key]['status'] = req.status
        if req.compliance_notes:
            INSPECTION_STORE[task_key]['compliance_notes'] = req.compliance_notes
        INSPECTION_STORE[task_key]['last_updated'] = datetime.now(timezone.utc).isoformat()
        
    return {
        'status': 'success',
        'message': f"Updated task status for Grid {req.grid_id} to {req.status}.",
        'data': INSPECTION_STORE[task_key]
    }
