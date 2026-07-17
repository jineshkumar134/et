import pandas as pd
import numpy as np

class SpatialEncoder:
    def __init__(self):
        pass

    def add_spatial_lags(self, df: pd.DataFrame, feature_cols: list, adjacency_matrix) -> pd.DataFrame:
        """Computes spatial lags (weighted mean of neighbors) for selected features."""
        # For simplicity, if we have flat adjacency, we can average the neighbor values.
        # df should be sorted by timestamp and then grid_id so the row order is consistent.
        df_out = df.copy()
        if 'grid_id' not in df_out.columns:
            return df_out
        
        # Sort to ensure consistent order
        df_out = df_out.sort_values(by=['timestamp', 'grid_id'])
        
        # Simple fallback for neighborhood averages if sparse matrix calculation is not active:
        # We can group by timestamp and compute spatial average.
        # But we will do a proper sparse matrix multiplier if we have an adjacency matrix.
        if adjacency_matrix is not None:
            # Let's perform step-by-step lag multiplication for each timestamp
            timestamps = df_out['timestamp'].unique()
            num_grids = adjacency_matrix.shape[0]
            
            for col in feature_cols:
                if col in df_out.columns:
                    lag_col = f'{col}_spatial_lag'
                    df_out[lag_col] = 0.0
                    
                    # Convert to dense matrix multiply for speed
                    adj_dense = adjacency_matrix.toarray() if hasattr(adjacency_matrix, 'toarray') else adjacency_matrix
                    row_sums = adj_dense.sum(axis=1, keepdims=True)
                    # Avoid division by zero
                    row_sums = np.where(row_sums == 0, 1.0, row_sums)
                    adj_normalized = adj_dense / row_sums
                    
                    for ts in timestamps:
                        mask = df_out['timestamp'] == ts
                        if mask.sum() == num_grids:
                            vals = df_out.loc[mask, col].values
                            # Multiply adj_normalized with vals
                            lag_vals = adj_normalized.dot(vals)
                            df_out.loc[mask, lag_col] = lag_vals
        return df_out

    def interpolate_station_to_grid(self, station_df: pd.DataFrame, grid_df: pd.DataFrame) -> pd.DataFrame:
        """Inverse Distance Weighting (IDW) interpolation from stations to grids."""
        # For our demo, the synthetic generator already generates grid-level features directly.
        # If we have real stations, we find distance to each station and apply IDW.
        return grid_df

    def transform(self, df: pd.DataFrame, adjacency_matrix) -> pd.DataFrame:
        """Runs spatial lag engineering on active features."""
        # Apply spatial lag on PM2.5, PM10, and AQI
        lag_features = ['pm25', 'pm10', 'aqi']
        active_features = [f for f in lag_features if f in df.columns]
        return self.add_spatial_lags(df, active_features, adjacency_matrix)
