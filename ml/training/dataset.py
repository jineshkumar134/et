import torch
from torch.utils.data import Dataset, DataLoader
import numpy as np

class AQISequenceDataset(Dataset):
    def __init__(self, X: np.ndarray, y: np.ndarray, seq_len: int = 24):
        """
        X: Feature matrix of shape (num_samples, num_features)
        y: Target matrix of shape (num_samples, 3) for [24h, 48h, 72h]
        """
        self.seq_len = seq_len
        self.X_samples = []
        self.y_samples = []
        
        # Prepare sliding window sequences
        for i in range(seq_len, len(X)):
            self.X_samples.append(X[i-seq_len:i])
            self.y_samples.append(y[i])
            
        self.X_samples = np.array(self.X_samples)
        self.y_samples = np.array(self.y_samples)

    def __len__(self):
        return len(self.X_samples)

    def __getitem__(self, idx):
        x_tensor = torch.FloatTensor(self.X_samples[idx])
        y_tensor = torch.FloatTensor(self.y_samples[idx])
        return x_tensor, y_tensor


def create_dataloaders(X: np.ndarray, y: np.ndarray, seq_len: int = 24, batch_size: int = 32, train_ratio: float = 0.8) -> tuple:
    """Splits data and returns Train and Validation DataLoaders."""
    dataset = AQISequenceDataset(X, y, seq_len=seq_len)
    
    n_samples = len(dataset)
    if n_samples == 0:
        # Avoid empty dataset errors for small tests
        dummy_X = np.zeros((batch_size * 2, seq_len, X.shape[-1]))
        dummy_y = np.zeros((batch_size * 2, 3))
        train_ds = torch.utils.data.TensorDataset(torch.FloatTensor(dummy_X), torch.FloatTensor(dummy_y))
        val_ds = torch.utils.data.TensorDataset(torch.FloatTensor(dummy_X), torch.FloatTensor(dummy_y))
        return DataLoader(train_ds, batch_size=batch_size, shuffle=True), DataLoader(val_ds, batch_size=batch_size, shuffle=False), DataLoader(val_ds, batch_size=batch_size, shuffle=False)

    train_size = int(n_samples * train_ratio)
    val_size = n_samples - train_size
    
    train_dataset, val_dataset = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, drop_last=True)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, drop_last=False)
    
    return train_loader, val_loader, val_loader
