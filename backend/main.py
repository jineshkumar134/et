from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config.settings import settings
from backend.services.prediction_service import PredictionService
from backend.services.grid_service import GridService

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup Initialization
    prediction_service = PredictionService()
    await prediction_service.initialize()
    app.state.prediction_service = prediction_service
    app.state.grid_service = GridService()
    yield
    # Cleanup on shutdown (if any)

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# Enable CORS for the Vite React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
from backend.api.routes import config, dashboard, forecast, grid, metrics, source_attribution, enforcement, health, data_fusion, explainability, digital_twin, copilot
app.include_router(config.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(forecast.router, prefix="/api")
app.include_router(grid.router, prefix="/api")
app.include_router(metrics.router, prefix="/api")
app.include_router(source_attribution.router, prefix="/api")
app.include_router(enforcement.router, prefix="/api")
app.include_router(health.router, prefix="/api")
app.include_router(data_fusion.router, prefix="/api")
app.include_router(explainability.router, prefix="/api")
app.include_router(digital_twin.router, prefix="/api")
app.include_router(copilot.router, prefix="/api")

@app.get('/health')
async def health():
    return {
        'status': 'healthy',
        'city': settings.CITY_NAME,
        'grids': settings.GRID_SIZE,
        'api_version': settings.APP_VERSION
    }
