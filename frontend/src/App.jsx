import React, { useState } from 'react';
import BentoGrid from './components/BentoGrid';
import { ScrapingProvider } from './context/ScrapingContext';
import { BrowserRouter } from 'react-router-dom';

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
        <BentoGrid
          isAuthenticated={isAuthenticated}
          onLogin={handleLogin}
          onLogout={handleLogout}
          username={username}
        />
        </ScrapingProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
