"""
Groq AI Service — Central LLM Provider
=======================================
Powers all natural-language intelligence across the Urban Air Quality Platform:
• Explainability narratives (WHY predictions were made)
• Enforcement recommendations (WHAT action to take)
• Health advisories (WHAT risk exists & what to do)
• AI Copilot chat (interactive Q&A for officers)
• Executive summaries (high-level city reports)
• Scenario simulation narratives
• Multi-language translation (English → Hindi, Tamil, Telugu, Kannada)

Never hardcodes API keys — always reads from environment via settings.
Falls back to template-based responses when API key is not set or quota exceeded.
"""

import json
import logging
import re
from typing import Optional, AsyncIterator
from config.settings import settings

logger = logging.getLogger(__name__)

# ─── Groq client (lazy-initialized) ─────────────────────────────────────────
_groq_client = None


def _get_client():
    global _groq_client
    if _groq_client is None:
        key = settings.GROQ_API_KEY
        if not key or key.startswith("gsk_mock"):
            return None
        try:
            from groq import Groq
            _groq_client = Groq(api_key=key)
        except Exception as exc:
            logger.warning("Groq client init failed: %s", exc)
            return None
    return _groq_client


def _is_available() -> bool:
    key = settings.GROQ_API_KEY
    return bool(key and not key.startswith("gsk_mock"))


