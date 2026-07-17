import pandas as pd
import numpy as np

class DataImputer:
    def __init__(self):
        pass

    def temporal_interpolate(self, df: pd.DataFrame, columns: list, limit: int = 3) -> pd.DataFrame:
        """Fills missing values in time-series using linear interpolation per grid_id or station_id."""
        df_imputed = df.copy()
        group_col = 'grid_id' if 'grid_id' in df.columns else 'station_id'
        
        if group_col in df.columns:
            # Interpolate within each group to avoid cross-grid leakage
            df_imputed[columns] = df_imputed.groupby(group_col)[columns].transform(
                lambda x: x.interpolate(method='linear', limit=limit, limit_direction='both')
            )
        else:
            df_imputed[columns] = df_imputed[columns].interpolate(method='linear', limit=limit, limit_direction='both')
        return df_imputed

    def fill_remaining(self, df: pd.DataFrame, columns: list, strategy: str = 'median') -> pd.DataFrame:
        """Fallback to fill remaining missing values with median or mean."""
        df_filled = df.copy()
        for col in columns:
            if col in df_filled.columns:
                if strategy == 'median':
                    fill_val = df_filled[col].median()
                else:
                    fill_val = df_filled[col].mean()
                if pd.isna(fill_val):
                    fill_val = 0.0
                df_filled[col] = df_filled[col].fillna(fill_val)
        return df_filled

    def impute(self, df: pd.DataFrame) -> pd.DataFrame:
        """Main imputation pipeline."""
        df_imputed = df.copy()
        # Find numeric columns
        num_cols = df_imputed.select_dtypes(include=[np.number]).columns.tolist()
        # Exclude key identifier columns
        exclude_cols = ['grid_id', 'row', 'col', 'lat', 'lon']
        cols_to_impute = [col for col in num_cols if col not in exclude_cols]
        
        # 1. Temporal Interpolation
        df_imputed = self.temporal_interpolate(df_imputed, cols_to_impute, limit=6)
        
        # 2. Final global median fill
        df_imputed = self.fill_remaining(df_imputed, cols_to_impute, strategy='median')
        return df_imputed
