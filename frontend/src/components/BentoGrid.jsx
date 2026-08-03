import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Search, Database, LogOut, ArrowLeft, Radar, MapPin, Users, Flame, ArrowDown, Mail, Phone, Play, Send, BotMessageSquare, Sparkles } from 'lucide-react';
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
  const [autoPilotConfig, setAutoPilotConfig] = useState(null);
  const [autoPilotStatus, setAutoPilotStatus] = useState(null);

  React.useEffect(() => {
    const fetchHomeStats = () => {
      fetch('https://leadsagentapi-production.up.railway.app/api/home-stats')
        .then(r => r.json())
        .then(data => setStats(data))
        .catch(() => {});
    };

    fetch('https://leadsagentapi-production.up.railway.app/api/ai-stats')
      .then(r => r.json())
      .then(data => setAiStats(data))
      .catch(e => console.error("Error fetching AI stats", e));

    const checkBot = () => {
      fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/config')
        .then(r => r.json())
        .then(d => {
          setAutoPilotConfig(prev => {
            if (!prev) return d;
            return JSON.stringify(prev) === JSON.stringify(d) ? prev : d;
          });
        })
        .catch(() => {});
      
      fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/status')
        .then(r => r.json())
        .then(d => {
          setAutoPilotStatus(prev => {
            if (!prev) return d;
            return JSON.stringify(prev) === JSON.stringify(d) ? prev : d;
          });
        })
        .catch(() => {});
    };
    fetchHomeStats();
    checkBot();
    const interval = setInterval(() => { checkBot(); fetchHomeStats(); }, 4000);
    return () => clearInterval(interval);
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

  const AnimatedArrow = ({ delay }) => (
    <motion.div 
      initial={{ opacity: 0, width: 0 }}
      animate={{ opacity: 1, width: 40 }}
      transition={{ delay, duration: 0.4 }}
      className="flex justify-center items-center h-full mx-1 sm:mx-2 text-gray-400 shrink-0"
    >
      <motion.div 
        animate={{ x: [0, 5, 0] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      >
        <ArrowLeft size={24} className="transform rotate-180" color="#a0aec0" />
      </motion.div>
    </motion.div>
  );



  return (
    <div className="relative w-full flex flex-col items-center justify-center min-h-screen py-10 px-4">
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
              <div className="flex flex-col w-full max-w-4xl mx-auto relative z-20 mb-32 pb-10 px-2 sm:px-4 mt-8 pt-10">

                {/* Esquina Superior Derecha: Maps */}
                <div className="fixed top-6 right-6 flex flex-col gap-3 z-50">
                  <motion.div
                    role="button"
                    onClick={() => navigate('/search')}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-gray-200 transition-all active:scale-95"
                    style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)' }}
                  >
                    <MapPin size={18} color="#3182ce" />
                    <span className="text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wide">Scanner Maps</span>
                  </motion.div>
                  
                  <motion.div
                    role="button"
                    onClick={() => navigate('/history/maps')}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer hover:bg-gray-200 transition-all active:scale-95"
                    style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)' }}
                  >
                    <Database size={18} color="#3182ce" />
                    <span className="text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wide">BD Maps ({stats.mapsLeads})</span>
                  </motion.div>
                </div>

                <div className="flex flex-col gap-12 w-full mt-12 sm:mt-16">
                  
                  {/* Pipeline Principal (Centrado) */}
                  <div className="w-full flex flex-col items-center">
                    <h2 className="text-xs sm:text-sm font-black text-teal-600 uppercase tracking-widest mb-6 text-center">Pipeline Principal</h2>
                    {(() => {
                      const liveCounts = autoPilotStatus?.counts || {};
                      const isGlobalActive = autoPilotStatus?.globalActive || autoPilotConfig?.globalActive || false;
                      const isPhase1Active = autoPilotStatus?.phase1Active || autoPilotConfig?.phase1Active || false;
                      const isPhase2Active = autoPilotStatus?.phase2Active || autoPilotConfig?.phase2Active || false;
                      const isPhase3Active = autoPilotStatus?.phase3Active || autoPilotConfig?.phase3Active || false;

                      const pipelineStats = [
                        { id: 'database', title: 'Base de Datos', count: stats?.inegiLeads || 0, icon: <Database size={24} color="#3b82f6" />, color: '#3b82f6', phase: 'NEW', route: '/inegi' },
                        { id: 'process', title: 'En Proceso', count: (liveCounts.sending || 0) + (liveCounts.sent || 0), icon: <Send size={24} color="#10b981" />, color: '#10b981', phase: 'SENT', route: '/history/inegi' },
                        { id: 'interested', title: 'Respuestas', count: (liveCounts.replied || 0) + (liveCounts.interested || 0), icon: <Flame size={24} color="#f59e0b" />, color: '#f59e0b', phase: 'REPLIED', route: '/pipeline/inegi' },
                      ];
                      return (
                        <div className="flex flex-col sm:flex-row items-center sm:items-end justify-center gap-10 sm:gap-4 mb-12">
                          {pipelineStats.map((stat, idx) => {
                            let statusText = null;
                            let statusActive = false;
                            let extraData = null;
                            
                            // Caja 1: Base de Datos (Fase 1)
                            if (idx === 0) {
                              const p1 = isPhase1Active && isGlobalActive;
                              if (p1) {
                                statusActive = true;
                                if ((liveCounts.inQueue || 0) === 0) {
                                  statusText = "Sin leads en cola";
                                } else {
                                  statusText = `${liveCounts.inQueue} leads en cola`;
                                }
                              } else {
                                statusText = "Fase 1 inactiva";
                              }
                            }
                            
                            // Caja 2: En Proceso (Fase 2)
                            if (idx === 1) {
                              const p2 = isPhase2Active && isGlobalActive;
                              if (p2) {
                                if ((liveCounts.sending || 0) > 0) {
                                  statusActive = true;
                                  statusText = `Enviando ${liveCounts.sending} correo(s)...`;
                                } else if ((liveCounts.inQueue || 0) > 0) {
                                  statusActive = true;
                                  statusText = "Preparando envío...";
                                } else {
                                  statusText = "Todos enviados ✓";
                                }
                                extraData = (
                                  <span className="text-[9px] font-black uppercase text-indigo-600">
                                    {autoPilotStatus?.sentTodayCount || 0}/{autoPilotStatus?.dailyLimit || 200} ENV.
                                  </span>
                                );
                              } else {
                                statusText = "Fase 2 inactiva";
                              }
                            }
                            
                            // Caja 3: Respuestas (Fase 3)
                            if (idx === 2) {
                              const p3 = isPhase3Active && isGlobalActive;
                              if (p3) {
                                statusActive = true;
                                statusText = "IA Escuchando...";
                              } else {
                                statusText = "Fase 3 inactiva";
                              }
                            }

                            return (
                              <React.Fragment key={stat.id}>
                                <div className="flex flex-col items-center">
                                  {/* Label / Status above card */}
                                  <div className="h-10 sm:h-12 flex flex-col justify-end items-center mb-2">
                                    <span className={`text-[10px] font-bold ${statusActive ? 'text-indigo-600 animate-pulse' : 'text-gray-400'} text-center whitespace-nowrap`}>
                                      {statusText}
                                    </span>
                                    {extraData && <div className="mt-0.5 whitespace-nowrap">{extraData}</div>}
                                  </div>

                                  {/* Card */}
                                  <div className="w-28 sm:w-36">
                                    <PipelineNode 
                                      id={stat.id}
                                      title={stat.title} 
                                      count={stat.count} 
                                      icon={stat.icon} 
                                      color={stat.color} 
                                      delay={idx * 0.2} 
                                      route={stat.route}
                                    />
                                  </div>
                                </div>

                                {/* Arrow between cards */}
                                {idx < pipelineStats.length - 1 && (
                                  <div className="hidden sm:flex items-center justify-center h-32 sm:h-[136px] self-end mx-2">
                                    <AnimatedArrow delay={idx * 0.2 + 0.1} />
                                  </div>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Auto-Piloto Integrado (Más compacto y visual) */}
                  <div className="w-full flex flex-col items-center mt-4">
                    <h2 className="text-[10px] sm:text-xs font-bold text-indigo-600 uppercase tracking-widest mb-4">Automatización</h2>
                    
                    <motion.div
                      role="button"
                      onClick={() => navigate('/autopilot')}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.8 }}
                      className="flex items-center justify-center gap-4 px-6 py-4 rounded-3xl cursor-pointer hover:scale-105 active:scale-95 transition-all relative group"
                      style={{
                        background: isGlobalActive ? 'linear-gradient(145deg, #10b981, #059669)' : '#e0e5ec',
                        boxShadow: isGlobalActive 
                          ? '0 10px 20px rgba(16, 185, 129, 0.4), inset 2px 2px 5px rgba(255,255,255,0.3)'
                          : '6px 6px 12px rgba(163,177,198,0.5), -6px -6px 12px rgba(255,255,255,0.9)'
                      }}
                    >
                      <div className={`p-2 rounded-full ${isGlobalActive ? 'bg-white bg-opacity-20' : 'bg-indigo-100'}`}>
                        <Play size={20} color={isGlobalActive ? '#fff' : '#4f46e5'} className={isGlobalActive ? 'animate-pulse' : ''} />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-black ${isGlobalActive ? 'text-white' : 'text-gray-800'}`}>
                          Configurar Auto-Piloto
                        </span>
                        <span className={`text-[10px] font-bold ${isGlobalActive ? 'text-green-100' : 'text-gray-500'}`}>
                          {isGlobalActive ? 'ACTIVO - Procesando Leads' : 'Clic para abrir'}
                        </span>
                      </div>
                    </motion.div>
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
