import pandas as pd
import numpy as np
from sklearn.preprocessing import StandardScaler
import joblib
from pathlib import Path

class FeatureFuser:
    def __init__(self):
        self.scaler = StandardScaler()
        self.scaler_path = Path("models/scaler.joblib")

    def fuse(self, caaqms_df: pd.DataFrame, weather_df: pd.DataFrame, satellite_df: pd.DataFrame, traffic_df: pd.DataFrame, spatial_df: pd.DataFrame) -> pd.DataFrame:
        """Fuses all 5 multi-modal data streams on timestamp and grid_id."""
        # 1. Start with CAAQMS
        df = caaqms_df.copy()
        
        # 2. Join Weather
        if weather_df is not None and not weather_df.empty:
            df = pd.merge(df, weather_df, on=['timestamp', 'grid_id'], how='left')
            
        # 3. Join Satellite
        if satellite_df is not None and not satellite_df.empty:
            # Satellite daily pass might need forward fill or matching by date
            # Ensure satellite timestamp matches or we round to nearest date/hour
            satellite_df = satellite_df.copy()
            satellite_df['date'] = pd.to_datetime(satellite_df['timestamp']).dt.date
            df['date'] = pd.to_datetime(df['timestamp']).dt.date
            # Merge on date and grid_id, keeping the satellite columns
            sat_cols = ['date', 'grid_id', 'aod', 'sat_no2', 'sat_so2', 'sat_co', 'cloud_cover']
            df = pd.merge(df, satellite_df[sat_cols], on=['date', 'grid_id'], how='left')
            df = df.drop(columns=['date'])
            
        # 4. Join Traffic
        if traffic_df is not None and not traffic_df.empty:
            df = pd.merge(df, traffic_df, on=['timestamp', 'grid_id'], how='left')
            
        # 5. Join Static Spatial features
        if spatial_df is not None and not spatial_df.empty:
            # Drop lat/lon if they are duplicate
            sp_cols = [c for c in spatial_df.columns if c not in ['lat', 'lon'] or c in ['grid_id']]
            df = pd.merge(df, spatial_df[sp_cols], on='grid_id', how='left')
            
        return df

    def scale_splits(self, X_train: np.ndarray, X_val: np.ndarray, X_test: np.ndarray) -> tuple:
        """Fits scaler on training data and transforms all splits."""
        self.scaler_path.parent.mkdir(parents=True, exist_ok=True)
        
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_val_scaled = self.scaler.transform(X_val)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Save scaler
        joblib.dump(self.scaler, self.scaler_path)
        return X_train_scaled, X_val_scaled, X_test_scaled

    def scale_single(self, X: np.ndarray) -> np.ndarray:
        """Transforms a single feature matrix using saved scaler."""
        if not hasattr(self.scaler, 'mean_'):
            if self.scaler_path.exists():
                self.scaler = joblib.load(self.scaler_path)
            else:
                # If no scaler exists, fit on this batch as fallback
                return self.scaler.fit_transform(X)
        return self.scaler.transform(X)
