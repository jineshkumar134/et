from abc import ABC, abstractmethod
import numpy as np
from pathlib import Path

class BaseAQIModel(ABC):
    def __init__(self, name: str, config: dict = None):
        self.name = name
        self.config = config or {}
        self.is_fitted = False
        self.feature_importance = None
    
    @abstractmethod
    def fit(self, X_train, y_train, X_val=None, y_val=None):
        pass
    
    @abstractmethod  
    def predict(self, X) -> np.ndarray:
        pass
    
    @abstractmethod
    def save(self, path: Path):
        pass
    
    @abstractmethod
    def load(self, path: Path):
        pass
    
    def evaluate(self, X_test, y_test) -> dict:
        from ml.training.evaluator import compute_metrics
        y_pred = self.predict(X_test)
        return compute_metrics(y_test, y_pred)