async def _call_groq(system_prompt: str, user_message: str, max_tokens: int = 512, temperature: float = 0.3) -> str:
    """Calls Groq API synchronously (wrapped). Falls back to template on error."""
    client = _get_client()
    if client is None:
        return None  # trigger fallback

    try:
        import asyncio
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model=settings.GROQ_MODEL_NAME,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                max_tokens=max_tokens,
                temperature=temperature,
            )
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning("Groq API call failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 1. EXPLAINABILITY NARRATIVE
# ─────────────────────────────────────────────────────────────────────────────

async def generate_explanation_narrative(
    grid_id: int,
    city: str,
    ward: str,
    current_aqi: float,
    forecast_aqi: float,
    top_features: list,
    dominant_pollutant: str,
) -> str:
    """Generate XAI natural language explanation for an AQI prediction."""

    feature_str = ", ".join(
        f"{f['feature']} ({f['percentage']}%)" for f in top_features[:4]
    )

    system = (
        "You are an expert environmental AI analyst. Your job is to explain AI-generated "
        "AQI predictions in clear, factual language for Indian government officials (CPCB officers, "
        "municipal commissioners). Be concise (3-4 sentences), cite specific factors, and "
        "avoid jargon. Always mention which pollutant is dominant and why."
    )
    user = (
        f"City: {city.title()}, Ward/Area: {ward}\n"
        f"Current AQI: {round(current_aqi)}, Predicted AQI (24h): {round(forecast_aqi)}\n"
        f"Dominant pollutant: {dominant_pollutant}\n"
        f"Top contributing factors: {feature_str}\n\n"
        "Explain WHY this AQI prediction was generated and what it means for this locality."
    )

    result = await _call_groq(system, user, max_tokens=300, temperature=0.4)
    if result:
        return result

    # Fallback template
    trend = "rising" if forecast_aqi > current_aqi else "declining"
    return (
        f"The AQI in {ward} is forecast to reach {round(forecast_aqi)} over the next 24 hours — "
        f"a {trend} trend from the current level of {round(current_aqi)}. "
        f"This is primarily driven by elevated {dominant_pollutant} concentrations, with "
        f"the top contributing factors being {feature_str}. "
        "Low horizontal wind speeds are reducing pollutant dispersion, causing localized accumulation. "
        "Immediate mitigation measures are recommended for sensitive receptors in this area."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 2. ENFORCEMENT RECOMMENDATION
# ─────────────────────────────────────────────────────────────────────────────

async def generate_enforcement_recommendation(
    grid_id: int,
    city: str,
    ward: str,
    priority_level: str,
    forecast_aqi: float,
    source_attributions: list,
    sensitive_receptors: list,
) -> str:
    """Generate AI-powered enforcement action recommendation."""

    sources_str = ", ".join(
        f"{s['source']} ({s['percentage']}%)" for s in source_attributions[:3]
    )
    receptors_str = ", ".join(sensitive_receptors[:3]) if sensitive_receptors else "None identified nearby"

    system = (
        "You are an enforcement advisory AI for India's Central Pollution Control Board (CPCB). "
        "Generate specific, actionable enforcement recommendations for field inspectors and "
        "municipal officers. Be direct and prescriptive. Cite regulations (CPCB norms, "
        "Graded Response Action Plan) where relevant. Limit to 4-5 concise bullet points."
    )
    user = (
        f"City: {city.title()}, Ward: {ward}\n"
        f"Priority Level: {priority_level}, Forecast AQI: {round(forecast_aqi)}\n"
        f"Primary pollution sources: {sources_str}\n"
        f"Sensitive receptors within 2km: {receptors_str}\n\n"
        "What specific enforcement actions should be taken in the next 24-48 hours? "
        "Format as numbered action items."
    )

    result = await _call_groq(system, user, max_tokens=400, temperature=0.3)
    if result:
        return result

    # Fallback
    return (
        f"1. Deploy enforcement inspector teams to {ward} immediately — AQI forecast exceeds "
        f"CPCB threshold at {round(forecast_aqi)} (Priority: {priority_level}).\n"
        "2. Issue Stop-Work notice to active construction sites within 1.5 km radius — "
        "mandate dust suppression spraying every 4 hours.\n"
        "3. Enforce heavy commercial vehicle ban from 6 AM–10 PM citing GRAP Stage II provisions.\n"
        "4. Alert fire department to preemptively check for burning incidents at industrial zones.\n"
        "5. Coordinate with municipal health department to issue precautionary alerts for "
        "nearby schools and hospitals."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3. HEALTH ADVISORY
# ─────────────────────────────────────────────────────────────────────────────

async def generate_health_advisory(
    city: str,
    ward: str,
    aqi: float,
    dominant_pollutant: str,
    vulnerable_groups: list,
) -> str:
    """Generate targeted health advisory for citizens."""

    groups_str = ", ".join(vulnerable_groups[:4])

    system = (
        "You are a public health AI advisor specializing in air quality health impacts for Indian cities. "
        "Generate targeted health advisories in simple, empathetic language that can be "
        "directly communicated to citizens. Include specific protective actions for each "
        "vulnerable group. Mention both immediate and preventive measures. Keep it under 200 words."
    )
    user = (
        f"City: {city.title()}, Locality: {ward}\n"
        f"Current AQI: {round(aqi)}, Dominant pollutant: {dominant_pollutant}\n"
        f"High-risk groups: {groups_str}\n\n"
        "Generate a health advisory for this locality."
    )

    result = await _call_groq(system, user, max_tokens=350, temperature=0.5)
    if result:
        return result

    aqi_cat = "Severe" if aqi > 300 else ("Very Poor" if aqi > 200 else "Poor")
    return (
        f"⚠️ Health Alert — {ward}, {city.title()}: Air quality is currently {aqi_cat} "
        f"(AQI: {round(aqi)}) due to elevated {dominant_pollutant}. "
        f"High-risk individuals ({groups_str}) should avoid all outdoor activities. "
        "Wear N95 masks if venturing outside. Keep windows closed and use air purifiers indoors. "
        "Seek medical attention if experiencing breathing difficulty, wheezing, or chest tightness. "
        "Children and elderly should not be taken to outdoor areas until air quality improves."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 4. EXECUTIVE SUMMARY
# ─────────────────────────────────────────────────────────────────────────────

async def generate_executive_summary(
    city: str,
    avg_aqi: float,
    hotspot_count: int,
    dominant_pollutant: str,
    top_sources: list,
    health_risk_population: int,
    recommended_actions: list,
) -> str:
    """Generate executive summary for city commissioners / policymakers."""

    sources_str = ", ".join(top_sources[:3])
    actions_str = "; ".join(recommended_actions[:3])

    system = (
        "You are an AI environmental policy advisor preparing executive briefings for "
        "Indian city commissioners and policymakers. Write in professional, formal English. "
        "The summary should highlight critical statistics, identify root causes, and recommend "
        "policy interventions. Keep it under 250 words. Use paragraph format."
    )
    user = (
        f"City: {city.title()}\n"
        f"City-wide Average AQI: {round(avg_aqi)}\n"
        f"Active Pollution Hotspots: {hotspot_count}\n"
        f"Dominant pollutant: {dominant_pollutant}\n"
        f"Primary pollution sources: {sources_str}\n"
        f"Population under health risk: {health_risk_population:,}\n"
        f"Recommended interventions: {actions_str}\n\n"
        "Write an executive summary for the city commissioner."
    )

    result = await _call_groq(system, user, max_tokens=400, temperature=0.3)
    if result:
        return result

    return (
        f"Executive Air Quality Report — {city.title()}\n\n"
        f"The city-wide average AQI stands at {round(avg_aqi)}, indicating a {('Severe' if avg_aqi > 300 else 'Very Poor' if avg_aqi > 200 else 'Poor')} "
        f"air quality situation with {hotspot_count} active pollution hotspots. "
        f"Primary sources include {sources_str}, with {dominant_pollutant} as the dominant pollutant. "
        f"An estimated {health_risk_population:,} residents are in the high-risk exposure zone. "
        "Immediate policy interventions are recommended including emission curbs, "
        "traffic management measures, and enhanced enforcement deployment. "
        "Continued monitoring and daily reporting is advised for the next 72 hours."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 5. SIMULATION NARRATIVE
# ─────────────────────────────────────────────────────────────────────────────

async def generate_simulation_narrative(
    city: str,
    interventions: list,
    aqi_before: float,
    aqi_after: float,
    reduction_pct: float,
    health_impact: dict,
    budget_inr: int,
) -> str:
    """Generate a narrative explaining simulation results."""

    interventions_str = ", ".join(interventions)
    saved = health_impact.get("hospital_visits_prevented", 0)
    population = health_impact.get("affected_population", 0)

    system = (
        "You are an AI policy simulation analyst for Indian municipal governments. "
        "Explain digital twin simulation results in clear, compelling language for policymakers. "
        "Quantify the impact, justify the cost, and recommend implementation priority. "
        "Keep it to 3-4 paragraphs."
    )
    user = (
        f"City: {city.title()}\n"
        f"Interventions simulated: {interventions_str}\n"
        f"AQI Before: {round(aqi_before)}, AQI After: {round(aqi_after)} "
        f"({round(reduction_pct)}% reduction)\n"
        f"Estimated population protected: {population:,}\n"
        f"Hospital admissions prevented: {saved}\n"
        f"Implementation cost: ₹{budget_inr:,}\n\n"
        "Provide a narrative explaining these simulation results and their policy significance."
    )

    result = await _call_groq(system, user, max_tokens=450, temperature=0.4)
    if result:
        return result

    return (
        f"The simulation of {interventions_str} in {city.title()} demonstrates a projected "
        f"{round(reduction_pct)}% reduction in city-wide AQI — from {round(aqi_before)} to {round(aqi_after)}. "
        f"This intervention bundle is estimated to protect {population:,} residents from "
        f"hazardous exposure and prevent {saved} hospital admissions over 72 hours. "
        f"At an estimated implementation cost of ₹{budget_inr:,}, the cost-benefit ratio "
        "strongly favors immediate deployment. The AI recommends this as a high-priority "
        "policy intervention given the health outcomes and achievable AQI improvements."
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6. MULTI-LANGUAGE TRANSLATION
# ─────────────────────────────────────────────────────────────────────────────

LANG_NAMES = {
    "hi": "Hindi",
    "ta": "Tamil",
    "te": "Telugu",
    "kn": "Kannada",
    "mr": "Marathi",
    "bn": "Bengali",
    "gu": "Gujarati",
    "pa": "Punjabi",
}


async def translate_advisory(text: str, target_lang: str) -> str:
    """Translate an advisory message to a regional Indian language."""

    lang_name = LANG_NAMES.get(target_lang, "Hindi")
    system = (
        f"You are a professional translator for Indian government health communications. "
        f"Translate the following air quality health advisory from English to {lang_name}. "
        "Preserve all numbers, AQI values, and technical terms. Use formal register. "
        "Output ONLY the translated text."
    )
    user = f"Translate to {lang_name}:\n\n{text}"

    result = await _call_groq(system, user, max_tokens=500, temperature=0.1)
    if result:
        return result

    return f"[{lang_name} translation requires a valid Groq API key. Original: {text[:200]}...]"


# ─────────────────────────────────────────────────────────────────────────────
# 7. AI COPILOT CHAT
# ─────────────────────────────────────────────────────────────────────────────

COPILOT_SYSTEM_PROMPT = """You are ARIA (Air Quality Reasoning Intelligence Agent), an expert AI copilot for India's Urban Air Quality Intelligence Platform. You assist CPCB officers, municipal commissioners, and environmental policymakers.

Your expertise covers:
- AQI interpretation and forecasting (CAAQMS, satellite, weather data)
- Pollution source attribution (vehicular, industrial, construction, biomass burning)
- Enforcement actions under GRAP (Graded Response Action Plan), CPCB norms, and NGT orders
- Health impact assessment for vulnerable populations
- Digital twin simulations and what-if policy analysis
- Environmental regulations in India (Air Act 1981, Environment Protection Act 1986)

CONTEXT: You are embedded in an AI platform monitoring Indian cities (Delhi, Mumbai, Bengaluru, Chennai, Kolkata, Hyderabad, Ahmedabad, Pune).

Guidelines:
- Be concise and direct — officers need quick, actionable answers
- Always cite data sources when available
- When asked about regulations, cite specific CPCB/GRAP provisions
- If asked something outside air quality domain, politely redirect
- Use Indian English spelling conventions
- Format numbers with Indian comma notation where applicable"""


async def chat_with_copilot(
    messages: list,
    city: str = "bengaluru",
    current_aqi: Optional[float] = None,
    context: Optional[dict] = None,
) -> str:
    """AI Copilot conversational interface for government officers."""

    client = _get_client()

    # Build enhanced system prompt with live context
    system = COPILOT_SYSTEM_PROMPT
    if current_aqi or context:
        system += f"\n\nCURRENT PLATFORM CONTEXT:\n"
        if city:
            system += f"- Active city: {city.title()}\n"
        if current_aqi:
            system += f"- City-wide average AQI: {round(current_aqi)}\n"
        if context:
            for k, v in context.items():
                system += f"- {k}: {v}\n"

    if client is None:
        # Demo mode — smart template responses
        last_msg = messages[-1].get("content", "").lower() if messages else ""
        return _copilot_demo_response(last_msg, city, current_aqi)

    try:
        import asyncio
        formatted = [{"role": m["role"], "content": m["content"]} for m in messages[-10:]]
        response = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model=settings.GROQ_MODEL_NAME,
                messages=[{"role": "system", "content": system}] + formatted,
                max_tokens=600,
                temperature=0.5,
            )
        )
        return response.choices[0].message.content.strip()
    except Exception as exc:
        logger.warning("Copilot API error: %s", exc)
        last_msg = messages[-1].get("content", "").lower() if messages else ""
        return _copilot_demo_response(last_msg, city, current_aqi)


def _copilot_demo_response(query: str, city: str, aqi: Optional[float]) -> str:
    """Smart template-based demo responses when Groq key is not configured."""
    aqi_val = round(aqi) if aqi else 156
    city_title = city.title()

    if any(w in query for w in ["aqi", "air quality", "pollution level", "current"]):
        return (
            f"The current city-wide average AQI in {city_title} is **{aqi_val}**, "
            f"which falls in the **{'Poor' if aqi_val < 200 else 'Very Poor' if aqi_val < 300 else 'Severe'}** "
            "category according to CPCB National AQI standards. "
            "PM2.5 is the dominant pollutant, primarily driven by vehicular emissions and construction dust. "
            "I recommend activating GRAP Stage II measures immediately."
        )
    elif any(w in query for w in ["enforce", "action", "inspector", "deploy"]):
        return (
            f"For the current AQI level of {aqi_val} in {city_title}, here are the recommended enforcement actions:\n\n"
            "1. **Deploy inspection teams** to the top 5 hotspot grids identified by the Source Attribution Agent.\n"
            "2. **Issue Stop-Work notices** to construction sites within 2 km of schools/hospitals.\n"
            "3. **Enforce heavy vehicle ban** on ring roads from 06:00–22:00 under GRAP Stage II.\n"
            "4. **Water sprinkling** on arterial roads every 4 hours in high-traffic zones.\n"
            "5. **Report** non-compliant industrial units to CPCB regional office for Notice of Non-Compliance."
        )
    elif any(w in query for w in ["health", "hospital", "safe", "risk", "children", "asthma"]):
        return (
            f"At AQI {aqi_val} in {city_title}, the following health advisories apply:\n\n"
            "- **Children & infants**: Suspend all outdoor activities. Keep windows closed.\n"
            "- **Asthma/COPD patients**: Stay indoors, keep rescue inhaler accessible, use air purifier.\n"
            "- **Outdoor workers**: Mandatory N95 respirator. Restrict heavy exertion.\n"
            "- **General public**: Limit outdoor time, especially 7–10 AM and 6–9 PM (peak pollution hours).\n\n"
            "Activate the city health alert system and coordinate with district hospitals to increase "
            "respiratory care capacity."
        )
    elif any(w in query for w in ["source", "cause", "why", "reason", "factor"]):
        return (
            f"Based on the AI source attribution analysis for {city_title}:\n\n"
            "- **Vehicular emissions**: 38% — Peak traffic correlates with PM2.5 spikes on monitoring data.\n"
            "- **Construction dust**: 26% — 47 active building permits in high-AQI zones.\n"
            "- **Industrial emissions**: 21% — Sentinel-5P NO₂ shows elevated column density near industrial clusters.\n"
            "- **Other (biomass, background)**: 15%\n\n"
            "The Traffic Density and Construction Dust combination accounts for nearly 65% of the AQI — "
            "these should be the primary enforcement targets."
        )
    elif any(w in query for w in ["grap", "regulation", "rule", "law", "norm", "cpcb"]):
        return (
            "Under India's **Graded Response Action Plan (GRAP)**:\n\n"
            "- **Stage I** (AQI 201–300): Mechanical sweeping, ban on open burning, "
            "parking fee increase.\n"
            "- **Stage II** (AQI 301–400): Ban on coal/firewood in tandoors, diesel generator ban, "
            "hot-mix/stone crusher closure.\n"
            "- **Stage III** (AQI 401–450): Ban on BS III/IV petrol, BS IV diesel four-wheelers in Delhi.\n"
            "- **Stage IV** (AQI >450): School closure, construction ban, odd-even restrictions.\n\n"
            f"At current AQI of {aqi_val}, GRAP Stage **{'I' if aqi_val < 300 else 'II' if aqi_val < 400 else 'III'}** "
            "provisions are applicable."
        )
    elif any(w in query for w in ["simulate", "simulation", "what if", "scenario", "twin"]):
        return (
            "The **Digital Twin Simulator** lets you test policy interventions before implementing them. "
            "Available scenarios include:\n\n"
            "- 🚫 Heavy Vehicle Ban — projects 15-22% AQI reduction\n"
            "- 🚗 Odd-Even Policy — projects 8-14% reduction\n"
            "- 🏗️ Construction Halt — projects 10-18% reduction\n"
            "- 💧 Road Water Sprinkling — projects 5-10% reduction\n"
            "- 🌧️ Rainfall Simulation — projects 25-40% reduction\n\n"
            "Navigate to the **Digital Twin** page to run a simulation. "
            "You can compare multiple scenario bundles side-by-side."
        )
    elif any(w in query for w in ["hello", "hi", "help", "what can", "who are"]):
        return (
            f"Hello! I'm **ARIA** — your Air Quality Reasoning Intelligence Agent 🌿\n\n"
            f"I'm currently monitoring **{city_title}** (AQI: {aqi_val}).\n\n"
            "I can help you with:\n"
            "- 📊 **AQI Analysis** — interpret current and forecast data\n"
            "- 🏭 **Source Attribution** — identify pollution causes\n"
            "- ⚖️ **Enforcement Guidance** — GRAP/CPCB action recommendations\n"
            "- 🏥 **Health Advisories** — citizen and vulnerable group alerts\n"
            "- 🔬 **Simulation Insights** — explain digital twin results\n"
            "- 📋 **Regulatory Reference** — CPCB norms, NGT orders\n\n"
            "What would you like to know?"
        )
    else:
        return (
            f"I'm monitoring **{city_title}** with a current AQI of **{aqi_val}**. "
            "Could you be more specific about what you'd like to know? I can help with "
            "AQI analysis, enforcement recommendations, health advisories, source attribution, "
            "or regulatory guidance. "
            "\n\n💡 *Tip: Add your Groq API key to `.env` to enable full AI-powered responses.*"
        )


# ─────────────────────────────────────────────────────────────────────────────
# 8. REPORT GENERATION
# ─────────────────────────────────────────────────────────────────────────────

async def generate_compliance_report(
    city: str,
    period: str,
    avg_aqi: float,
    violations: list,
    actions_taken: list,
    recommendations: list,
) -> str:
    """Generate formal compliance report for regulatory submission."""

    system = (
        "You are an environmental compliance reporting AI for Indian regulatory authorities. "
        "Generate formal compliance reports suitable for submission to CPCB, State PCBs, "
        "or the National Green Tribunal (NGT). Use official language, include section headings, "
        "and maintain regulatory compliance tone. Structure: Executive Summary, Observations, "
        "Non-Compliance Incidents, Actions Taken, Recommendations."
    )
    user = (
        f"City: {city.title()}, Reporting Period: {period}\n"
        f"Average AQI: {round(avg_aqi)}\n"
        f"Violations detected: {'; '.join(violations[:5])}\n"
        f"Actions taken: {'; '.join(actions_taken[:5])}\n"
        f"Recommendations: {'; '.join(recommendations[:3])}\n\n"
        "Generate a formal air quality compliance report."
    )

    result = await _call_groq(system, user, max_tokens=700, temperature=0.2)
    if result:
        return result

    return (
        f"AIR QUALITY COMPLIANCE REPORT — {city.title().upper()}\n"
        f"Period: {period}\n"
        "============================================================\n\n"
        f"EXECUTIVE SUMMARY\nAverage AQI recorded: {round(avg_aqi)} (Category: "
        f"{'Poor' if avg_aqi < 200 else 'Very Poor'})\n\n"
        f"OBSERVATIONS\n{chr(10).join(f'• {v}' for v in violations[:5])}\n\n"
        f"ACTIONS TAKEN\n{chr(10).join(f'• {a}' for a in actions_taken[:5])}\n\n"
        f"RECOMMENDATIONS\n{chr(10).join(f'• {r}' for r in recommendations[:3])}"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Service Status
# ─────────────────────────────────────────────────────────────────────────────

def get_service_status() -> dict:
    """Returns Groq service availability status."""
    available = _is_available()
    return {
        "groq_enabled": available,
        "model": settings.GROQ_MODEL_NAME if available else "template-fallback",
        "mode": "live-ai" if available else "demo-fallback",
        "note": (
            "Groq AI active — all responses are LLM-generated." if available
            else "Demo mode: Set GROQ_API_KEY in .env to enable live AI responses."
        )
    }
