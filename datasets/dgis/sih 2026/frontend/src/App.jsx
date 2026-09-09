// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import NewInvestigation from './pages/NewInvestigation';
import Cases from './pages/Cases';
import CaseDetails from './pages/CaseDetails';
import SahyogWorkflow from './pages/SahyogWorkflow';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <Navbar />
        <div className="flex flex-1">
          <Sidebar />
          <main className="flex-1 p-6 max-w-screen-xl mx-auto w-full">
            <Routes>
              <Route path="/"           element={<Dashboard />} />
              <Route path="/investigate" element={<NewInvestigation />} />
              <Route path="/cases"      element={<Cases />} />
              <Route path="/cases/:caseId" element={<CaseDetails />} />
              <Route path="/sahyog"     element={<SahyogWorkflow />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  );
}
