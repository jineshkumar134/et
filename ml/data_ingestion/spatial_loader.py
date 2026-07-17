import pandas as pd
from pathlib import Path

class SpatialLoader:
    def __init__(self):
        self.required_columns = ['grid_id', 'lat', 'lon', 'road_density', 'industrial_area_pct', 'green_cover_pct', 'elevation', 'construction_zone_pct', 'residential_pct']

    def load(self, filepath: Path) -> pd.DataFrame:
        """Loads static spatial data from CSV."""
        if not filepath.exists():
            raise FileNotFoundError(f"Spatial static data not found at {filepath}")
        df = pd.read_csv(filepath)
        self.validate(df)
        return self.normalize(df)

    def validate(self, df: pd.DataFrame) -> None:
        """Validates columns presence."""
        missing = [col for col in self.required_columns if col not in df.columns]
        if missing:
            raise ValueError(f"Spatial missing columns: {missing}")

    def normalize(self, df: pd.DataFrame) -> pd.DataFrame:
        """Ensures numeric columns are floats."""
        num_cols = ['lat', 'lon', 'road_density', 'industrial_area_pct', 'green_cover_pct', 'elevation', 'construction_zone_pct', 'residential_pct']
        for col in num_cols:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        return df
