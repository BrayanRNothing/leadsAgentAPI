import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Search, Database, LogOut, ArrowLeft, Radar, MapPin, Users, Flame, ArrowDown, Mail, Phone, Play } from 'lucide-react';
import LoginSquare from './LoginSquare';
import ScrapingView from './ScrapingView';
import HistoryView from './HistoryView';
import InegiView from './InegiView';

// Tarjeta de acción principal
function ActionCard({ item, onClick, index }) {
  return (
    <motion.div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick(); }}
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.15, type: "spring", stiffness: 300, damping: 25 }}
      className="group relative z-20 cursor-pointer rounded-[2.5rem] overflow-hidden flex items-center gap-6 p-4 select-none flex-1 text-left transition-all duration-500"
      style={{
        background: 'linear-gradient(145deg, #f6f8fb, #e0e5ec)',
        boxShadow: '10px 10px 20px rgba(163,177,198,0.5), -10px -10px 20px rgba(255,255,255,0.9)',
      }}
      whileHover={{
        y: -2,
        scale: 1.01,
        zIndex: 50,
        boxShadow: `15px 15px 25px rgba(163,177,198,0.4), -15px -15px 25px rgba(255,255,255,1), 0 5px 20px ${item.glowColor}`,
      }}
      whileTap={{
        y: 2,
        scale: 0.98,
        boxShadow: 'inset 4px 4px 10px rgba(163,177,198,0.6), inset -4px -4px 10px rgba(255,255,255,0.8)',
      }}
    >
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
        style={{ background: `linear-gradient(120deg, transparent, ${item.glowColor} 150%)` }}
      />

      <motion.div
        className="relative z-10 w-16 h-16 shrink-0 rounded-full flex items-center justify-center transition-all duration-500 pointer-events-none"
        style={{
          background: '#e0e5ec',
          boxShadow: `inset 4px 4px 8px rgba(163,177,198,0.4), inset -4px -4px 8px rgba(255,255,255,0.9)`,
        }}
        whileHover={{ rotate: 12, scale: 1.1 }}
      >
        <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-md" style={{ background: item.iconGlow }} />
        <div className="relative z-10">
          {item.icon}
        </div>
      </motion.div>

      <div className="relative z-10 flex flex-col pointer-events-none w-full pr-2">
        <h3 className="text-xl sm:text-2xl font-black tracking-tight mb-0.5" style={{ color: '#2d3748' }}>
          {item.title}
        </h3>
        <p className="text-xs sm:text-sm font-medium tracking-wide" style={{ color: '#8da0b8' }}>
          {item.desc}
        </p>
      </div>
    </motion.div>
  );
}

// Bolita de Base de Datos
function DbBubble({ count, onClick, index, color }) {
  const isEmpty = count === 0;
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, x: -20, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: index * 0.15 + 0.1, type: "spring", stiffness: 300, damping: 25 }}
      className="relative z-20 flex flex-col items-center justify-center w-24 h-24 rounded-3xl shrink-0 group transition-all duration-300"
      style={{
        background: '#e0e5ec',
        boxShadow: '6px 6px 12px rgba(163,177,198,0.5), -6px -6px 12px rgba(255,255,255,0.9)',
      }}
      whileHover={{
        y: -2,
        scale: 1.05,
        boxShadow: `8px 8px 16px rgba(163,177,198,0.4), -8px -8px 16px rgba(255,255,255,1), 0 5px 15px ${color}30`,
      }}
      whileTap={{
        scale: 0.95,
        boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)',
      }}
    >
      <Database size={20} className="mb-1 transition-colors" color={isEmpty ? '#a0aec0' : color} />
      <div className="flex flex-col items-center leading-tight">
        <span className="text-[9px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">DB Leads</span>
        <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full" style={{
          background: '#e0e5ec',
          boxShadow: 'inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)'
        }}>
          <div className={`w-1.5 h-1.5 rounded-full ${isEmpty ? 'bg-gray-400' : 'animate-pulse'}`} style={{ backgroundColor: isEmpty ? undefined : color }} />
          <span className="text-xs font-black text-gray-800">
            {count > 0 ? count.toLocaleString() : '0'}
          </span>
        </div>
      </div>
    </motion.button>
  );
}

