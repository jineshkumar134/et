import pandas as pd
from pathlib import Path

class CAAQMSLoader:
    def __init__(self):
        self.required_columns = ['timestamp', 'station_id', 'grid_id', 'pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3', 'aqi']

    def load(self, filepath: Path) -> pd.DataFrame:
        """Loads CAAQMS data from CSV."""
        if not filepath.exists():
            raise FileNotFoundError(f"CAAQMS data not found at {filepath}")
        df = pd.read_csv(filepath)
        self.validate(df)
        return self.normalize(df)

    def validate(self, df: pd.DataFrame) -> None:
        """Validates columns presence."""
        missing = [col for col in self.required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"CAAQMS missing columns: {missing}")

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensures timestamp is datetime and numeric columns are floats."""
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        num_cols = ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3', 'aqi']
        for col in num_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        return df
