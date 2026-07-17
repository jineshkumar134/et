import torch
import torch.nn as nn
import numpy as np
from pathlib import Path
from .base_model import BaseAQIModel

class GRUNet(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 128, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.gru = nn.GRU(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=True
        )
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3)  # Output heads for 24h, 48h, 72h
        )

    def forward(self, x):
        gru_out, _ = self.gru(x)
        last_out = gru_out[:, -1, :]
        return self.fc(last_out)


class GRUAQIModel(BaseAQIModel):
    def __init__(self, config: dict = None):
        default_config = {
            'input_size': 30,
            'hidden_size': 128,
            'num_layers': 2,
            'dropout': 0.2,
            'epochs': 10,
            'batch_size': 32,
            'lr': 0.001
        }
        if config:
            default_config.update(config)
        super().__init__("gru", default_config)
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.net = GRUNet(
            input_size=self.config['input_size'],
            hidden_size=self.config['hidden_size'],
            num_layers=self.config['num_layers'],
            dropout=self.config['dropout']
        ).to(self.device)

    def fit(self, X_train, y_train, X_val=None, y_val=None):
        """Fits PyTorch GRU model."""
        if len(X_train.shape) == 2:
            X_tr_3d = X_train[:, np.newaxis, :]
        else:
            X_tr_3d = X_train
            
        input_dim = X_tr_3d.shape[-1]
        if input_dim != self.config['input_size']:
            self.config['input_size'] = input_dim
            self.net = GRUNet(
                input_size=input_dim,
                hidden_size=self.config['hidden_size'],
                num_layers=self.config['num_layers'],
                dropout=self.config['dropout']
            ).to(self.device)

        optimizer = torch.optim.Adam(self.net.parameters(), lr=self.config['lr'])
        criterion = nn.MSELoss()
        
        X_tr_t = torch.FloatTensor(X_tr_3d).to(self.device)
        y_tr_t = torch.FloatTensor(y_train).to(self.device)
        
        self.net.train()
        batch_size = self.config['batch_size']
        num_samples = len(X_train)
        
        for epoch in range(self.config['epochs']):
            permutation = torch.randperm(num_samples)
            for i in range(0, num_samples, batch_size):
                indices = permutation[i:i+batch_size]
                batch_x, batch_y = X_tr_t[indices], y_tr_t[indices]
                
                optimizer.zero_grad()
                preds = self.net(batch_x)
                loss = criterion(preds, batch_y)
                loss.backward()
                optimizer.step()
        
        self.is_fitted = True

    def predict(self, X) -> np.ndarray:
        self.net.eval()
        if len(X.shape) == 2:
            X_3d = X[:, np.newaxis, :]
        else:
            X_3d = X
            
        X_t = torch.FloatTensor(X_3d).to(self.device)
        with torch.no_grad():
            preds = self.net(X_t).cpu().numpy()
        return preds

    def save(self, path: Path):
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        torch.save(self.net.state_dict(), path / "gru_weights.pt")

    def load(self, path: Path):
        path = Path(path)
        try:
            self.net.load_state_dict(torch.load(path / "gru_weights.pt", map_location=self.device))
        except Exception:
            pass
        self.is_fitted = True
        self.net.eval()