export default function BentoGrid({ isAuthenticated, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ mapsLeads: 0, inegiLeads: 0 });
  const [aiStats, setAiStats] = useState({ usedTokens: 0, maxTokens: 500000 });

  React.useEffect(() => {
    fetch('https://leadsagentapi-production.up.railway.app/api/home-stats')
      .then(r => r.json())
      .then(data => setStats(data))
      .catch(e => console.error("Error fetching home stats", e));

    fetch('https://leadsagentapi-production.up.railway.app/api/ai-stats')
      .then(r => r.json())
      .then(data => setAiStats(data))
      .catch(e => console.error("Error fetching AI stats", e));
  }, [location.pathname]);

  // Componente para Nodos del Pipeline (Horizontales y compactos)
  const PipelineNode = ({ id, title, icon, count, route, delay, color }) => (
    <motion.div
      role="button"
      onClick={() => navigate(route)}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 25 }}
      className="relative w-full group cursor-pointer"
    >
      <div 
        className="w-full h-32 sm:h-[136px] flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-300 relative z-10 hover:scale-[1.05]"
        style={{
          background: '#e0e5ec',
          boxShadow: '4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.8)',
        }}
      >
        <div 
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-1.5 shrink-0"
          style={{
            background: '#e0e5ec',
            boxShadow: 'inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.8)'
          }}
        >
          {icon}
        </div>
        <h3 className="text-[11px] sm:text-[13px] font-black text-gray-800 text-center leading-tight mb-2 px-1">{title}</h3>
        
        {/* Count Badge (Always render to maintain height, hide if undefined) */}
        <div 
          className={`flex items-center justify-center px-3 py-1 rounded-lg w-full max-w-[80px] transition-opacity ${count !== undefined ? 'opacity-100' : 'opacity-0'}`}
          style={{
            background: '#e0e5ec',
            boxShadow: 'inset 2px 2px 4px rgba(163,177,198,0.5), inset -2px -2px 4px rgba(255,255,255,0.9)'
          }}
        >
          <div className={`w-1.5 h-1.5 rounded-full mr-1.5 shrink-0 ${count > 0 ? 'animate-pulse' : 'bg-gray-400'}`} style={{ backgroundColor: count > 0 ? color : undefined }} />
          <span className="text-[10px] sm:text-xs font-black text-gray-700 leading-none">{count !== undefined ? count.toLocaleString() : '0'}</span>
        </div>
      </div>
    </motion.div>
  );

  const HConnector = ({ delay }) => (
    <motion.div 
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 24 }}
      transition={{ delay, duration: 0.4 }}
      className="flex justify-center items-center h-full mx-1 sm:mx-2"
    >
      <div className="h-1 w-full bg-gradient-to-r from-gray-300 to-gray-400 rounded-full relative">
      </div>
    </motion.div>
  );

  return (
    <div className="relative w-full max-w-xl flex flex-col items-center justify-center min-h-screen py-10 px-4">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <motion.div
              key="home"
              className="w-full flex flex-col items-center gap-8"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col w-full max-w-4xl mx-auto relative z-20 mb-32 pb-10 px-2 sm:px-4 mt-8">

                <div className="flex flex-col gap-12 w-full">
                  
                  {/* AI Tokens Progress Bar */}
                  <div className="w-full bg-[#e0e5ec] p-4 rounded-2xl shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)]">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                        <Flame size={14} className="text-indigo-500" /> IA Tokens (Groq)
                      </span>
                      <span className="text-xs font-black text-gray-700">
                        {aiStats.usedTokens.toLocaleString()} <span className="text-gray-400 font-medium">/ {aiStats.maxTokens.toLocaleString()}</span>
                      </span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'rgba(163,177,198,0.3)', boxShadow: 'inset 2px 2px 4px rgba(163,177,198,0.5)' }}>
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (aiStats.usedTokens / aiStats.maxTokens) * 100)}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ boxShadow: '0 0 10px rgba(99,102,241,0.5)' }}
                      />
                    </div>
                  </div>
                  
                  {/* Pipeline Principal */}
                  <div className="w-full">
                    <h2 className="text-[10px] sm:text-xs font-bold text-teal-600 uppercase tracking-widest mb-4 ml-2 sm:ml-4">Pipeline Principal</h2>
                    <div className="flex items-center w-full">
                      <div className="flex-1">
                        <PipelineNode 
                          id="inegi"
                          title="Base de Datos"
                          icon={<Database size={20} color="#38b2ac" />}
                          route="/inegi"
                          delay={0.1}
                        />
                      </div>
                      <HConnector delay={0.3} />
                      <div className="flex-1">
                        <PipelineNode 
                          id="history-inegi"
                          title="En Proceso"
                          icon={<Users size={20} color="#38b2ac" />}
                          count={stats.inegiLeads}
                          color="#38b2ac"
                          route="/history/inegi"
                          delay={0.4}
                        />
                      </div>
                      <HConnector delay={0.6} />
                      <div className="flex-1">
                        <PipelineNode 
                          id="hot-inegi"
                          title="Interesados"
                          icon={<Flame size={20} color="#ed8936" />}
                          count={0}
                          color="#ed8936"
                          route="/pipeline/inegi"
                          delay={0.7}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Separador Visual */}
                  <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>

                  {/* Herramientas Independientes */}
                  <div className="w-full">
                    <h2 className="text-[10px] sm:text-xs font-bold text-blue-600 uppercase tracking-widest mb-4 ml-2 sm:ml-4">Herramientas de Extracción</h2>
                    <div className="flex items-center w-full gap-4">
                      <div className="flex-1">
                        <PipelineNode 
                          id="maps"
                          title="Scanner Maps"
                          icon={<MapPin size={20} color="#3182ce" />}
                          route="/search"
                          delay={0.2}
                        />
                      </div>
                      <div className="flex-1">
                        <PipelineNode 
                          id="history-maps"
                          title="Historial Maps"
                          icon={<Database size={20} color="#3182ce" />}
                          count={stats.mapsLeads}
                          color="#3182ce"
                          route="/history/maps"
                          delay={0.3}
                        />
                      </div>
                      <div className="flex-1 hidden sm:block opacity-0 pointer-events-none">
                        {/* Empty placeholder for grid balance */}
                      </div>
                    </div>
                  </div>

                  {/* Auto-Piloto Integrado */}
                  <div className="w-full">
                    <h2 className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4 ml-2 sm:ml-4">Automatización</h2>
                    <div className="flex items-center w-full">
                      <div className="w-full sm:w-1/2">
                        <ActionCard 
                          item={{
                            title: 'Auto-Piloto',
                            desc: 'Envío de correos y captación masiva (Automático)',
                            icon: <Play size={24} color="#667eea" />,
                            glowColor: 'rgba(102,126,234,0.4)',
                            iconGlow: 'rgba(102,126,234,0.3)',
                          }}
                          onClick={() => navigate('/autopilot')}
                          index={0}
                        />
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </motion.div>
          } />

          <Route path="/search" element={
            <motion.div key="expanded-search" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2">
                <ScrapingView onBack={() => navigate('/')} />
              </div>
            </motion.div>
          } />

          <Route path="/inegi" element={
            <motion.div key="expanded-inegi" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2">
                <InegiView onBack={() => navigate('/')} />
              </div>
            </motion.div>
          } />

          <Route path="/history/maps" element={
            <motion.div key="expanded-hist-maps" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2">
                <HistoryView onBack={() => navigate('/')} dbMode="maps" />
              </div>
            </motion.div>
          } />

          <Route path="/history/inegi" element={
            <motion.div key="expanded-hist-inegi" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2">
                <HistoryView onBack={() => navigate('/')} dbMode="inegi" />
              </div>
            </motion.div>
          } />

        </Routes>
      </AnimatePresence>

      {!isAuthenticated && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(224,229,236,0.85)', backdropFilter: 'blur(6px)' }}>
          <LoginSquare onLogin={onLogin} />
        </div>
      )}
    </div>
  );
}
