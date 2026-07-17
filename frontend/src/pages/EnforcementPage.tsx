import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchEnforcementRecommendations,
  assignInspector,
  updateInspectionStatus
} from '../api/aqi';
import type { EnforcementRecommendation } from '../api/aqi';
import { EnforcementMap } from '../components/map/EnforcementMap';
import { useConfig } from '../context/ConfigContext';
import {
  ShieldAlert, Activity, FileText, CheckCircle2, User,
  ListTodo, Clock, ShieldCheck, Filter, Compass
} from 'lucide-react';

export const EnforcementPage: React.FC = () => {
  const { config, loading: configLoading } = useConfig();
  const [searchParams] = useSearchParams();

  // Recommendations and stats state
  const [recommendations, setRecommendations] = useState<EnforcementRecommendation[]>([]);
  const [optimizedRoute, setOptimizedRoute] = useState<EnforcementRecommendation[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [selectedRec, setSelectedRec] = useState<EnforcementRecommendation | null>(null);
  const [loading, setLoading] = useState(true);
  const [inspectorLoading, setInspectorLoading] = useState(false);

  // Filters
  const [filterPriority, setFilterPriority] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterWard, setFilterWard] = useState<string>('');

  // Routing toggle
  const [showRoute, setShowRoute] = useState(false);

  // Inspector Assignment Inputs
  const [inspectorName, setInspectorName] = useState('');
  const [complianceNotes, setComplianceNotes] = useState('');

  const loadData = async () => {
    if (!config) return;
    try {
      setLoading(true);
      const data = await fetchEnforcementRecommendations(
        { city: config.city, resolution: config.resolution },
        { priority: filterPriority, source: filterSource, ward: filterWard }
      );
      setRecommendations(data.recommendations);
      setOptimizedRoute(data.optimized_route);
      setSummary(data.summary);

      // Handle pre-selected grid cell
      const gridParam = searchParams.get('grid');
      if (gridParam) {
        handleGridSelect(parseInt(gridParam));
      }
    } catch (err) {
      console.error('Error loading enforcement recommendations', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [config?.city, config?.resolution, filterPriority, filterSource, filterWard]);

  const handleGridSelect = async (gridId: number) => {
    if (!config) return;
    try {
      setInspectorLoading(true);
      // Scan current lists
      const match = recommendations.find(r => r.grid_id === gridId);
      if (match) {
        setSelectedRec(match);
        setInspectorName(match.assigned_inspector !== '—' ? match.assigned_inspector : '');
        setComplianceNotes(match.compliance_notes || '');
      }
    } catch (err) {
      console.error('Error selecting grid recommendation', err);
    } finally {
      setInspectorLoading(false);
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRec || !config || !inspectorName.trim()) return;
    try {
      setInspectorLoading(true);
      await assignInspector(selectedRec.grid_id, config.city, inspectorName);
      await loadData();
      // Re-fetch detail
      const updated = recommendations.find(r => r.grid_id === selectedRec.grid_id);
      if (updated) setSelectedRec(updated);
    } catch (err) {
      console.error('Error assigning inspector', err);
    } finally {
      setInspectorLoading(false);
    }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selectedRec || !config) return;
    try {
      setInspectorLoading(true);
      await updateInspectionStatus(selectedRec.grid_id, config.city, status, complianceNotes);
      await loadData();
      // Re-fetch detail
      const updated = recommendations.find(r => r.grid_id === selectedRec.grid_id);
      if (updated) setSelectedRec(updated);
    } catch (err) {
      console.error('Error updating status', err);
    } finally {
      setInspectorLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'Critical') return '#dc2626';
    if (priority === 'High') return '#ea580c';
    if (priority === 'Medium') return '#eab308';
    return '#16a34a';
  };

  if (configLoading || !config) {
    return (
      <div className="h-[calc(100vh-52px)] flex items-center justify-center bg-[#111827]">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-52px)] flex flex-col bg-[#111827] font-sans">

      {/* ── 1. Filter strip & Route Optimizer ── */}
      <div className="h-12 bg-[#1f2937] border-b border-[#374151] flex items-center justify-between px-6 shrink-0 z-[1001] shadow-sm">
        <div className="flex items-center gap-4 text-xs font-semibold text-[#9ca3af]">
          
          {/* Priority filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <span className="h-4 w-px bg-[#374151]" />

          {/* Source filter */}
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#6b7280]" />
            <span>Source:</span>
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All Sources</option>
              <option value="Traffic">Traffic</option>
              <option value="Industry">Industry</option>
              <option value="Construction">Construction</option>
              <option value="Waste Burning">Waste Burning</option>
              <option value="Dust">Dust</option>
            </select>
          </div>

          <span className="h-4 w-px bg-[#374151]" />

          {/* Ward filter */}
          <div className="flex items-center gap-2">
            <span>Ward:</span>
            <select
              value={filterWard}
              onChange={(e) => setFilterWard(e.target.value)}
              className="bg-[#111827] border border-[#374151] rounded px-2 text-xs text-[#f9fafb] focus:outline-none focus:border-[#2563eb]"
            >
              <option value="">All Wards</option>
              {Array.from({ length: 25 }, (_, i) => (
                <option key={i + 1} value={`Ward ${i + 1}`}>
                  Ward {i + 1}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Optimized Route Toggle */}
        <button
          onClick={() => setShowRoute(!showRoute)}
          className={`flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold border transition-all ${
            showRoute
              ? 'bg-[#2563eb]/20 border-[#2563eb] text-[#93c5fd]'
              : 'bg-[#111827] border-[#374151] text-[#9ca3af] hover:text-[#f9fafb]'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Optimize Inspection Route
        </button>
      </div>

      {/* ── Command Center Dashboard Strip ── */}
      {summary && (
        <div className="bg-[#111827] border-b border-[#374151] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 text-xs text-[#9ca3af]">
          <div className="flex items-center gap-6">
            <div>
              <span className="text-[#6b7280] font-bold uppercase text-[9px] tracking-wider">Critical Alerts</span>
              <p className="text-[13px] font-bold text-[#dc2626] mt-0.5">{summary.critical_count} Areas</p>
            </div>
            <div className="border-l border-[#374151] pl-6">
              <span className="text-[#6b7280] font-bold uppercase text-[9px] tracking-wider">High Priorities</span>
              <p className="text-[13px] font-bold text-[#ea580c] mt-0.5">{summary.high_count} Areas</p>
            </div>
            <div className="border-l border-[#374151] pl-6">
              <span className="text-[#6b7280] font-bold uppercase text-[9px] tracking-wider">Inspections Completed</span>
              <p className="text-[13px] font-bold text-[#16a34a] mt-0.5">{summary.completed_inspections} Tasks</p>
            </div>
            <div className="border-l border-[#374151] pl-6">
              <span className="text-[#6b7280] font-bold uppercase text-[9px] tracking-wider">Pending Enforcement</span>
              <p className="text-[13px] font-bold text-[#f59e0b] mt-0.5">{summary.pending_actions} Tasks</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-[#16a34a]/10 border border-[#16a34a]/20 px-3 py-1 rounded text-[#16a34a] font-bold">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Deployment Active</span>
          </div>
        </div>
      )}

      {/* ── 2. Split Workspace Layout (Map 70%, Inspector 30%) ── */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Map Column */}
        <div className="w-[70%] h-full relative">
          {loading ? (
            <div className="h-full w-full flex items-center justify-center bg-[#e8edf2]">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-[#2563eb] rounded-full animate-spin" />
            </div>
          ) : (
            <EnforcementMap
              recommendations={recommendations}
              optimizedRoute={optimizedRoute}
              selectedRec={selectedRec}
              onGridClick={handleGridSelect}
              showRoute={showRoute}
            />
          )}
        </div>

        {/* Right Inspector Column */}
        <div className="w-[30%] bg-[#1f2937] border-l border-[#374151] flex flex-col h-full overflow-hidden shrink-0 shadow-lg">
          
          <div className="px-5 py-4 border-b border-[#374151] flex items-center justify-between shrink-0">
            <span className="text-[13px] font-bold uppercase tracking-wider text-[#f9fafb] flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-[#2563eb]" />
              Enforcement Console
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {inspectorLoading && (
              <div className="h-64 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-[#374151] border-t-[#2563eb] rounded-full animate-spin" />
              </div>
            )}

            {!inspectorLoading && !selectedRec && (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-[#6b7280]">
                <ShieldCheck className="w-12 h-12 opacity-35 mb-3" strokeWidth={1.5} />
                <p className="text-[13px] font-bold">Select Hotspot Grid</p>
                <p className="text-[12px] leading-relaxed max-w-[200px] mt-1.5">
                  Click any critical zone grid on the map to issue directives or assign local inspection tasks.
                </p>
              </div>
            )}

            {!inspectorLoading && selectedRec && (
              <div className="p-5 space-y-5.5 fade-in text-[#f9fafb]">
                
                {/* Header detail */}
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-[14px] font-bold text-[#f9fafb]">
                      Grid Sector {selectedRec.grid_id + 1}
                    </h3>
                    <span
                      className="text-[10px] font-700 uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{
                        background: getPriorityColor(selectedRec.priority) + '18',
                        color: getPriorityColor(selectedRec.priority)
                      }}
                    >
                      {selectedRec.priority}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6b7280] mt-0.5 font-mono">
                    {selectedRec.ward} · Lat: {selectedRec.lat.toFixed(3)}
                  </p>
                </div>

                {/* AQI Status and Impact */}
                <div className="grid grid-cols-2 gap-2 text-xs bg-[#111827] border border-[#374151] rounded-lg p-3">
                  <div>
                    <span className="text-[#6b7280] font-bold uppercase tracking-wider text-[9px]">Current / 24h AQI</span>
                    <p className="text-[14px] font-bold text-[#f9fafb] mt-0.5">
                      {selectedRec.current_aqi} <span className="text-[#6b7280]">/</span> {selectedRec.forecast_aqi}
                    </p>
                  </div>
                  <div>
                    <span className="text-[#6b7280] font-bold uppercase tracking-wider text-[9px]">Exp. Abatement</span>
                    <p className="text-[14px] font-bold text-[#10b981] mt-0.5">
                      {selectedRec.expected_impact}
                    </p>
                  </div>
                </div>

                {/* Suggested Directives */}
                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5 border-b border-[#374151] pb-1">
                    <FileText className="w-3.5 h-3.5" />
                    CPCB Directives
                  </h4>
                  <div className="p-3 bg-[#111827] border border-[#374151] rounded-lg text-xs leading-relaxed text-[#9ca3af]">
                    <p className="font-semibold text-[#f9fafb] mb-1">Suggested Intervention:</p>
                    {selectedRec.suggested_action}
                  </div>
                  <p className="text-[10px] text-[#6b7280] italic">Responsible Dept: {selectedRec.department}</p>
                </div>

                {/* Supporting evidence list */}
                <div className="space-y-2">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5 border-b border-[#374151] pb-1">
                    <ListTodo className="w-3.5 h-3.5" />
                    Prioritization Evidence
                  </h4>
                  <div className="space-y-1.5 text-xs text-[#9ca3af]">
                    {selectedRec.evidence.map((ev, i) => (
                      <div key={i} className="flex gap-2">
                        <span className="text-[#2563eb] font-bold">•</span>
                        <span>{ev}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Workflow Status Tracker */}
                <div className="space-y-3 border-t border-[#374151] pt-4">
                  <h4 className="text-[11px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Workflow Status: {selectedRec.status}
                  </h4>
                  
                  {/* Status buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {['In Progress', 'Completed', 'Rejected'].map(st => (
                      <button
                        key={st}
                        onClick={() => handleStatusUpdate(st)}
                        className={`py-1.5 rounded text-[10px] font-bold uppercase transition-all ${
                          selectedRec.status === st
                            ? 'bg-[#2563eb] text-white'
                            : 'bg-[#111827] border border-[#374151] text-[#9ca3af] hover:text-[#f9fafb]'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Inspector Assignment form */}
                <form onSubmit={handleAssign} className="space-y-3 pt-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider flex items-center gap-1">
                      <User className="w-3 h-3" />
                      Assign Inspector Officer
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Officer Rajesh Kumar"
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111827] border border-[#374151] focus:border-[#2563eb] rounded-lg text-xs text-[#f9fafb] placeholder-[#4b5563] focus:outline-none transition-colors"
                    />
                  </div>
                  
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-[#6b7280] tracking-wider">
                      Compliance Inspection Notes
                    </label>
                    <textarea
                      placeholder="Enter inspection field remarks..."
                      rows={2}
                      value={complianceNotes}
                      onChange={(e) => setComplianceNotes(e.target.value)}
                      className="w-full px-3 py-2 bg-[#111827] border border-[#374151] focus:border-[#2563eb] rounded-lg text-xs text-[#f9fafb] placeholder-[#4b5563] focus:outline-none transition-colors resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={!inspectorName.trim()}
                    className="w-full py-2 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Assign Deployment Task
                  </button>
                </form>

              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
export default EnforcementPage;
