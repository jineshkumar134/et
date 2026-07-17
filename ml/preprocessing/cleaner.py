import pandas as pd
import numpy as np

class DataCleaner:
    def __init__(self):
        # Pollutant ranges
        self.pollutant_min_max = {
            'pm25': (0.0, 500.0),
            'pm10': (0.0, 600.0),
            'no2': (0.0, 800.0),
            'so2': (0.0, 2000.0),
            'co': (0.0, 50.0),
            'o3': (0.0, 1000.0),
            'nh3': (0.0, 2400.0)
        }

    def remove_outliers_iqr(self, df: pd.DataFrame, columns: list, factor: float = 1.5) -> pd.DataFrame:
        """Removes outliers from specified columns using Interquartile Range (IQR)."""
        df_clean = df.copy()
        for col in columns:
            if col in df_clean.columns:
                q1 = df_clean[col].quantile(0.25)
                q3 = df_clean[col].quantile(0.75)
                iqr = q3 - q1
                lower_bound = q1 - factor * iqr
                upper_bound = q3 + factor * iqr
                # Clamp rather than drop to preserve time series alignment
                df_clean[col] = df_clean[col].clip(lower_bound, upper_bound)
        return df_clean

    def clip_to_valid_range(self, df: pd.DataFrame) -> pd.DataFrame:
        """Clips pollutant concentrations to physically realistic ranges."""
        df_clipped = df.copy()
        for col, (min_val, max_val) in self.pollutant_min_max.items():
            if col in df_clipped.columns:
                df_clipped[col] = df_clipped[col].clip(min_val, max_val)
        return df_clipped

    def clean(self, df: pd.DataFrame) -> pd.DataFrame:
        """Main cleaning pipeline."""
        df_cleaned = df.copy()
        # Handle negative values
        numeric_cols = df_cleaned.select_dtypes(include=[np.number]).columns
        for col in numeric_cols:
            if col not in ['temperature', 'elevation', 'lat', 'lon']:
                df_cleaned[col] = df_cleaned[col].clip(lower=0.0)
        
        # Clip pollutants to valid bounds
        df_cleaned = self.clip_to_valid_range(df_cleaned)
        return df_cleaned
