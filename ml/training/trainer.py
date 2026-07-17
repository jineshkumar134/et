import torch
import torch.nn as nn
from torch.optim import Adam
import numpy as np
from pathlib import Path
import json

class Trainer:
    def __init__(self, model, save_dir: Path, device: str = 'cpu'):
        self.model = model
        self.save_dir = Path(save_dir)
        self.device = device
        self.history = {'train_loss': [], 'val_loss': []}

    def train_sklearn_model(self, X_train, y_train, X_val, y_val) -> dict:
        """Trains standard Scikit-Learn based models (XGBoost/LightGBM)."""
        self.model.fit(X_train, y_train, X_val, y_val)
        return self.model.evaluate(X_val, y_val)

    def train_deep_model(self, train_loader, val_loader, epochs: int = 10, lr: float = 0.001) -> dict:
        """Trains PyTorch models (LSTM/GRU/STGNN)."""
        net = self.model.net.to(self.device)
        optimizer = Adam(net.parameters(), lr=lr)
        criterion = nn.MSELoss()
        
        for epoch in range(epochs):
            net.train()
            train_losses = []
            for X_batch, y_batch in train_loader:
                X_batch = X_batch.to(self.device)
                y_batch = y_batch.to(self.device)
                
                optimizer.zero_grad()
                preds = net(X_batch)
                loss = criterion(preds, y_batch)
                loss.backward()
                optimizer.step()
                train_losses.append(loss.item())
                
            net.eval()
            val_losses = []
            with torch.no_grad():
                for X_batch, y_batch in val_loader:
                    X_batch = X_batch.to(self.device)
                    y_batch = y_batch.to(self.device)
                    preds = net(X_batch)
                    loss = criterion(preds, y_batch)
                    val_losses.append(loss.item())
                    
            train_mean = float(np.mean(train_losses))
            val_mean = float(np.mean(val_losses))
            self.history['train_loss'].append(train_mean)
            self.history['val_loss'].append(val_mean)
            
        self.save_history()
        return self.history

    def save_history(self) -> None:
        """Saves loss history curves to JSON."""
        self.save_dir.mkdir(parents=True, exist_ok=True)
        with open(self.save_dir / f"{self.model.name}_history.json", "w") as f:
            json.dump(self.history, f)
