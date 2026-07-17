import numpy as np
import lightgbm as lgb
from pathlib import Path
from .base_model import BaseAQIModel
import joblib

class LightGBMAQIModel(BaseAQIModel):
    def __init__(self, config: dict = None):
        default_config = {
            'n_estimators': 300,
            'max_depth': 6,
            'learning_rate': 0.05,
            'num_leaves': 31,
            'subsample': 0.8,
            'random_state': 42,
            'verbosity': -1
        }
        if config:
            default_config.update(config)
        super().__init__("lightgbm", default_config)
        
        # 3 regressors for [24h, 48h, 72h] forecasts
        self.models = [
            lgb.LGBMRegressor(**self.config),
            lgb.LGBMRegressor(**self.config),
            lgb.LGBMRegressor(**self.config)
        ]

    def fit(self, X_train, y_train, X_val=None, y_val=None):
        """Fits three separate LightGBM regressors for each forecast horizon."""
        for i in range(3):
            y_tr = y_train[:, i]
            y_v = y_val[:, i] if y_val is not None else None
            
            if y_v is not None:
                self.models[i].fit(
                    X_train, y_tr,
                    eval_set=[(X_val, y_v)]
                )
            else:
                self.models[i].fit(X_train, y_tr)
                
        self.is_fitted = True
        importances = [model.feature_importances_ for model in self.models]
        self.feature_importance = np.mean(importances, axis=0)

    def predict(self, X) -> np.ndarray:
        """Predicts AQI for 24h, 48h, and 72h horizons."""
        preds = []
        for i in range(3):
            preds.append(self.models[i].predict(X))
        return np.column_stack(preds)

    def save(self, path: Path):
        """Saves models to disk."""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        for i in range(3):
            joblib.dump(self.models[i], path / f"lightgbm_h{i}.joblib")

    def load(self, path: Path):
        """Loads models from disk."""
        path = Path(path)
        for i in range(3):
            self.models[i] = joblib.load(path / f"lightgbm_h{i}.joblib")
        self.is_fitted = True
