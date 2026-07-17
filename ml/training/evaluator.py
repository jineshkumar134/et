import numpy as np
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

def compute_metrics(y_true: np.ndarray, y_pred: np.ndarray, y_baseline: np.ndarray = None) -> dict:
    """Computes RMSE, MAE, R² metrics for each horizon [24h, 48h, 72h]."""
    metrics = {}
    if y_true.ndim == 1:
        y_true = y_true.reshape(-1, 1)
        y_pred = y_pred.reshape(-1, 1)
        
    horizons = ['24h', '48h', '72h']
    for i, h in enumerate(horizons[:y_true.shape[1]]):
        yt = y_true[:, i]
        yp = y_pred[:, i]
        
        # Guard against NaNs or empty lists
        if len(yt) == 0:
            metrics[h] = {'rmse': 0.0, 'mae': 0.0, 'r2': 0.0}
            continue
            
        rmse = np.sqrt(mean_squared_error(yt, yp))
        mae = mean_absolute_error(yt, yp)
        r2 = r2_score(yt, yp)
        
        metrics[h] = {
            'rmse': float(rmse),
            'mae': float(mae),
            'r2': float(r2)
        }
        
        if y_baseline is not None:
            yb = y_baseline[:, i] if y_baseline.ndim > 1 else y_baseline
            rmse_base = np.sqrt(mean_squared_error(yt, yb[:len(yt)]))
            metrics[h]['persistence_rmse'] = float(rmse_base)
            metrics[h]['improvement_pct'] = float((rmse_base - rmse) / (rmse_base + 1e-9) * 100)
            
    return metrics


def compute_persistence_baseline(aqi_series: np.ndarray, horizons: list = [24, 48, 72]) -> np.ndarray:
    """
    Persistence baseline: projects current AQI value forward.
    Returns baseline predictions of shape (N, 3).
    """
    baselines = []
    n = len(aqi_series)
    for h in horizons:
        # Shift the series by h steps. For missing history, fill with the first value.
        shifted = np.roll(aqi_series, h)
        if n > 0:
            shifted[:h] = aqi_series[0]
        baselines.append(shifted)
    return np.column_stack(baselines)
