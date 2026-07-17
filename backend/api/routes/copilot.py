"""
AI Copilot API — Groq-powered conversational assistant for government officers.
Endpoints:
  POST /api/copilot/chat       — Multi-turn conversation
  GET  /api/copilot/status     — Groq service health check
  POST /api/copilot/explain    — One-shot NL explanation for a grid
  POST /api/copilot/summarize  — Executive summary generation
  POST /api/copilot/translate  — Multi-language advisory translation
  POST /api/copilot/report     — Compliance report generation
"""

from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from backend.services import groq_service

router = APIRouter()


# ─── Models ──────────────────────────────────────────────────────────────────

class Message(BaseModel):
    role: str   # "user" or "assistant"
    content: str


class ChatRequest(BaseModel):
    messages: List[Message]
    city: str = "bengaluru"
    current_aqi: Optional[float] = None
    context: Optional[dict] = None


class ExplainRequest(BaseModel):
    grid_id: int
    city: str = "bengaluru"
    ward: str = ""
    current_aqi: float
    forecast_aqi: float
    top_features: List[dict]
    dominant_pollutant: str = "PM2.5"


class SummaryRequest(BaseModel):
    city: str
    avg_aqi: float
    hotspot_count: int = 0
    dominant_pollutant: str = "PM2.5"
    top_sources: List[str] = []
    health_risk_population: int = 0
    recommended_actions: List[str] = []


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "hi"   # ISO 639-1 code: hi, ta, te, kn, mr, bn, gu, pa


class SimNarrativeRequest(BaseModel):
    city: str
    interventions: List[str]
    aqi_before: float
    aqi_after: float
    reduction_pct: float
    health_impact: dict = {}
    budget_inr: int = 0


class ReportRequest(BaseModel):
    city: str
    period: str = "Last 7 Days"
    avg_aqi: float = 0.0
    violations: List[str] = []
    actions_taken: List[str] = []
    recommendations: List[str] = []


# ─── Routes ──────────────────────────────────────────────────────────────────

@router.get("/copilot/status")
async def copilot_status():
    """Returns Groq service availability and mode."""
    return groq_service.get_service_status()


@router.post("/copilot/chat")
async def copilot_chat(payload: ChatRequest):
    """Multi-turn conversational AI Copilot endpoint."""
    if not payload.messages:
        raise HTTPException(status_code=400, detail="At least one message is required.")

    messages = [{"role": m.role, "content": m.content} for m in payload.messages]
    response = await groq_service.chat_with_copilot(
        messages=messages,
        city=payload.city,
        current_aqi=payload.current_aqi,
        context=payload.context,
    )
    return {"response": response, "model": groq_service.get_service_status()["model"]}


@router.post("/copilot/explain")
async def copilot_explain(payload: ExplainRequest):
    """Generate a natural-language XAI explanation for a single grid prediction."""
    narrative = await groq_service.generate_explanation_narrative(
        grid_id=payload.grid_id,
        city=payload.city,
        ward=payload.ward or f"Zone {payload.grid_id // 20 + 1}",
        current_aqi=payload.current_aqi,
        forecast_aqi=payload.forecast_aqi,
        top_features=payload.top_features,
        dominant_pollutant=payload.dominant_pollutant,
    )
    return {"explanation": narrative, "grid_id": payload.grid_id, "city": payload.city}


@router.post("/copilot/summarize")
async def copilot_summarize(payload: SummaryRequest):
    """Generate an executive summary for city decision-makers."""
    summary = await groq_service.generate_executive_summary(
        city=payload.city,
        avg_aqi=payload.avg_aqi,
        hotspot_count=payload.hotspot_count,
        dominant_pollutant=payload.dominant_pollutant,
        top_sources=payload.top_sources,
        health_risk_population=payload.health_risk_population,
        recommended_actions=payload.recommended_actions,
    )
    return {"summary": summary, "city": payload.city}


@router.post("/copilot/translate")
async def copilot_translate(payload: TranslateRequest):
    """Translate a health advisory to a regional Indian language."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text to translate cannot be empty.")

    translated = await groq_service.translate_advisory(payload.text, payload.target_lang)
    return {
        "original": payload.text,
        "translated": translated,
        "target_lang": payload.target_lang,
    }


@router.post("/copilot/simulate-narrative")
async def copilot_simulate_narrative(payload: SimNarrativeRequest):
    """Generate narrative explaining digital twin simulation results."""
    narrative = await groq_service.generate_simulation_narrative(
        city=payload.city,
        interventions=payload.interventions,
        aqi_before=payload.aqi_before,
        aqi_after=payload.aqi_after,
        reduction_pct=payload.reduction_pct,
        health_impact=payload.health_impact,
        budget_inr=payload.budget_inr,
    )
    return {"narrative": narrative, "city": payload.city}


@router.post("/copilot/report")
async def copilot_report(payload: ReportRequest):
    """Generate a formal compliance report for regulatory submission."""
    report = await groq_service.generate_compliance_report(
        city=payload.city,
        period=payload.period,
        avg_aqi=payload.avg_aqi,
        violations=payload.violations,
        actions_taken=payload.actions_taken,
        recommendations=payload.recommendations,
    )
    return {"report": report, "city": payload.city, "period": payload.period}
