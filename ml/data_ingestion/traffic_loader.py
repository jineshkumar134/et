import pandas as pd
from pathlib import Path

class TrafficLoader:
    def __init__(self):
        self.required_columns = ['timestamp', 'grid_id', 'vehicle_density', 'avg_speed', 'congestion_index', 'heavy_vehicle_pct']

    def load(self, filepath: Path) -> pd.DataFrame:
        """Loads traffic telemetry from CSV."""
        if not filepath.exists():
            raise FileNotFoundError(f"Traffic data not found at {filepath}")
        df = pd.read_csv(filepath)
        self.validate(df)
        return self.normalize(df)

    def validate(self, df: pd.DataFrame) -> None:
        """Validates columns presence."""
        missing = [col for col in self.required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Traffic missing columns: {missing}")

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensures timestamp is datetime and numeric columns are floats."""
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        num_cols = ['vehicle_density', 'avg_speed', 'congestion_index', 'heavy_vehicle_pct']
        for col in num_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        return df
