import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { ModelMetric } from '../../types';

interface ModelComparisonChartProps {
  metrics: ModelMetric[];
}

export const ModelComparisonChart: React.FC<ModelComparisonChartProps> = ({ metrics }) => {
  // Aggregate metrics by horizon
  const horizons = ['24h', '48h', '72h'];
  const chartData = horizons.map((h) => {
    const item: Record<string, any> = { name: `+${h} Horizon` };
    
    // Find matching model metrics for this horizon
    metrics.forEach((m) => {
      if (m.horizon === h) {
        item[m.model_name.toUpperCase()] = Math.round(m.rmse * 10) / 10;
        item['Baseline'] = Math.round(m.persistence_rmse * 10) / 10;
      }
    });
    
    return item;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
          <YAxis stroke="#64748b" fontSize={11} label={{ value: 'RMSE (lower is better)', angle: -90, position: 'insideLeft', offset: 10, fill: '#64748b' }} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          <Bar dataKey="Baseline" fill="#64748b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="XGBOOST" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          <Bar dataKey="LIGHTGBM" fill="#06b6d4" radius={[4, 4, 0, 0]} />
          <Bar dataKey="LSTM" fill="#3b82f6" radius={[4, 4, 0, 0]} />
          <Bar dataKey="ENSEMBLE" fill="#10b981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
export default ModelComparisonChart;
