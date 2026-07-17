import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { Home } from './pages/Home';
import { ForecastMapPage } from './pages/ForecastMapPage';
import { ModelPerformance } from './pages/ModelPerformance';
import { Onboarding } from './pages/Onboarding';
import { HotspotsPage } from './pages/HotspotsPage';
import { SourceAttributionPage } from './pages/SourceAttributionPage';
import { EnforcementPage } from './pages/EnforcementPage';
import { HealthAdvisoryPage } from './pages/HealthAdvisoryPage';
import { ExplainabilityPage } from './pages/ExplainabilityPage';
import { DigitalTwinPage } from './pages/DigitalTwinPage';
import { DataPipelinePage } from './pages/DataPipelinePage';
import { AICopilotPage } from './pages/AICopilotPage';
import { ComplianceReportsPage } from './pages/MockGISModules';
import { ConfigProvider, useConfig } from './context/ConfigContext';

const MainLayout: React.FC = () => {
  const { config, loading } = useConfig();
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = React.useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#111827] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-[#374151] border-t-[#2563EB] animate-spin" />
      </div>
    );
  }

  if (!config) {
    return <Onboarding />;
  }

  return (
    <div className="flex h-screen bg-[#111827] text-[#F9FAFB] overflow-hidden">

      {/* Mobile overlay backdrop — closes drawer when tapped */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <Sidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed(prev => !prev)}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onToggleMobileSidebar={() => setMobileSidebarOpen(prev => !prev)} />
        <main className="flex-1 overflow-auto bg-[#111827]">
          <Routes>
            <Route path="/"                element={<Home />} />
            <Route path="/map"             element={<ForecastMapPage />} />
            <Route path="/hotspots"        element={<HotspotsPage />} />
            <Route path="/source-analysis" element={<SourceAttributionPage />} />
            <Route path="/enforcement"     element={<EnforcementPage />} />
            <Route path="/health-advisory" element={<HealthAdvisoryPage />} />
            <Route path="/data-pipeline"    element={<DataPipelinePage />} />
            <Route path="/explainability"   element={<ExplainabilityPage />} />
            <Route path="/digital-twin"     element={<DigitalTwinPage />} />
            <Route path="/copilot"          element={<AICopilotPage />} />
            <Route path="/reports"         element={<ComplianceReportsPage />} />
            <Route path="/performance"     element={<ModelPerformance />} />
            <Route path="/setup"           element={<Onboarding />} />
            <Route path="*"               element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => (
  <ConfigProvider>
    <BrowserRouter>
      <MainLayout />
    </BrowserRouter>
  </ConfigProvider>
);

export default App;
