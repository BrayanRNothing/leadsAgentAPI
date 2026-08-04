import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useSpring, useTransform } from 'framer-motion';
import { useNavigate, useLocation, Routes, Route } from 'react-router-dom';
import { Database, MapPin, Flame, Play, Send, Zap, Clock, ChevronRight, TrendingUp, Mail, Activity } from 'lucide-react';
import LoginSquare from './LoginSquare';
import ScrapingView from './ScrapingView';
import HistoryView from './HistoryView';
import InegiView from './InegiView';

// Animated number counter
function AnimatedNumber({ value, color }) {
  const [displayed, setDisplayed] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    const diff = value - prev.current;
    const steps = 20;
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(Math.round(prev.current + (diff * i) / steps));
      if (i >= steps) { clearInterval(timer); prev.current = value; }
    }, 20);
    return () => clearInterval(timer);
  }, [value]);
  return <span style={{ color }}>{displayed.toLocaleString()}</span>;
}

// Cooldown Timer display
function CooldownTimer({ lastSentAt, cooldownHours }) {
  const [remaining, setRemaining] = useState(null);
  useEffect(() => {
    if (!lastSentAt || !cooldownHours) return;
    const tick = () => {
      const diff = cooldownHours * 3600000 - (Date.now() - new Date(lastSentAt).getTime());
      setRemaining(diff > 0 ? diff : 0);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastSentAt, cooldownHours]);
  if (remaining === null || remaining <= 0) return null;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="flex items-center gap-1.5 mt-2">
      <Clock size={10} className="text-indigo-400" />
      <span className="text-[10px] font-bold text-indigo-400 tabular-nums">
        Próximo lote en {h > 0 ? `${h}h ` : ''}{m}m {s}s
      </span>
    </div>
  );
}

