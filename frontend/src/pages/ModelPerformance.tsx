import React, { useEffect, useState } from 'react';
import { fetchMetrics, fetchLossCurves } from '../api/aqi';
import type { ModelMetric } from '../types';
import { ModelComparisonChart } from '../components/charts/ModelComparisonChart';
import { LossChart } from '../components/charts/LossChart';
import { useConfig } from '../context/ConfigContext';
import { Award, Zap, TrendingUp, Cpu } from 'lucide-react';

export const ModelPerformance: React.FC = () => {
  const { config, loading: configLoading } = useConfig();
  const [metrics, setMetrics] = useState<ModelMetric[]>([]);
  const [lossData, setLossData] = useState<{ train_loss: number[], val_loss: number[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPerformanceData = async () => {
      if (!config) return;
      try {
        setLoading(true);
        const params = {
          city: config.city,
          resolution: config.resolution,
        };
        const [met, loss] = await Promise.all([
          fetchMetrics(params),
          fetchLossCurves(params)
        ]);
        setMetrics(met);
        setLossData(loss);
      } catch (err) {
        console.error("Error loading model metrics and loss curves", err);
      } finally {
        setLoading(false);
      }
    };
    loadPerformanceData();
  }, [config?.city, config?.resolution]);

  if (loading || configLoading || !config) {
    return (
      <div className="p-8 flex items-center justify-center h-full bg-slate-950">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-emerald-500 rounded-full animate-spin" />
      </div>
    );
  }

  // Get active model summary (Weighted Ensemble is default active backend forecaster)
  const activeMetrics = metrics.filter((m) => m.model_name === 'ensemble');
  const m24 = activeMetrics.find((m) => m.horizon === '24h');
  const m48 = activeMetrics.find((m) => m.horizon === '48h');
  const m72 = activeMetrics.find((m) => m.horizon === '72h');

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto text-slate-100 font-sans">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wide text-slate-200">Model Performance Panel</h2>
          <p className="text-xs text-slate-400">Statistical evaluation of multi-modal fusion forecasters against baseline benchmarks.</p>
        </div>
        <span className="text-xs font-bold uppercase tracking-widest px-3 py-1 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 rounded-lg">
          Active: Operational Weighted Ensemble
        </span>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { title: "24-Hour Horizon", metric: m24, icon: <Award className="w-6 h-6 text-yellow-500" /> },
          { title: "48-Hour Horizon", metric: m48, icon: <Zap className="w-6 h-6 text-blue-500" /> },
          { title: "72-Hour Horizon", metric: m72, icon: <TrendingUp className="w-6 h-6 text-purple-500" /> },
        ].map((item, index) => (
          <div key={index} className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{item.title}</span>
              {item.icon}
            </div>
            
            {item.metric ? (
              <div className="space-y-4">
                <div className="flex items-baseline justify-between">
                  <div className="text-3xl font-extrabold text-slate-200">
                    {Math.round(item.metric.rmse * 10) / 10}
                  </div>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    -{Math.round(item.metric.improvement_pct)}% vs Base
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  <div>
                    <span>MAE</span>
                    <div className="text-sm font-black text-slate-250 mt-1">{Math.round(item.metric.mae * 10) / 10}</div>
                  </div>
                  <div>
                    <span>R² Score</span>
                    <div className="text-sm font-black text-slate-250 mt-1">{Math.round(item.metric.r2 * 100)}%</div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500">Metric data unavailable.</div>
            )}
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Model Comparison Bar Chart */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-5 h-5 text-emerald-400" />
            RMSE Comparison Across Horizons
          </h3>
          <ModelComparisonChart metrics={metrics} />
        </div>

        {/* Training Loss Line Chart */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl space-y-4">
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            Operational Ensemble Training Loss
          </h3>
          {lossData ? (
            <LossChart trainLoss={lossData.train_loss} valLoss={lossData.val_loss} />
          ) : (
            <div className="h-64 flex items-center justify-center text-slate-500 text-xs">No loss curves recorded.</div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ModelPerformance;
