import numpy as np
from pathlib import Path
from .base_model import BaseAQIModel

class EnsembleModel(BaseAQIModel):
    def __init__(self, models_with_weights: list = None):
        """
        models_with_weights: list of tuples (model_instance, weight)
        """
        super().__init__("ensemble", {})
        self.models_with_weights = models_with_weights or []
        self.is_fitted = True

    def fit(self, X_train, y_train, X_val=None, y_val=None):
        # Ensemble itself does not fit, it assumes submodels are already trained
        pass

    def predict(self, X) -> np.ndarray:
        """Returns weighted average predictions across sub-models."""
        if not self.models_with_weights:
            # Empty fallback
            return np.zeros((X.shape[0], 3))
            
        preds = []
        total_weight = 0.0
        for model, w in self.models_with_weights:
            preds.append(model.predict(X) * w)
            total_weight += w
            
        return sum(preds) / total_weight

    def predict_with_confidence(self, X) -> tuple:
        """Returns predictions mean and standard deviation across sub-models."""
        preds = []
        for model, _ in self.models_with_weights:
            preds.append(model.predict(X))
            
        preds = np.array(preds)  # shape (num_models, batch, 3)
        mean_pred = np.mean(preds, axis=0)
        std_pred = np.std(preds, axis=0)
        return mean_pred, std_pred

    def save(self, path: Path):
        # Saved when underlying submodels are saved
        pass

    def load(self, path: Path):
        # Loaded by load_model in predictor
        pass
