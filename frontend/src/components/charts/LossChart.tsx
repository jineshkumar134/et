import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface LossChartProps {
  trainLoss: number[];
  valLoss: number[];
}

export const LossChart: React.FC<LossChartProps> = ({ trainLoss, valLoss }) => {
  const chartData = trainLoss.map((tl, index) => ({
    epoch: index + 1,
    'Training Loss': tl,
    'Validation Loss': valLoss[index] || 0.0,
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="epoch" stroke="#64748b" fontSize={10} label={{ value: 'Epoch', position: 'insideBottom', offset: -10, fill: '#64748b' }} />
          <YAxis stroke="#64748b" fontSize={10} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
          />
          <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
          <Line type="monotone" dataKey="Training Loss" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Validation Loss" stroke="#ec4899" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
export default LossChart;
