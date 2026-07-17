import pandas as pd
from pathlib import Path

class SatelliteLoader:
    def __init__(self):
        self.required_columns = ['timestamp', 'grid_id', 'aod', 'sat_no2', 'sat_so2', 'sat_co', 'cloud_cover']

    def load(self, filepath: Path) -> pd.DataFrame:
        """Loads Sentinel-5P / MODIS satellite data from CSV."""
        if not filepath.exists():
            raise FileNotFoundError(f"Satellite data not found at {filepath}")
        df = pd.read_csv(filepath)
        self.validate(df)
        return self.normalize(df)

    def validate(self, df: pd.DataFrame) -> None:
        """Validates columns presence."""
        missing = [col for col in self.required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Satellite missing columns: {missing}")

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensures timestamp is datetime and numeric columns are floats."""
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        num_cols = ['aod', 'sat_no2', 'sat_so2', 'sat_co', 'cloud_cover']
        for col in num_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        return df
