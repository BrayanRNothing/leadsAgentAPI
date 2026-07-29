import React, { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import BentoGrid from './components/BentoGrid';
import PipelineView from './components/PipelineView';
import AutoPilotView from './components/AutoPilotView';
import { ScrapingProvider } from './context/ScrapingContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [username, setUsername] = useState('Desarrollador');

  const handleLogin = (user) => {
    setIsAuthenticated(true);
    setUsername(user);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername('');
    localStorage.removeItem('token');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4"
      style={{ background: '#e0e5ec' }}
    >
      <BrowserRouter>
        <ScrapingProvider>
        <Routes>
          <Route path="/*" element={
            <BentoGrid
              isAuthenticated={isAuthenticated}
              onLogin={handleLogin}
              onLogout={handleLogout}
              username={username}
            />
          } />
          <Route path="/pipeline/:dbMode" element={
            <div className="fixed inset-0 z-50 bg-[#e0e5ec] overflow-hidden flex flex-col">
              <PipelineView onBack={() => window.location.href = '/'} />
            </div>
          } />
          <Route path="/autopilot" element={
            <div className="fixed inset-0 z-50 bg-[#e0e5ec] overflow-hidden flex flex-col">
              <AutoPilotView onBack={() => window.location.href = '/'} />
            </div>
          } />
        </Routes>
        </ScrapingProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