export default function BentoGrid({ isAuthenticated, onLogin }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ mapsLeads: 0, inegiLeads: 0 });
  const [autoPilotConfig, setAutoPilotConfig] = useState(null);
  const [autoPilotStatus, setAutoPilotStatus] = useState(null);
  const [lastSentAt, setLastSentAt] = useState(null);

  const isGlobalActive = autoPilotStatus?.globalActive || autoPilotConfig?.globalActive || false;
  const isPhase1Active = autoPilotStatus?.phase1Active || autoPilotConfig?.phase1Active || false;
  const isPhase2Active = autoPilotStatus?.phase2Active || autoPilotConfig?.phase2Active || false;
  const isPhase3Active = autoPilotStatus?.phase3Active || autoPilotConfig?.phase3Active || false;

  useEffect(() => {
    const fetchHomeStats = () => {
      fetch('https://leadsagentapi-production.up.railway.app/api/home-stats')
        .then(r => r.json()).then(data => setStats(data)).catch(() => {});
    };
    const checkBot = () => {
      fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/config')
        .then(r => r.json()).then(d => setAutoPilotConfig(prev => JSON.stringify(prev) === JSON.stringify(d) ? prev : d))
        .catch(() => {});
      fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/status')
        .then(r => r.json()).then(d => setAutoPilotStatus(prev => JSON.stringify(prev) === JSON.stringify(d) ? prev : d))
        .catch(() => {});
    };
    fetchHomeStats(); checkBot();
    const interval = setInterval(() => { checkBot(); fetchHomeStats(); }, 4000);
    return () => clearInterval(interval);
  }, [location.pathname]);

  const liveCounts = autoPilotStatus?.counts || {};
  const sentToday = autoPilotStatus?.sentTodayCount || 0;
  const dailyLimit = autoPilotStatus?.dailyLimit || 200;
  const cooldownHours = autoPilotConfig?.batchCooldownHours || 3;
  const sendProgress = Math.min((sentToday / dailyLimit) * 100, 100);
  const inQueue = liveCounts.inQueue || 0;
  const inProcess = (liveCounts.sending || 0) + (liveCounts.sent || 0);
  const responses = (liveCounts.replied || 0) + (liveCounts.interested || 0);

  const nf = '6px 6px 14px rgba(163,177,198,0.55), -6px -6px 14px rgba(255,255,255,0.9)';
  const nfInset = 'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.9)';

  return (
    <div className="relative w-full flex flex-col items-center justify-center min-h-screen py-10 px-4">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={
            <motion.div
              key="home"
              className="w-full flex flex-col items-center gap-8"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}
            >
              <div className="flex flex-col w-full max-w-3xl mx-auto relative z-20 mb-32 pb-10 px-2 sm:px-4 mt-8 pt-10">

                {/* Top right shortcuts */}
                <div className="fixed top-6 right-6 flex flex-col gap-3 z-50">
                  {[
                    { icon: <MapPin size={16} color="#3182ce" />, label: 'Scanner Maps', to: '/search' },
                    { icon: <Database size={16} color="#3182ce" />, label: `BD Maps (${stats.mapsLeads})`, to: '/history/maps' },
                  ].map((btn, i) => (
                    <motion.div key={i} role="button" onClick={() => navigate(btn.to)}
                      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all active:scale-95"
                      style={{ background: '#e0e5ec', boxShadow: nf }}
                      whileHover={{ scale: 1.03, boxShadow: '8px 8px 16px rgba(163,177,198,0.4), -8px -8px 16px rgba(255,255,255,1)' }}
                    >
                      {btn.icon}
                      <span className="text-[10px] sm:text-xs font-bold text-gray-700 uppercase tracking-wide">{btn.label}</span>
                    </motion.div>
                  ))}
                </div>

                <div className="flex flex-col gap-10 w-full mt-12 sm:mt-16">

                  {/* === PIPELINE HEADER === */}
                  <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                    className="flex flex-col items-center gap-1">
                    <h2 className="text-xs sm:text-sm font-black text-teal-600 uppercase tracking-widest text-center">Pipeline Principal</h2>
                    <p className="text-[10px] text-gray-400 font-medium">Sistema de prospección automático Infiniguard</p>
                  </motion.div>

                  {/* === DAILY PROGRESS BAR === */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="w-full rounded-3xl p-5" style={{ background: '#e0e5ec', boxShadow: nf }}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: '#e0e5ec', boxShadow: nfInset }}>
                          <Activity size={14} color="#6366f1" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Enviados hoy</p>
                          <p className="text-sm font-black text-gray-800 leading-tight">
                            <AnimatedNumber value={sentToday} color="#6366f1" /> <span className="text-gray-400 font-medium">/ {dailyLimit}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black" style={{ color: sendProgress >= 100 ? '#10b981' : '#6366f1' }}>
                          {Math.round(sendProgress)}%
                        </span>
                        {isPhase2Active && isGlobalActive && (
                          <CooldownTimer lastSentAt={autoPilotConfig?.updatedAt} cooldownHours={cooldownHours} />
                        )}
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full h-3 rounded-full overflow-hidden" style={{ background: '#e0e5ec', boxShadow: nfInset }}>
                      <motion.div
                        className="h-full rounded-full relative overflow-hidden"
                        style={{ background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${sendProgress}%` }}
                        transition={{ duration: 1, ease: 'easeOut' }}
                      >
                        <div className="absolute inset-0 opacity-40"
                          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)', animation: 'shimmer 2s infinite' }} />
                      </motion.div>
                    </div>
                    <style>{`@keyframes shimmer { 0%{transform:translateX(-100%)} 100%{transform:translateX(200%)} }`}</style>
                  </motion.div>

                  {/* === 3 PIPELINE CARDS === */}
                  <div className="grid grid-cols-3 gap-3 sm:gap-5 w-full">
                    {[
                      {
                        id: 'database', title: 'En Cola', count: inQueue,
                        icon: <Database size={22} />, color: '#3b82f6', glow: 'rgba(59,130,246,0.3)',
                        label: isPhase1Active && isGlobalActive ? (inQueue === 0 ? 'Sin leads' : `Fase 1 activa`) : 'Fase 1 inactiva',
                        active: isPhase1Active && isGlobalActive,
                        route: '/inegi',
                        sublabel: isPhase1Active && isGlobalActive ? `${stats.inegiLeads?.toLocaleString()} en BD` : null
                      },
                      {
                        id: 'process', title: 'En Proceso', count: inProcess,
                        icon: <Send size={22} />, color: '#10b981', glow: 'rgba(16,185,129,0.3)',
                        label: isPhase2Active && isGlobalActive
                          ? ((liveCounts.sending || 0) > 0 ? `Enviando...` : 'Esperando cooldown')
                          : 'Fase 2 inactiva',
                        active: isPhase2Active && isGlobalActive,
                        route: '/history/inegi',
                        sublabel: isPhase2Active && isGlobalActive ? `Lote: ${autoPilotConfig?.batchSize || 25} leads` : null
                      },
                      {
                        id: 'replies', title: 'Respuestas', count: responses,
                        icon: <Flame size={22} />, color: '#f59e0b', glow: 'rgba(245,158,11,0.3)',
                        label: isPhase3Active && isGlobalActive ? 'IA Escuchando' : 'Fase 3 inactiva',
                        active: isPhase3Active && isGlobalActive,
                        route: '/pipeline/inegi',
                        sublabel: isPhase3Active && isGlobalActive ? 'Groq clasificando' : null
                      }
                    ].map((card, idx) => (
                      <motion.div key={card.id}
                        role="button" onClick={() => navigate(card.route)}
                        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 + idx * 0.1, type: 'spring', stiffness: 300, damping: 25 }}
                        whileHover={{ y: -4, boxShadow: `8px 8px 20px rgba(163,177,198,0.5), -8px -8px 20px rgba(255,255,255,1), 0 8px 30px ${card.glow}` }}
                        whileTap={{ scale: 0.97 }}
                        className="relative cursor-pointer rounded-3xl flex flex-col items-center justify-center p-4 overflow-hidden"
                        style={{ background: '#e0e5ec', boxShadow: nf }}
                      >
                        {/* Glow backdrop when active */}
                        {card.active && (
                          <motion.div className="absolute inset-0 rounded-3xl pointer-events-none"
                            style={{ background: `radial-gradient(ellipse at 50% 0%, ${card.glow} 0%, transparent 70%)` }}
                            animate={{ opacity: [0.4, 0.7, 0.4] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                          />
                        )}

                        {/* Icon */}
                        <div className="relative w-11 h-11 rounded-2xl flex items-center justify-center mb-2 shrink-0"
                          style={{ background: '#e0e5ec', boxShadow: nfInset, color: card.color }}>
                          {card.icon}
                          {card.active && (
                            <motion.div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#e0e5ec]"
                              style={{ background: card.color }}
                              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.7, 1] }}
                              transition={{ duration: 1.5, repeat: Infinity }}
                            />
                          )}
                        </div>

                        {/* Title */}
                        <h3 className="text-[11px] sm:text-xs font-black text-gray-700 text-center leading-tight mb-1.5">{card.title}</h3>

                        {/* Count pill */}
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl mb-2"
                          style={{ background: '#e0e5ec', boxShadow: nfInset }}>
                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${card.active && card.count > 0 ? 'animate-pulse' : ''}`}
                            style={{ backgroundColor: card.count > 0 ? card.color : '#a0aec0' }} />
                          <span className="text-sm font-black text-gray-800 tabular-nums">
                            <AnimatedNumber value={card.count} color={card.count > 0 ? card.color : '#9ca3af'} />
                          </span>
                        </div>

                        {/* Status label */}
                        <p className={`text-[9px] sm:text-[10px] font-bold text-center leading-tight px-1 ${card.active ? 'animate-pulse' : 'text-gray-400'}`}
                          style={{ color: card.active ? card.color : undefined }}>
                          {card.label}
                        </p>
                        {card.sublabel && (
                          <p className="text-[8px] sm:text-[9px] text-gray-400 font-medium mt-0.5 text-center">{card.sublabel}</p>
                        )}

                        {/* Connector arrow (not on last) */}
                        {idx < 2 && (
                          <motion.div
                            className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-10 flex items-center justify-center w-6 h-6 rounded-full"
                            style={{ background: '#e0e5ec', boxShadow: nf }}
                            animate={{ x: [0, 3, 0] }}
                            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: idx * 0.3 }}
                          >
                            <ChevronRight size={12} color="#a0aec0" />
                          </motion.div>
                        )}
                      </motion.div>
                    ))}
                  </div>

                  {/* === AUTOPILOT BUTTON === */}
                  <motion.div
                    role="button" onClick={() => navigate('/autopilot')}
                    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="w-full flex items-center justify-between px-6 py-4 rounded-3xl cursor-pointer relative overflow-hidden"
                    style={{
                      background: isGlobalActive ? 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)' : '#e0e5ec',
                      boxShadow: isGlobalActive
                        ? '0 10px 30px rgba(16,185,129,0.4), inset 2px 2px 5px rgba(255,255,255,0.2)'
                        : nf
                    }}
                  >
                    {/* Animated shimmer when active */}
                    {isGlobalActive && (
                      <motion.div className="absolute inset-0 pointer-events-none"
                        style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.15) 50%, transparent 100%)' }}
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    <div className="flex items-center gap-4 z-10">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 ${isGlobalActive ? 'bg-white bg-opacity-20' : ''}`}
                        style={!isGlobalActive ? { background: '#e0e5ec', boxShadow: nfInset } : {}}>
                        <Play size={18} color={isGlobalActive ? '#fff' : '#4f46e5'} className={isGlobalActive ? 'animate-pulse' : ''} />
                      </div>
                      <div>
                        <p className={`text-sm font-black ${isGlobalActive ? 'text-white' : 'text-gray-800'}`}>Configurar Auto-Piloto</p>
                        <p className={`text-[10px] font-bold ${isGlobalActive ? 'text-green-100' : 'text-gray-400'}`}>
                          {isGlobalActive ? 'ACTIVO · Procesando Leads' : 'Clic para abrir configuración'}
                        </p>
                      </div>
                    </div>
                    <div className={`z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black ${isGlobalActive ? 'bg-white bg-opacity-20 text-white' : 'text-indigo-600'}`}
                      style={!isGlobalActive ? { background: '#e0e5ec', boxShadow: nfInset } : {}}>
                      {isGlobalActive ? (
                        <>
                          <Zap size={10} className="animate-pulse" />
                          EN VIVO
                        </>
                      ) : 'PAUSADO'}
                    </div>
                  </motion.div>

                </div>
              </div>
            </motion.div>
          } />

          <Route path="/search" element={
            <motion.div key="expanded-search" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2"><ScrapingView onBack={() => navigate('/')} /></div>
            </motion.div>
          } />

          <Route path="/inegi" element={
            <motion.div key="expanded-inegi" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2"><InegiView onBack={() => navigate('/')} /></div>
            </motion.div>
          } />

          <Route path="/history/maps" element={
            <motion.div key="expanded-hist-maps" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2"><HistoryView onBack={() => navigate('/')} dbMode="maps" /></div>
            </motion.div>
          } />

          <Route path="/history/inegi" element={
            <motion.div key="expanded-hist-inegi" className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-[#e0e5ec]" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}>
              <div className="flex-1 overflow-hidden pt-2"><HistoryView onBack={() => navigate('/')} dbMode="inegi" /></div>
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


