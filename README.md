# Hyperlocal AQI Forecasting Agent

> AI-powered Urban Air Quality Intelligence Platform for Smart Cities, Municipal Corporations, and Pollution Control Boards.

---

## Architecture

```
frontend/          React + Tailwind CSS + Leaflet (OSM)
backend/           FastAPI REST API
ml/                ML Pipeline (XGBoost, LightGBM, LSTM, GRU, STGNN)
datasets/          Raw data CSVs + demo data generator
models/            Trained model artifacts
config/            Global settings and constants
```

## Quick Start

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
```

### 2. Generate demo data
```bash
python datasets/generate_demo_data.py
```

### 3. Start the backend
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. Start the frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## Map Provider

The map provider is controlled by a **single config file**: `frontend/src/config/mapConfig.ts`

To switch from Leaflet (current) to Mapbox GL:
1. Open `frontend/src/config/mapConfig.ts`
2. Change `provider: 'leaflet'` → `provider: 'mapbox'`
3. Set `VITE_MAPBOX_TOKEN` in `frontend/.env`

All map features (heatmaps, grid rectangles, popups, time slider) work identically on both providers.

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | System health check |
| GET | `/current` | Current AQI for all grids |
| GET | `/current/summary` | City-wide AQI summary |
| GET | `/forecast?horizon=24h` | 24h/48h/72h forecast |
| GET | `/grids` | All grid definitions |
| GET | `/grid/{id}` | Detailed grid prediction |
| GET | `/metrics` | Model performance metrics |
| GET | `/metrics/loss` | Training loss curves |

---

## ML Pipeline

### Training a model
```bash
# Train XGBoost (fastest)
python -m ml.pipeline --mode train --model xgboost

# Train LightGBM
python -m ml.pipeline --mode train --model lightgbm

# Train LSTM (requires PyTorch)
python -m ml.pipeline --mode train --model lstm

# Train STGNN (requires PyTorch + PyTorch Geometric)
python -m ml.pipeline --mode train --model stgnn
```

### Model selection
Set `ACTIVE_MODEL` in `config/settings.py` or `.env`:
```
ACTIVE_MODEL=ensemble
```

Options: `xgboost`, `lightgbm`, `lstm`, `gru`, `stgnn`, `ensemble`

---

## Data Sources

| Source | Frequency | Features |
|--------|-----------|---------|
| CAAQMS | Hourly | PM2.5, PM10, NO2, SO2, CO, O3, NH3, AQI |
| Weather | Hourly | Temp, Humidity, Wind, Pressure, Rainfall, Solar Radiation |
| Satellite | Daily | AOD, NO2, SO2, CO, Cloud Cover |
| Traffic | Hourly | Vehicle Density, Speed, Congestion, Heavy Vehicle % |
| Spatial | Static | Road Density, Industrial %, Green Cover, Elevation |

Replace CSVs in `datasets/` with real data to connect live sources.

---

## Grid System

- City: Delhi (28.40°N–28.88°N, 76.84°E–77.35°E)
- Resolution: 1 km × 1 km
- Grid: 20 rows × 20 cols = **400 grids**
- Each grid: Current AQI, 24h/48h/72h forecast, confidence, trend

---

## Performance Targets

| Model | RMSE 24h | vs Persistence |
|-------|----------|----------------|
| Persistence Baseline | 32.1 | — |
| XGBoost | 18.3 | −43% |
| LightGBM | 17.8 | −45% |
| LSTM | 15.2 | −53% |
| **Ensemble** | **13.6** | **−58%** |
