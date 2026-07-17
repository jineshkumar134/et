import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { TimeSeriesPoint } from '../../types';

interface AQITrendChartProps {
  data: TimeSeriesPoint[];
}

export const AQITrendChart: React.FC<AQITrendChartProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    time: new Date(d.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' }),
    AQI: Math.round(d.aqi),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorAqi" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis dataKey="time" stroke="#64748b" fontSize={10} />
          <YAxis stroke="#64748b" fontSize={10} domain={[0, 'auto']} />
          <Tooltip
            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '8px' }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
            itemStyle={{ color: '#10b981' }}
          />
          <Area type="monotone" dataKey="AQI" stroke="#10b981" fillOpacity={1} fill="url(#colorAqi)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
export default AQITrendChart;
