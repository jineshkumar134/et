import pandas as pd
import numpy as np

class TemporalEncoder:
    def __init__(self):
        pass

    def encode_cyclical(self, df: pd.DataFrame) -> pd.DataFrame:
        """Encodes timestamp columns cyclically."""
        df_encoded = df.copy()
        if 'timestamp' in df_encoded.columns:
            ts = pd.to_datetime(df_encoded['timestamp'])
            
            # Hour sin/cos
            df_encoded['hour_sin'] = np.sin(2 * np.pi * ts.dt.hour / 24.0)
            df_encoded['hour_cos'] = np.cos(2 * np.pi * ts.dt.hour / 24.0)
            
            # Day of week sin/cos (0-6)
            df_encoded['day_sin'] = np.sin(2 * np.pi * ts.dt.dayofweek / 7.0)
            df_encoded['day_cos'] = np.cos(2 * np.pi * ts.dt.dayofweek / 7.0)
            
            # Month sin/cos (1-12)
            df_encoded['month_sin'] = np.sin(2 * np.pi * (ts.dt.month - 1) / 12.0)
            df_encoded['month_cos'] = np.cos(2 * np.pi * (ts.dt.month - 1) / 12.0)
            
            # Weekend flag
            df_encoded['is_weekend'] = (ts.dt.dayofweek >= 5).astype(float)
            
            # Rush hour flag (7-10 AM or 5-8 PM)
            df_encoded['is_rush_hour'] = ((ts.dt.hour >= 7) & (ts.dt.hour <= 10) | (ts.dt.hour >= 17) & (ts.dt.hour <= 20)).astype(float)
            
        return df_encoded

    def add_lag_features(self, df: pd.DataFrame, target: str = 'aqi', lags: list = [1, 3, 6, 12, 24]) -> pd.DataFrame:
        """Adds lag features per grid/station."""
        df_lags = df.copy()
        group_col = 'grid_id' if 'grid_id' in df_lags.columns else 'station_id'
        
        if group_col in df_lags.columns and target in df_lags.columns:
            df_lags = df_lags.sort_values(by=['timestamp', group_col])
            for lag in lags:
                df_lags[f'{target}_lag_{lag}h'] = df_lags.groupby(group_col)[target].shift(lag)
        return df_lags

    def add_rolling_features(self, df: pd.DataFrame, target: str = 'aqi') -> pd.DataFrame:
        """Adds rolling stats (mean, std) for target column."""
        df_roll = df.copy()
        group_col = 'grid_id' if 'grid_id' in df_roll.columns else 'station_id'
        
        if group_col in df_roll.columns and target in df_roll.columns:
            df_roll = df_roll.sort_values(by=['timestamp', group_col])
            # 3h rolling
            df_roll['aqi_roll_mean_3h'] = df_roll.groupby(group_col)[target].transform(lambda x: x.rolling(3, min_periods=1).mean())
            df_roll['aqi_roll_std_3h'] = df_roll.groupby(group_col)[target].transform(lambda x: x.rolling(3, min_periods=1).std().fillna(0.0))
            # 6h rolling
            df_roll['aqi_roll_mean_6h'] = df_roll.groupby(group_col)[target].transform(lambda x: x.rolling(6, min_periods=1).mean())
            # 24h rolling
            df_roll['aqi_roll_mean_24h'] = df_roll.groupby(group_col)[target].transform(lambda x: x.rolling(24, min_periods=1).mean())
        return df_roll

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """Applies all temporal encodings and lag/rolling creations."""
        df_out = self.encode_cyclical(df)
        df_out = self.add_lag_features(df_out)
        df_out = self.add_rolling_features(df_out)
        return df_out
