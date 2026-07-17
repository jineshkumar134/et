import argparse
import numpy as np
import pandas as pd
from pathlib import Path
from config.settings import settings
from ml.data_ingestion.caaqms_loader import CAAQMSLoader
from ml.data_ingestion.weather_loader import WeatherLoader
from ml.data_ingestion.satellite_loader import SatelliteLoader
from ml.data_ingestion.traffic_loader import TrafficLoader
from ml.data_ingestion.spatial_loader import SpatialLoader
from ml.preprocessing.cleaner import DataCleaner
from ml.preprocessing.imputer import DataImputer
from ml.feature_engineering.temporal import TemporalEncoder
from ml.feature_engineering.spatial import SpatialEncoder
from ml.feature_engineering.fusion import FeatureFuser
from ml.training.trainer import Trainer
from ml.training.evaluator import compute_metrics, compute_persistence_baseline
from ml.utils.grid_utils import build_adjacency_matrix
from config.constants import ALL_FEATURES
import json

class AQIPipeline:
    def __init__(self):
        self.settings = settings
        self.data_dir = Path("datasets")
        self.models_dir = Path("models")
        self.models_dir.mkdir(parents=True, exist_ok=True)
        
        # Loaders
        self.caaqms_loader = CAAQMSLoader()
        self.weather_loader = WeatherLoader()
        self.satellite_loader = SatelliteLoader()
        self.traffic_loader = TrafficLoader()
        self.spatial_loader = SpatialLoader()
        
        # Stages
        self.cleaner = DataCleaner()
        self.imputer = DataImputer()
        self.temporal_enc = TemporalEncoder()
        self.spatial_enc = SpatialEncoder()
        self.fuser = FeatureFuser()

    def ingest(self) -> tuple:
        """Data Ingestion Stage."""
        caaqms = self.caaqms_loader.load(self.data_dir / 'caaqms.csv')
        weather = self.weather_loader.load(self.data_dir / 'weather.csv')
        satellite = self.satellite_loader.load(self.data_dir / 'satellite.csv')
        traffic = self.traffic_loader.load(self.data_dir / 'traffic.csv')
        spatial = self.spatial_loader.load(self.data_dir / 'spatial.csv')
        return caaqms, weather, satellite, traffic, spatial

    def preprocess(self, caaqms, weather, satellite, traffic) -> tuple:
        """Cleaning + Imputation Stages."""
        caaqms = self.imputer.impute(self.cleaner.clean(caaqms))
        weather = self.imputer.impute(self.cleaner.clean(weather))
        satellite = self.imputer.impute(satellite)
        traffic = self.imputer.impute(traffic)
        return caaqms, weather, satellite, traffic

    def engineer_features(self, caaqms, weather, satellite, traffic, spatial) -> pd.DataFrame:
        """Temporal + Spatial Encodings + Multi-modal Feature Fusion Stages."""
        caaqms = self.temporal_enc.transform(caaqms)
        fused = self.fuser.fuse(caaqms, weather, satellite, traffic, spatial)
        
        # Spatial lag calculation
        num_grids = settings.GRID_ROWS * settings.GRID_COLS
        # Create mock settings class with appropriate bounds
        class SettingsWrapper:
            GRID_ROWS = settings.GRID_ROWS
            GRID_COLS = settings.GRID_COLS
        adj = build_adjacency_matrix(num_grids, SettingsWrapper())
        fused = self.spatial_enc.transform(fused, adj)
        return fused

    def prepare_targets(self, fused_df: pd.DataFrame) -> pd.DataFrame:
        """Creates future forecast targets (24h, 48h, 72h ahead) by temporal shifts."""
        fused_df = fused_df.copy().sort_values(by=['timestamp', 'grid_id'])
        for h in [24, 48, 72]:
            fused_df[f'aqi_{h}h'] = fused_df.groupby('grid_id')['aqi'].shift(-h)
        # Drop rows where we don't have future labels (last 72 hours of data)
        return fused_df.dropna(subset=['aqi_24h', 'aqi_48h', 'aqi_72h'])

    def split_data(self, df: pd.DataFrame) -> tuple:
        """Split data chronologically into Train (70%), Val (15%), Test (15%)."""
        df = df.sort_values('timestamp')
        n = len(df)
        train_end = int(n * 0.7)
        val_end = int(n * 0.85)
        
        train = df.iloc[:train_end]
        val = df.iloc[train_end:val_end]
        test = df.iloc[val_end:]
        return train, val, test

    def get_features_targets(self, df: pd.DataFrame) -> tuple:
        # Filter available features
        feature_cols = [col for col in ALL_FEATURES if col in df.columns]
        X = df[feature_cols].fillna(0.0).values
        y = df[['aqi_24h', 'aqi_48h', 'aqi_72h']].fillna(0.0).values
        return X, y

    def train(self, model_name: str = 'xgboost'):
        """Main orchestrator to train models."""
        print(f"Ingesting data...")
        caaqms, weather, satellite, traffic, spatial = self.ingest()
        
        print("Preprocessing...")
        caaqms, weather, satellite, traffic = self.preprocess(caaqms, weather, satellite, traffic)
        
        print("Engineering features...")
        fused = self.engineer_features(caaqms, weather, satellite, traffic, spatial)
        fused = self.prepare_targets(fused)
        
        train_df, val_df, test_df = self.split_data(fused)
        X_train, y_train = self.get_features_targets(train_df)
        X_val, y_val = self.get_features_targets(val_df)
        X_test, y_test = self.get_features_targets(test_df)
        
        # Normalization
        X_train_s, X_val_s, X_test_s = self.fuser.scale_splits(X_train, X_val, X_test)
        
        # Instantiate Model
        if model_name == 'xgboost':
            from ml.models.xgboost_model import XGBoostAQIModel
            model = XGBoostAQIModel()
        elif model_name == 'lightgbm':
            from ml.models.lightgbm_model import LightGBMAQIModel
            model = LightGBMAQIModel()
        elif model_name == 'lstm':
            from ml.models.lstm_model import LSTMAQIModel
            model = LSTMAQIModel()
        else:
            raise ValueError(f"Unknown model target: {model_name}")
            
        trainer = Trainer(model, self.models_dir)
        print(f"Training model {model_name}...")
        
        if model_name in ['xgboost', 'lightgbm']:
            trainer.train_sklearn_model(X_train_s, y_train, X_val_s, y_val)
        else:
            from ml.training.dataset import create_dataloaders
            train_loader, val_loader, _ = create_dataloaders(X_train_s, y_train)
            trainer.train_deep_model(train_loader, val_loader, epochs=5)
            
        # Save model weights/state
        model_save_path = self.models_dir / model_name
        model.save(model_save_path)
        
        # Evaluate performance
        y_pred = model.predict(X_test_s)
        baseline = compute_persistence_baseline(test_df['aqi'].values)
        metrics = compute_metrics(y_test, y_pred, baseline)
        
        # Save metrics JSON
        with open(self.models_dir / f"{model_name}_metrics.json", "w") as f:
            json.dump(metrics, f, indent=2)
            
        print(f"Finished training. Metrics: {metrics}")
        return metrics

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--mode', choices=['train'], default='train')
    parser.add_argument('--model', default='xgboost')
    args = parser.parse_args()
    
    pipeline = AQIPipeline()
    if args.mode == 'train':
        pipeline.train(args.model)
