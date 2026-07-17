import numpy as np
from pathlib import Path
from typing import Dict, List, Tuple
from ml.models.xgboost_model import XGBoostAQIModel
from ml.models.lightgbm_model import LightGBMAQIModel
from ml.models.lstm_model import LSTMAQIModel
from ml.models.ensemble import EnsembleModel
from ml.feature_engineering.fusion import FeatureFuser
from ml.utils.aqi_calculator import get_aqi_category, get_aqi_color
from config.settings import settings
import json

class AQIPredictor:
    def __init__(self, model_dir: Path = None):
        self.model_dir = Path(model_dir) if model_dir else Path(settings.MODEL_DIR)
        self.model = None
        self.fuser = FeatureFuser()
        self.is_loaded = False

    def load_model(self, model_name: str = None) -> None:
        """Loads the active model or ensemble from saved checkpoints."""
        model_name = model_name or settings.DEFAULT_MODEL
        model_path = self.model_dir / model_name
        
        # Load requested model
        self.model = self._load_model_by_name(model_name, model_path)
        self.is_loaded = True

    def _load_model_by_name(self, name: str, path: Path):
        if name == 'xgboost':
            model = XGBoostAQIModel()
            if (path / "xgboost_h0.joblib").exists():
                model.load(path)
            return model
        elif name == 'lightgbm':
            model = LightGBMAQIModel()
            if (path / "lightgbm_h0.joblib").exists():
                model.load(path)
            return model
        elif name == 'lstm':
            model = LSTMAQIModel()
            if (path / "lstm_weights.pt").exists():
                model.load(path)
            return model
        elif name == 'ensemble':
            # Load submodels for weighted average
            xgb_sub = self._load_model_by_name('xgboost', self.model_dir / 'xgboost')
            lgb_sub = self._load_model_by_name('lightgbm', self.model_dir / 'lightgbm')
            lstm_sub = self._load_model_by_name('lstm', self.model_dir / 'lstm')
            
            models = []
            if getattr(xgb_sub, 'is_fitted', False):
                models.append((xgb_sub, 0.3))
            if getattr(lgb_sub, 'is_fitted', False):
                models.append((lgb_sub, 0.3))
            if getattr(lstm_sub, 'is_fitted', False):
                models.append((lstm_sub, 0.4))
                
            if not models:
                # If no trained models exist, create placeholders
                return EnsembleModel([(xgb_sub, 0.3), (lgb_sub, 0.3)])
            return EnsembleModel(models)
            
        raise ValueError(f"Unknown model: {name}")

    def predict_grid(self, feature_vector: np.ndarray) -> dict:
        """Predicts AQI for a single grid given its feature vector."""
        if not self.is_loaded or self.model is None:
            self.load_model()
            
        # Scale features
        X_scaled = self.fuser.scale_single(feature_vector.reshape(1, -1))
        
        if hasattr(self.model, 'predict_with_confidence'):
            mean_pred, std_pred = self.model.predict_with_confidence(X_scaled)
            pred = mean_pred[0]
            # Map standard deviation to confidence (higher std dev = lower confidence)
            std_mean = np.mean(std_pred)
            confidence = float(max(10.0, min(99.0, 100.0 - std_mean * 0.5)))
        else:
            pred = self.model.predict(X_scaled)[0]
            confidence = 85.0
            
        # Format response
        result = {
            'aqi_24h': float(np.clip(pred[0], 0, 500)),
            'aqi_48h': float(np.clip(pred[1], 0, 500)),
            'aqi_72h': float(np.clip(pred[2], 0, 500)),
            'confidence': confidence
        }
        
        # Categories & Colors
        for key in ['aqi_24h', 'aqi_48h', 'aqi_72h']:
            result[f'{key}_category'] = get_aqi_category(result[key])
            result[f'{key}_color'] = get_aqi_color(result[key])
            
        # Trends
        v24, v72 = result['aqi_24h'], result['aqi_72h']
        if v72 - v24 > 15:
            result['trend'] = 'Increasing'
        elif v24 - v72 > 15:
            result['trend'] = 'Decreasing'
        else:
            result['trend'] = 'Stable'
            
        return result
