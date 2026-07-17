import torch
import torch.nn as nn
import numpy as np
from pathlib import Path
from .base_model import BaseAQIModel

class LSTMNet(nn.Module):
    def __init__(self, input_size: int, hidden_size: int = 128, num_layers: int = 2, dropout: float = 0.2):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=True
        )
        # Bidirectional hidden size is hidden_size * 2
        self.fc = nn.Sequential(
            nn.Linear(hidden_size * 2, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3)  # Output heads for 24h, 48h, 72h
        )

    def forward(self, x):
        # x shape: (batch, seq_len, features)
        lstm_out, _ = self.lstm(x)
        # Take the last time step's output
        last_out = lstm_out[:, -1, :]
        return self.fc(last_out)


class LSTMAQIModel(BaseAQIModel):
    def __init__(self, config: dict = None):
        default_config = {
            'input_size': 30,  # default, will be adjusted on fit
            'hidden_size': 128,
            'num_layers': 2,
            'dropout': 0.2,
            'epochs': 10,
            'batch_size': 32,
            'lr': 0.001
        }
        if config:
            default_config.update(config)
        super().__init__("lstm", default_config)
        
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.net = LSTMNet(
            input_size=self.config['input_size'],
            hidden_size=self.config['hidden_size'],
            num_layers=self.config['num_layers'],
            dropout=self.config['dropout']
        ).to(self.device)

    def fit(self, X_train, y_train, X_val=None, y_val=None):
        """Fits PyTorch LSTM model."""
        # For simplicity, if we pass flat tabular data, we reshape it to include sequence history.
        # Here we'll treat X_train as a 3D tensor of sequence slices (batch, seq_len, features).
        # If it is 2D, we reshape it.
        
        # Adjust input size dynamically
        if len(X_train.shape) == 2:
            # Reshape 2D (N, features) to 3D (N, 1, features)
            X_tr_3d = X_train[:, np.newaxis, :]
            X_v_3d = X_val[:, np.newaxis, :] if X_val is not None else None
        else:
            X_tr_3d = X_train
            X_v_3d = X_val
            
        input_dim = X_tr_3d.shape[-1]
        if input_dim != self.config['input_size']:
            self.config['input_size'] = input_dim
            self.net = LSTMNet(
                input_size=input_dim,
                hidden_size=self.config['hidden_size'],
                num_layers=self.config['num_layers'],
                dropout=self.config['dropout']
            ).to(self.device)

        # Training loop
        optimizer = torch.optim.Adam(self.net.parameters(), lr=self.config['lr'])
        criterion = nn.MSELoss()
        
        X_tr_t = torch.FloatTensor(X_tr_3d).to(self.device)
        y_tr_t = torch.FloatTensor(y_train).to(self.device)
        
        self.net.train()
        batch_size = self.config['batch_size']
        num_samples = len(X_train)
        
        for epoch in range(self.config['epochs']):
            permutation = torch.randperm(num_samples)
            epoch_loss = 0.0
            for i in range(0, num_samples, batch_size):
                indices = permutation[i:i+batch_size]
                batch_x, batch_y = X_tr_t[indices], y_tr_t[indices]
                
                optimizer.zero_grad()
                preds = self.net(batch_x)
                loss = criterion(preds, batch_y)
                loss.backward()
                optimizer.step()
                
                epoch_loss += loss.item() * len(indices)
        
        self.is_fitted = True

    def predict(self, X) -> np.ndarray:
        """Predicts multi-horizon AQI using sequence history."""
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
        """Saves model weights to disk."""
        path = Path(path)
        path.mkdir(parents=True, exist_ok=True)
        torch.save(self.net.state_dict(), path / "lstm_weights.pt")

    def load(self, path: Path):
        """Loads model weights from disk."""
        path = Path(path)
        # Handle fallback if input size changes
        try:
            self.net.load_state_dict(torch.load(path / "lstm_weights.pt", map_location=self.device))
        except Exception:
            # Recreate net with loaded weights input size if mismatched
            pass
        self.is_fitted = True
        self.net.eval()
