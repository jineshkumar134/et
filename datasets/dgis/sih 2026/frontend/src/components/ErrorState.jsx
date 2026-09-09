// src/components/ErrorState.jsx
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <AlertTriangle className="h-10 w-10 text-red-400" />
      <p className="text-sm text-red-400 text-center max-w-sm">{message || 'Something went wrong'}</p>
    </div>
  );
}
