import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { PollutantData } from '../../types';
import { useConfig } from '../../context/ConfigContext';

interface PollutantBarChartProps {
  data: PollutantData;
}

export const PollutantBarChart: React.FC<PollutantBarChartProps> = ({ data }) => {
  const { metadata } = useConfig();

  // Dynamically resolve labels and units from the backend metadata
  const getDynamicPollutantLabel = (key: string): string => {
    const found = metadata?.pollutants.find((p) => p.key === key);
    if (found) return found.label;
    
    // Fallback mappings if not found
    const labels: Record<string, string> = {
      pm25: 'PM2.5',
      pm10: 'PM10',
      no2: 'NO₂',
      so2: 'SO₂',
      co: 'CO',
      o3: 'O₃',
      nh3: 'NH₃',
    };
    return labels[key] || key.toUpperCase();
  };

  const getDynamicPollutantUnit = (key: string): string => {
    const found = metadata?.pollutants.find((p) => p.key === key);
    if (found) return found.unit;
    return key === 'co' ? 'mg/m³' : 'µg/m³';
  };

  // Only render standard pollutants returned by metadata or present in the keys
  const targetKeys = metadata?.pollutants.map(p => p.key) || ['pm25', 'pm10', 'no2', 'so2', 'co', 'o3', 'nh3'];
  const chartData = Object.entries(data)
    .filter(([key]) => targetKeys.includes(key))
    .map(([key, val]) => ({
      name: getDynamicPollutantLabel(key),
      value: val,
      unit: getDynamicPollutantUnit(key),
    }));

  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
          <XAxis type="number" stroke="#64748b" fontSize={10} />
          <YAxis type="category" dataKey="name" stroke="#64748b" fontSize={10} width={60} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
            itemStyle={{ color: '#f8fafc' }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {chartData.map((_entry, index) => (
              <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
export default PollutantBarChart;
