import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useScraping } from '../context/ScrapingContext';
import axios from 'axios';
import { Search, Loader2, Download, FileJson, CheckCircle, Phone, Globe, Mail, AlertTriangle, XCircle, Clock, WifiOff, ArrowLeft, Navigation, Plus, Minus, Database, Link as LinkIcon, Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import MapView from './MapView';

// === Sistema de Toast Notifications ===
const TOAST_CONFIGS = {
  ban: {
    bg: 'bg-red-50',
    border: 'border-red-300',
    icon: <XCircle size={18} className="text-red-500 shrink-0" />,
    title: '🚫 IP Bloqueada / CAPTCHA',
    textColor: 'text-red-700',
    titleColor: 'text-red-800',
  },
  warning: {
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    icon: <AlertTriangle size={18} className="text-orange-500 shrink-0" />,
    title: '⚠ Fallo en Lead',
    textColor: 'text-orange-700',
    titleColor: 'text-orange-800',
  },
  timeout: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-300',
    icon: <Clock size={18} className="text-yellow-600 shrink-0" />,
    title: '⏱ Timeout',
    textColor: 'text-yellow-700',
    titleColor: 'text-yellow-800',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: <WifiOff size={18} className="text-blue-500 shrink-0" />,
    title: 'ℹ Info',
    textColor: 'text-blue-700',
    titleColor: 'text-blue-800',
  },
};

function ToastContainer({ toasts, onDismiss }) {
  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => {
          const cfg = TOAST_CONFIGS[t.type] || TOAST_CONFIGS.info;
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 60, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 60, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
              className={`pointer-events-auto flex items-start gap-3 px-4 py-3 rounded-2xl border shadow-lg ${cfg.bg} ${cfg.border}`}
              style={{ boxShadow: '4px 4px 16px rgba(0,0,0,0.1)' }}
            >
              {cfg.icon}
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-xs ${cfg.titleColor}`}>{cfg.title}</p>
                <p className={`text-xs mt-0.5 leading-snug ${cfg.textColor}`}>{t.message}</p>
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={14} />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export default function ScrapingView({ onBack }) {
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const {
    scanPhase, setScanPhase,
    reqFilters, setReqFilters,


    selectedStates, setSelectedStates,
    locationConfirmed, setLocationConfirmed,
    termValidated, setTermValidated,
    validationMessage, setValidationMessage,
    scanStartTime, setScanStartTime,
    eta, setEta,

    termino, setTermino,
    ubicacion, setUbicacion,
    termConfirmed, setTermConfirmed,
    termFeedback, setTermFeedback,
    isScanning, setIsScanning,
    isValidating, setIsValidating,
    synonyms, setSynonyms,
    sources, setSources,
    quantity, setQuantity,
    estimatedTime, setEstimatedTime,
    cooldown, setCooldown,
    showCompletionModal, setShowCompletionModal,
    showStartWarning, setShowStartWarning,
    completionStats, setCompletionStats,
    suggestions, setSuggestions,
    showSuggestions, setShowSuggestions,
    error, setError,
    results, setResults,
    busquedaId, setBusquedaId,
    mapCenter, setMapCenter,
    mapBounds, setMapBounds,
    routePaths, setRoutePaths,
    cityGeoJSON, setCityGeoJSON,
    selectedLead, setSelectedLead,
    loading, setLoading,
    logs, setLogs, pipelineStats, setPipelineStats,
    eventSourceRef,
    safetyTimeoutRef
  } = useScraping();

  const logsEndRef = useRef(null);

  // Diccionario local de categorías conocidas para sugerencias instantáneas
  const KNOWN_TERMS = [
    'Dentistas', 'Restaurantes', 'Hoteles', 'Gimnasios', 'Farmacias', 'Veterinarias',
    'Talleres Automotrices', 'Estéticas', 'Salones de Belleza', 'Panaderías',
    'Ferreterías', 'Abogados', 'Contadores', 'Inmobiliarias', 'Bienes Raíces',
    'Escuelas', 'Colegios', 'Guarderías', 'Supermercados', 'Ópticas',
    'Clínicas Médicas', 'Hospitales', 'Laboratorios Clínicos', 'Pizzerías',
    'Taquerías', 'Carpinterías', 'Electricistas', 'Plomeros', 'Spas',
    'Agencias de Marketing', 'Diseño Gráfico', 'Desarrollo Web', 'Seguros',
    'Agencias de Viajes', 'Psicólogos', 'Nutriólogos', 'Fisioterapeutas',
    'Papelerías', 'Librerías', 'Floristerías', 'Joyerías', 'Zapaterías',
    'Tiendas de Ropa', 'Boutiques', 'Centros Comerciales', 'Autolavados',
    'Gasolineras', 'Hoteles Boutique', 'Posadas', 'Hostales', 'Moteles',
    'Bares', 'Cantinas', 'Cervecerías', 'Cafeterías', 'Heladerías',
    'Agencias de Publicidad', 'Constructoras', 'Arquitectos', 'Ingenieros',
    'Notarías', 'Despachos Jurídicos', 'Aseguradoras', 'Bancos'
  ];

  const getSmartSuggestions = (input) => {
    if (!input || input.trim().length < 2) return [];
    const q = input.toLowerCase();
    return KNOWN_TERMS.filter(t => t.toLowerCase().includes(q)).slice(0, 6);
  };

  const popularChips = ['Dentistas', 'Restaurantes', 'Agencias de Marketing', 'Bienes Raíces', 'Gimnasios'];

  useEffect(() => {
    let baseTimePerLead = 0;
    if (sources.maps) baseTimePerLead += 5;
    if (sources.facebook) baseTimePerLead += 5;
    if (baseTimePerLead === 0) baseTimePerLead = 5;

    const totalSeconds = Math.round(quantity * baseTimePerLead);
    if (totalSeconds < 60) {
      setEstimatedTime(`${totalSeconds} seg`);
    } else {
      const mins = Math.ceil(totalSeconds / 60);
      setEstimatedTime(`${mins} min`);
    }
  }, [sources, quantity]);

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  useEffect(() => {
    let timer;
    if (cooldown > 0 && isScanning) {
      timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [cooldown, isScanning]);


  // Auto-validación de término con debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      if (termino.trim().length >= 3 && !termConfirmed && !isValidating) {
        validateTerm();
      }
    }, 800);
    return () => clearTimeout(handler);
  }, [termino, termConfirmed, isValidating]);

  const [toasts, setToasts] = useState([]);

  const toastCounter = useRef(0);
  const addToast = useCallback((type, message) => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, type, message }]);
    // Auto-dismiss: ban dura 10s, resto 6s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, type === 'ban' ? 10000 : 6000);
  }, []);
  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);


  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  useEffect(() => {
    let interval;
    if (isScanning && scanStartTime) {
      interval = setInterval(() => {
        if (results.length > 0) {
          const elapsed = Date.now() - scanStartTime;
          const msPerLead = elapsed / results.length;
          const remainingLeads = Math.max(0, quantity - results.length);
          const remainingMs = remainingLeads * msPerLead;

          if (remainingMs < 1000) {
            setEta('Completando...');
          } else {
            const totalSecs = Math.floor(remainingMs / 1000);
            const m = Math.floor(totalSecs / 60);
            const s = totalSecs % 60;
            setEta(`Quedan ~${m > 0 ? m + 'm ' : ''}${s}s`);
          }
        } else {
          setEta('Calculando...');
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isScanning, scanStartTime, results.length, quantity]);

  const handleMapClick = async (latlng, predefinedName, geometry, bounds) => {
    if (predefinedName) {
      setSelectedStates(prev => {
        const already = prev.some(s => s.name === predefinedName);
        let next;
        if (already) {
          // deselect
          next = prev.filter(s => s.name !== predefinedName);
        } else {
          next = [...prev, { name: predefinedName, geometry, bounds }];
        }
        // Recalculate combined bounds
        if (next.length === 0) {
          setUbicacion('');
          setMapBounds(null);
          setMapCenter(null);
          setCityGeoJSON(null);
          setLocationConfirmed(false);
        } else {
          // Eliminamos setMapCenter para que la cámara no salte agresivamente,
          // pero DEBEMOS calcular setMapBounds combinado para enviarlo al backend!
          setUbicacion(next.length === 1 ? `${next[0].name}, México` : `${next.length} estados seleccionados`);
          setCityGeoJSON(next[0].geometry);

          let minLat = 90, minLng = 180, maxLat = -90, maxLng = -180;
          next.forEach(s => {
            if (s.bounds) {
              const [[sLat, sLng], [nLat, nLng]] = s.bounds;
              if (sLat < minLat) minLat = sLat;
              if (sLng < minLng) minLng = sLng;
              if (nLat > maxLat) maxLat = nLat;
              if (nLng > maxLng) maxLng = nLng;
            }
          });
          if (minLat < 90) {
            setMapBounds([[minLat, minLng], [maxLat, maxLng]]);
          }

          setLocationConfirmed(true);
        }
        return next;
      });
      return;
    }

    try {
      setUbicacion('Detectando zona...');
      setLocationConfirmed(false);
      setCityGeoJSON(null);
      setMapBounds(null);
      setSelectedStates([]);

      const { data } = await axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${latlng.lat}&lon=${latlng.lng}&format=json&polygon_geojson=1&zoom=8`);
      if (data) {
        setUbicacion(data.display_name);

        let south, north, west, east;
        if (data.boundingbox) {
          south = parseFloat(data.boundingbox[0]);
          north = parseFloat(data.boundingbox[1]);
          west = parseFloat(data.boundingbox[2]);
          east = parseFloat(data.boundingbox[3]);
          // Eliminamos el setMapBounds y setMapCenter aquí también si fue un click
          // para no forzar saltos de cámara
        }

        if (data.geojson && (data.geojson.type === 'Polygon' || data.geojson.type === 'MultiPolygon')) {
          setCityGeoJSON(data.geojson);
        } else if (data.boundingbox) {
          setCityGeoJSON({
            type: "Polygon",
            coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
          });
        }
        setLocationConfirmed(true);
      } else {
        setUbicacion('');
      }
    } catch (e) {
      console.log('Error reverse geocoding location', e);
      setUbicacion('');
    }
  };

  const clearLocation = () => {
    setUbicacion('');
    setCityGeoJSON(null);
    setMapBounds(null);
    setMapCenter(null);
    setLocationConfirmed(false);
    setSelectedStates([]);
  };

  const validateTerm = async () => {
    const term = termino.trim();
    if (term.length < 3) {
      setValidationMessage('Término muy corto. Intenta usar algo más específico.');
      setTermValidated(false);
      setTermConfirmed(false);
      setSynonyms([]);
      return;
    }

    setIsValidating(true);
    setValidationMessage('');
    try {
      const { data } = await axios.post('https://leadsagentapi-production.up.railway.app/api/scraping/validate-query', { termino: term });
      if (data.valid) {
        setTermino(data.improved);
        setValidationMessage(data.message);
        setTermFeedback(data.message);
        setSynonyms(data.synonyms || []);
        setTermConfirmed(true);
        setTermValidated(true);
      } else {
        setValidationMessage(data.message);
        setTermValidated(false);
        setTermConfirmed(false);
        setSynonyms([]);
      }
    } catch (e) {
      setValidationMessage('Error al contactar al servidor para validar.');
      setTermValidated(false);
      setTermConfirmed(false);
      setSynonyms([]);
    } finally {
      setIsValidating(false);
    }
  };

  const handleChipClick = (chip) => {
    setTermino(chip);
    setTermConfirmed(true);
    setTermFeedback("Término validado correctamente.");
    setTermValidated(true);
  };

  const handlePreScraping = (e) => {
    e.preventDefault();
    if (quantity <= 0 || !locationConfirmed || !termValidated) return;
    setShowStartWarning(true);
  };

  const handleScraping = async () => {
    setShowStartWarning(false);
    if (eventSourceRef.current) eventSourceRef.current.close();
    setLoading(true);
    setScanPhase('maps');
    setIsScanning(true);
    setResults([]);
    setLogs([]);
    setPipelineStats({ descartados: 0, conCorreo: 0, totalExtraidos: 0 });
    setBusquedaId(null);
    setCooldown(0);
    setSelectedLead(null);
    setScanStartTime(Date.now());
    setEta('Calculando...');

    const activeSources = Object.keys(sources).filter(k => sources[k]).join(',');
    const params = { termino, ubicacion, fuentes: activeSources, quantity };
    if (mapBounds) {
      params.bounds = JSON.stringify(mapBounds);
    }
    if (selectedStates.length > 0) {
      params.states = selectedStates.map(s => s.name).join(',');
    }

    if (reqFilters.phone) params.reqPhone = 'true';
    if (reqFilters.email) params.reqEmail = 'true';
    if (reqFilters.website) params.reqWeb = 'true';

    const queryParams = new URLSearchParams(params).toString();
    const eventSource = new EventSource(`https://leadsagentapi-production.up.railway.app/api/scraping/search-stream?${queryParams}`);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('connected', (e) => {
      const data = JSON.parse(e.data);
      setBusquedaId(data.busquedaId);
    });

    eventSource.addEventListener('lead', (e) => {
      const lead = JSON.parse(e.data);
      setResults(prev => [...prev, lead]);
    });

    eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, data.message]);

      // Actualizar KPIs
      if (data.message.includes('[Filtro] ❌') || data.message.includes('[Anti-Dup] Ignorado')) {
        setPipelineStats(p => ({ ...p, descartados: p.descartados + 1 }));
      }
      if (data.message.includes('[BD] ✅')) {
        setPipelineStats(p => {
          let hasEmail = data.message.includes('📧') ? 1 : 0;
          return { ...p, totalExtraidos: p.totalExtraidos + 1, conCorreo: p.conCorreo + hasEmail };
        });
      }

      if (data.message.includes('Enfriamiento') || data.message.includes('Cooldown')) {
        const match = data.message.match(/Esperando (\d+)s/i) || data.message.match(/Pausa de (\d+)s/i) || data.message.match(/Cooldown: (\d+)s/i);
        if (match) setCooldown(parseInt(match[1], 10));
      } else {
        setCooldown(0);
      }
    });


    eventSource.addEventListener('phase', (e) => {
      try {
        const data = JSON.parse(e.data);
        setScanPhase(data.phase);
        if (data.phase === 'enrichment') {
          setLogs(['Iniciando análisis profundo de sitios web...']);
        }
      } catch (_) { }
    });

    eventSource.addEventListener('update_lead', (e) => {
      try {
        const updatedLead = JSON.parse(e.data);
        setResults(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      } catch (_) { }
    });

    eventSource.addEventListener('delete_lead', (e) => {
      try {
        const { id } = JSON.parse(e.data);
        setResults(prev => prev.filter(l => l.id !== id));
      } catch (_) { }
    });

    eventSource.addEventListener('alert', (e) => {

      try {
        const data = JSON.parse(e.data);
        addToast(data.type || 'warning', data.message);
      } catch (_) { }
    });

    eventSource.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data);
        const finalCount = data.totalEncontrados || 0;
        setIsScanning(false);
        setScanPhase('idle');
        setLoading(false);
        setCooldown(0);
        eventSource.close();
        if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
        setResults(prev => {
          setCompletionStats({ count: prev.length || finalCount, term: termino });
          return prev;
        });
        setShowCompletionModal(true);
      } catch (_) {
        setIsScanning(false);
        setLoading(false);
        eventSource.close();
      }
    });

    let errorHandled = false;
    eventSource.addEventListener('error', (e) => {
      if (errorHandled) return;
      errorHandled = true;
      setIsScanning(false);
      setLoading(false);
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      try {
        const errorData = JSON.parse(e.data);
        if (errorData.message) {
          setError(errorData.message);
          addToast('ban', errorData.message);
        }
      } catch (parseErr) {
        if (results.length === 0) {
          const msg = 'Error de conexión al buscar leads.';
          // Solo mostramos el toast, no seteamos el error en línea
          addToast('warning', msg);
        } else {
          // Si ya hay resultados, la desconexión es normal (SSE cerrado por el servidor)
          setCompletionStats({ count: results.length, term: termino });
          setShowCompletionModal(true);
        }
      }
      eventSource.close();
    });

    // El timeout de seguridad ha sido removido para permitir búsquedas y reintentos prolongados.
    // safetyTimeoutRef.current = setTimeout(() => { ... }, ...);
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsScanning(false);
    setLoading(false);
    setCooldown(0);
    // Agregamos un ligero delay antes de permitir iniciar de nuevo
    // para evitar que un doble click borre los resultados
    const btn = document.getElementById('btn-iniciar');
    if (btn) {
      btn.disabled = true;
      setTimeout(() => { if (btn) btn.disabled = false; }, 1000);
    }
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(results, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `leads_${termino}_${ubicacion}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col h-full relative px-2 md:px-4 pb-2 md:pb-4 pt-1"
    >
      {/* Modal de Finalización */}
      <AnimatePresence>
        {showCompletionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 backdrop-blur-sm"
            onClick={() => setShowCompletionModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm mx-4 rounded-3xl p-8 flex flex-col items-center gap-4 text-center"
              style={{
                background: '#e0e5ec',
                boxShadow: '12px 12px 24px rgba(163,177,198,0.6), -12px -12px 24px rgba(255,255,255,0.9)'
              }}
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
                className="w-20 h-20 rounded-full flex items-center justify-center bg-green-100 shadow-inner"
              >
                <CheckCircle size={40} className="text-green-500" />
              </motion.div>
              <div>
                <h2 className="text-xl font-black text-textMain mb-1">¡Extracción completada!</h2>
                <p className="text-textLight text-sm">
                  Se encontraron <span className="font-black text-primary">{completionStats.count} leads</span> para
                  <br /><span className="font-semibold text-textMain">"{completionStats.term}"</span>
                </p>
              </div>
              <div className="flex gap-3 w-full mt-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowCompletionModal(false)}
                  className="flex-1 h-11 rounded-xl font-bold text-sm text-textLight"
                  style={{ background: '#e0e5ec', boxShadow: '3px 3px 6px rgba(163,177,198,0.5),-3px -3px 6px rgba(255,255,255,0.8)' }}
                >
                  Ver resultados
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    if (busquedaId) {
                      window.open(`https://leadsagentapi-production.up.railway.app/api/leads/exportar/${busquedaId}`, '_blank');
                    } else {
                      exportJSON();
                    }
                    setShowCompletionModal(false);
                  }}
                  className="flex-1 h-11 rounded-xl font-bold text-sm text-white bg-primary flex items-center justify-center gap-2"
                  style={{ boxShadow: '3px 3px 6px rgba(163,177,198,0.5),-3px -3px 6px rgba(255,255,255,0.8)' }}
                >
                  <Download size={16} /> Descargar CSV
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <AnimatePresence>
        {showFiltersModal && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowFiltersModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#e0e5ec] w-full max-w-sm rounded-[24px] p-6 relative"
              style={{ boxShadow: '8px 8px 16px rgba(163,177,198,0.7), -8px -8px 16px rgba(255,255,255,0.8)' }}
            >
              <button onClick={() => setShowFiltersModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"><Filter size={20} className="text-blue-500" /> Filtros Estrictos</h3>
              <p className="text-xs text-gray-500 mb-6">Descarta automáticamente los leads que no cumplan con estos requisitos de contacto.</p>

              <div className="space-y-4">
                {[
                  { key: 'phone', label: 'Debe tener Teléfono', desc: 'Descarta si no tiene número de teléfono.' },
                  { key: 'email', label: 'Debe tener Correo', desc: 'Descarta si el bot no le encuentra email ni en Maps ni en su web.' },
                ].map(f => (
                  <label key={f.key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-1">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={reqFilters[f.key]}
                        onChange={(e) => setReqFilters(prev => ({ ...prev, [f.key]: e.target.checked }))}
                      />
                      <div className={`w-10 h-5 rounded-full transition-colors ${reqFilters[f.key] ? 'bg-blue-500' : 'bg-gray-300'}`} style={{ boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2)' }}></div>
                      <div className={`absolute left-1 w-3.5 h-3.5 rounded-full bg-white transition-transform ${reqFilters[f.key] ? 'translate-x-4.5' : ''}`} style={{ boxShadow: '1px 1px 3px rgba(0,0,0,0.3)' }}></div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{f.label}</div>
                      <div className="text-xs text-gray-500">{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <button onClick={() => setShowFiltersModal(false)} className="w-full h-10 rounded-xl font-bold text-sm text-gray-700 hover:text-blue-600 transition-all active:scale-95" style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.8)' }}>
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handlePreScraping} className="neu-container flex flex-col xl:flex-row gap-3 mb-3 z-20 relative shrink-0 w-full items-center p-3">
        <div className="flex w-full xl:w-auto xl:flex-1 gap-3 items-center">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
            onClick={() => {
              if (isScanning || loading) {
                if (window.confirm('El bot está escaneando actualmente. Si sales ahora, el proceso se detendrá. ¿Estás seguro de que deseas salir?')) {
                  handleStop();
                  onBack();
                }
              } else {
                onBack();
              }
            }}
            className="flex items-center justify-center w-12 h-12 rounded-xl transition-all shrink-0 text-textLight hover:text-textMain shadow-neu-flat hover:shadow-neu-pressed"
            style={{ background: '#e0e5ec' }}
          >
            <ArrowLeft size={22} />
          </motion.button>
          <div className="flex-1 relative group">
            <div
              className={`w-full flex items-center px-4 h-12 rounded-xl transition-all duration-300 relative overflow-hidden ${locationConfirmed ? 'ring-2 ring-green-400 shadow-inner' : 'bg-background shadow-neu-pressed group-hover:ring-2 group-hover:ring-primary/20'}`}
            >
              {locationConfirmed && (
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="absolute left-0 top-0 h-full bg-green-100 z-0"
                />
              )}
              <Navigation size={16} className={`mr-2 shrink-0 transition-colors relative z-10 ${locationConfirmed ? 'text-green-600' : 'text-textLight'}`} />
              <input
                type="text"
                value={ubicacion}
                readOnly
                placeholder="Selecciona uno o más estados ↓"
                className="w-full bg-transparent outline-none text-textMain text-sm font-medium placeholder-textLight cursor-pointer relative z-10"
              />
              {locationConfirmed && (
                <button type="button" onClick={clearLocation} className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-green-200 text-green-600 transition-colors z-10">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex-1 w-full xl:w-auto relative group">
          <div
            className={`w-full flex items-center px-4 h-12 rounded-xl transition-all duration-300 relative overflow-hidden ${termConfirmed ? 'ring-2 ring-green-400 shadow-inner' : 'bg-background shadow-neu-pressed group-hover:ring-2 group-hover:ring-primary/20'}`}
          >
            {termConfirmed && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute left-0 top-0 h-full bg-green-100 z-0"
              />
            )}
            <Search size={16} className={`mr-2 shrink-0 transition-colors relative z-10 ${termConfirmed ? 'text-green-600' : 'text-textLight'}`} />
            <input
              type="text"
              value={termino}
              onChange={(e) => {
                const val = e.target.value;
                setTermino(val);
                setTermConfirmed(false);
                setTermValidated(false);
                setValidationMessage('');
                const s = getSmartSuggestions(val);
                setSuggestions(s);
                setShowSuggestions(s.length > 0);
              }}
              onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validateTerm(); setShowSuggestions(false); } }}
              placeholder="Ej. Dentistas, Restaurantes..."
              className="w-full bg-transparent outline-none text-textMain text-sm font-medium placeholder-textLight relative z-10"
            />
            {(!termConfirmed && isValidating) && (
              <Loader2 size={16} className="text-primary animate-spin shrink-0 ml-2 relative z-10" />
            )}
            {termConfirmed && (
              <CheckCircle size={18} className="text-green-600 ml-2 shrink-0 relative z-10" />
            )}
          </div>
          <AnimatePresence>
            {showSuggestions && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full left-0 w-full mt-1 z-50 bg-white rounded-xl shadow-[4px_4px_16px_rgba(163,177,198,0.4),-2px_-2px_8px_rgba(255,255,255,0.8)] border border-gray-100 overflow-hidden"
              >
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => {
                      setTermino(s);
                      setShowSuggestions(false);
                      setTermConfirmed(false);
                      setTermValidated(false);
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-textMain hover:bg-green-50 transition-colors text-left border-b border-gray-50 last:border-none"
                  >
                    <Search size={12} className="text-textLight shrink-0" />
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
          <AnimatePresence>
            <div className="absolute top-full left-0 w-full mt-2 px-2 z-30 pointer-events-none">
              {(!termValidated && validationMessage) && (
                <motion.span initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs text-red-500 font-bold block bg-white/90 shadow-sm p-1.5 rounded-lg border border-red-100">{validationMessage}</motion.span>
              )}
            </div>
          </AnimatePresence>
        </div>
        <div className="flex flex-wrap md:flex-nowrap items-center w-full xl:w-auto gap-3">
          <div className={`w-full xl:w-auto flex items-center gap-4 h-12 px-5 rounded-xl transition-all justify-center md:justify-start ${quantity > 0 ? 'bg-green-100 ring-2 ring-green-400 shadow-inner' : 'bg-background shadow-neu-pressed'}`}>
            <div className="flex items-center gap-1">
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                disabled={isScanning || loading || quantity <= 0}
                onClick={() => setQuantity(Math.max(0, quantity - 10))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-textMain hover:bg-black/5 hover:text-red-500 transition-colors disabled:opacity-50"
              >
                <Minus size={16} strokeWidth={3.5} />
              </motion.button>
              <span className="text-sm font-black text-primary w-10 text-center">{quantity}</span>
              <motion.button
                whileTap={{ scale: 0.9 }}
                type="button"
                disabled={isScanning || loading || quantity >= 500}
                onClick={() => setQuantity(Math.min(500, quantity + 10))}
                className="w-8 h-8 rounded-full flex items-center justify-center text-textMain hover:bg-black/5 hover:text-green-500 transition-colors disabled:opacity-50"
              >
                <Plus size={16} strokeWidth={3.5} />
              </motion.button>
            </div>
            <div className="w-[1px] h-6 bg-white/40 shadow-[1px_0_1px_rgba(163,177,198,0.3)] mx-1 hidden md:block"></div>
            <div className="flex items-center gap-1 text-xs font-bold text-textLight shrink-0 hidden md:flex" title="Tiempo estimado">
              <Clock size={12} /> {estimatedTime}
            </div>
            <div className="w-[1px] h-6 bg-white/40 shadow-[1px_0_1px_rgba(163,177,198,0.3)] mx-1 hidden md:block"></div>
            <button
              type="button"
              onClick={() => setShowFiltersModal(true)}
              className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0 relative"
              title="Filtros Estrictos"
            >
              <Filter size={18} className="text-gray-500" />
              {(reqFilters.phone || reqFilters.email) && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
              )}
            </button>
          </div>
          <div className="w-full xl:w-auto shrink-0">
            {!loading ? (
              results.length > 0 ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => {
                    setResults([]);
                    setTermino('');
                    setTermConfirmed(false);
                    setUbicacion('');
                    setLocationConfirmed(false);
                    setQuantity(0);
                    setBusquedaId(null);
                    setMapCenter(null);
                    setMapBounds(null);
                    setRoutePaths([]);
                    setCityGeoJSON(null);
                    setLogs([]);
                    setError('');
                  }}
                  className="w-full xl:w-[180px] relative overflow-hidden h-12 px-2 flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 bg-orange-500 text-white shadow-[3px_3px_6px_rgba(163,177,198,0.5),-3px_-3px_6px_rgba(255,255,255,0.8),inset_0_-2px_6px_rgba(0,0,0,0.1)] hover:bg-orange-600"
                >
                  <XCircle size={18} className="relative z-10" />
                  <span className="relative z-10 tracking-wide uppercase">Limpiar</span>
                </motion.button>
              ) : (
                <motion.button
                  whileHover={locationConfirmed && termValidated && quantity > 0 ? { scale: 1.02 } : {}}
                  whileTap={locationConfirmed && termValidated && quantity > 0 ? { scale: 0.98 } : {}}
                  id="btn-iniciar"
                  type="submit"
                  className={`w-full xl:w-[180px] relative overflow-hidden h-12 px-2 flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-300 ${locationConfirmed && termValidated && quantity > 0 ? 'bg-green-500 text-white shadow-[3px_3px_6px_rgba(163,177,198,0.5),-3px_-3px_6px_rgba(255,255,255,0.8),inset_0_-2px_6px_rgba(0,0,0,0.1)] group' : 'bg-background text-textLight shadow-neu-pressed cursor-not-allowed opacity-70'}`}
                  disabled={!locationConfirmed || !termValidated || quantity <= 0}
                >
                  {locationConfirmed && termValidated && quantity > 0 && (
                    <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-[150%] group-hover:animate-[ping_1.5s_ease-in-out_infinite]"></div>
                  )}
                  <Search size={18} className="relative z-10" />
                  <span className="relative z-10 tracking-wide uppercase">Iniciar</span>
                </motion.button>
              )
            ) : (
              <motion.button
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleStop}
                className="w-full xl:w-[180px] relative overflow-hidden neu-button h-12 px-2 flex items-center justify-center gap-2 transition-all group"
              >
                {cooldown > 0 ? (
                  <>
                    <div className="absolute inset-0 bg-blue-100/50"></div>
                    <Loader2 size={18} className="animate-spin relative z-10 text-primary" />
                    <span className="relative z-10 font-bold text-sm tracking-wide text-primary">ENFRIAMIENTO ({cooldown}s)</span>
                  </>
                ) : (
                  <>
                    <div className="absolute inset-0 bg-background/50 group-hover:bg-red-50 transition-colors shadow-neu-pressed"></div>
                    <Loader2 size={18} className="animate-spin relative z-10 text-textMain group-hover:hidden" />
                    {scanPhase === 'enrichment' ? <span className="relative z-10 font-bold text-sm tracking-wide group-hover:hidden text-textMain">ANALIZANDO LEADS...</span> : <span className="relative z-10 font-bold text-sm tracking-wide group-hover:hidden text-textMain">ESCANEANDO...</span>}
                    <span className="relative z-10 font-bold text-sm tracking-wide hidden group-hover:flex items-center gap-2 text-red-500">
                      <XCircle size={16} /> DETENER
                    </span>
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </form>
      <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-[500px]">
        <div className="flex-1 relative min-h-[300px] lg:min-h-full transition-all duration-500 rounded-2xl overflow-hidden cursor-crosshair"
          style={{
            boxShadow: '9px 9px 18px rgba(163,177,198,0.7), -9px -9px 18px rgba(255,255,255,0.85)',
          }}
        >
          {scanPhase !== 'enrichment' ? (
            <>
              <MapView
                leads={results}
                center={mapCenter}
                bounds={mapBounds}
                isScanning={isScanning}
                cityGeoJSON={cityGeoJSON}
                selectedStates={selectedStates}
                onMapClick={handleMapClick}
                selectedLead={selectedLead}
                logs={logs}
              />
            </>
          ) : (
            <div className="w-full h-full min-h-[450px] flex flex-col gap-3 font-mono text-[11px]">
              {/* Bot Central (Engine) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                    <span className="text-blue-700 font-bold">🤖 Orquestador Principal</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Engine]') || l.includes('[Filtro]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}]`}</span>
                      <span className="break-words flex-1 leading-relaxed text-blue-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">Esperando inicio...</div>}
                </div>
              </div>

              {/* Bot Esteban (Maps) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                    <span className="text-orange-700 font-bold">📍 Bot Esteban (Buscador)</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Maps]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}]`}</span>
                      <span className="break-words flex-1 leading-relaxed text-orange-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">En espera...</div>}
                </div>
              </div>

              {/* Bot Pedrito (Enrichment) */}
              <div className="flex-1 min-h-[120px] flex flex-col bg-white rounded-xl overflow-hidden shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] border border-gray-200">
                <div className="bg-gray-50 px-3 py-1.5 flex items-center justify-between border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-green-700 font-bold">🌐 Bot Pedrito (Analista Web)</span>
                  </div>
                </div>
                <div className="flex-1 p-2 overflow-y-auto bg-white text-gray-700 space-y-1 flex flex-col-reverse">
                  {logs.filter(l => l.includes('[Enrichment]') || l.includes('[BD]')).reverse().map((log, i) => (
                    <div key={i} className="flex gap-2 hover:bg-gray-50 px-1 rounded">
                      <span className="text-gray-400 select-none shrink-0">{`[${new Date().toLocaleTimeString('es-MX', { hour12: false })}]`}</span>
                      <span className="break-words flex-1 leading-relaxed text-green-800">{log}</span>
                    </div>
                  ))}
                  {logs.length === 0 && <div className="text-gray-400 italic px-1">En espera...</div>}
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="w-full lg:w-[420px] p-4 flex flex-col rounded-[24px]" style={{
          background: '#e0e5ec',
          boxShadow: '9px 9px 18px rgba(163,177,198,0.7), -9px -9px 18px rgba(255,255,255,0.85)',
          border: '1px solid rgba(255,255,255,0.3)'
        }}>
          <div className="flex justify-between items-center mb-3 shrink-0">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-textMain">Leads</h3>
                <span className="bg-primary text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">{results.length}</span>
                {isScanning && <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>Buscando...</span>}
              </div>
              {isScanning && (
                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-1">
                  <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-500" /> {pipelineStats.totalExtraidos} Extraídos</span>
                  <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400" /> {pipelineStats.descartados} Descartados</span>
                  <span className="flex items-center gap-1"><Mail size={10} className="text-blue-400" /> {pipelineStats.conCorreo} c/Correo</span>
                </div>
              )}
            </div>
            {results.length > 0 && !isScanning && (
              <div className="flex gap-1.5">
                {busquedaId && (
                  <a href={`https://leadsagentapi-production.up.railway.app/api/leads/exportar/${busquedaId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-black text-textMain uppercase tracking-wide transition-all" style={{ background: '#e0e5ec', boxShadow: '3px 3px 6px rgba(163,177,198,0.5),-3px -3px 6px rgba(255,255,255,0.8)' }}>
                    <Download size={14} className="text-primary" /> Exportar CSV
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 overflow-y-auto space-y-5 px-3 -mx-3 pt-3 pb-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {results.map((lead, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                key={idx}
                onClick={() => setSelectedLead(lead)}
                className={`rounded-[20px] p-4 cursor-pointer transition-all duration-300 relative ${selectedLead?.nombre === lead.nombre
                    ? 'ring-2 ring-primary/50 bg-white/40'
                    : 'hover:-translate-y-0.5 hover:bg-white/20'
                  }`}
                style={{
                  background: '#e0e5ec',
                  boxShadow: selectedLead?.nombre === lead.nombre
                    ? 'inset 4px 4px 8px rgba(163,177,198,0.4), inset -4px -4px 8px rgba(255,255,255,0.9)'
                    : '5px 5px 12px rgba(163,177,198,0.6), -5px -5px 12px rgba(255,255,255,0.9)'
                }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md shadow-sm ${lead.fuente === 'Facebook' || lead.fuente === 'Social' ? 'bg-blue-500 text-white' :
                      lead.fuente === 'LinkedIn' ? 'bg-indigo-500 text-white' :
                        'bg-green-500 text-white'
                    }`}>{lead.fuente || 'Maps'}</span>
                  {(lead.rating || lead.calificacion) && (
                    <div className="flex items-center gap-1.5 bg-white/50 px-2 py-0.5 rounded-full shadow-sm">
                      <span className="text-yellow-500 text-sm">★</span>
                      <span className="text-[11px] font-black text-gray-700">{lead.rating || lead.calificacion}</span>
                      {lead.reviews && <span className="text-[10px] text-gray-400 font-bold">({lead.reviews})</span>}
                    </div>
                  )}
                </div>
                <div className="mb-3">
                  <h4 className={`font-black text-gray-800 leading-tight mb-1 pr-2 line-clamp-2 ${(lead.fuente === 'Facebook' || lead.fuente === 'Social') ? 'text-[13px]' : 'text-[15px]'}`}>
                    {lead.nombre}
                  </h4>
                  {lead.categoria && (
                    <span className="text-[10px] font-bold uppercase tracking-wider text-primary/80 block">
                      {lead.categoria}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-gray-300/30">
                  <div className="flex items-center gap-2.5 group">
                    <Phone size={13} className={`${lead.telefono ? 'text-primary/70 group-hover:text-primary' : 'text-gray-400'} transition-colors shrink-0`} />
                    {lead.telefono ? (
                      <span className="text-xs font-bold text-gray-600">{String(lead.telefono).replace(/^[^a-zA-Z0-9+]+/, '')}</span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400 italic">No encontrado</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 group">
                    <Mail size={13} className={`${lead.correo ? 'text-rose-400 group-hover:text-rose-500' : 'text-gray-400'} transition-colors shrink-0`} />
                    {lead.correo ? (
                      <span className="text-xs font-bold text-gray-600 truncate">{lead.correo}</span>
                    ) : (
                      <span className="text-xs font-medium text-gray-400 italic">No encontrado</span>
                    )}
                  </div>
                  {(lead.fuente === 'Facebook' || lead.fuente === 'Social') ? (
                    lead.sitioWeb ? (
                      <div className="flex items-center gap-2.5 group bg-blue-50/50 p-2 rounded-lg border border-blue-100/50 mt-1">
                        <LinkIcon size={12} className="text-blue-400 shrink-0" />
                        <a href={lead.sitioWeb} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-blue-500 hover:text-blue-600 truncate" onClick={e => e.stopPropagation()}>
                          Ver Perfil
                        </a>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2.5 group mt-1 p-2">
                        <LinkIcon size={12} className="text-gray-400 shrink-0" />
                        <span className="text-[11px] font-medium text-gray-400 italic">No encontrado</span>
                      </div>
                    )
                  ) : (
                    <div className="flex items-center gap-2.5 group">
                      <Globe size={13} className={`${lead.sitioWeb ? 'text-blue-400 group-hover:text-blue-500' : 'text-gray-400'} transition-colors shrink-0`} />
                      {lead.sitioWeb ? (
                        <a href={lead.sitioWeb} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-500 hover:text-blue-600 hover:underline truncate" onClick={e => e.stopPropagation()}>
                          {String(lead.sitioWeb).replace(/^https?:\/\//, '').replace(/\/.*$/, '')}
                        </a>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 italic">No encontrado</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-start gap-2.5 group">
                    <Navigation size={13} className="text-gray-400 mt-0.5 shrink-0" />
                    {lead.direccion ? (
                      <span className="text-[11px] font-medium text-gray-500 leading-snug line-clamp-2">
                        {String(lead.direccion).replace(/^[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]+/, '').trim()}
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-gray-400 italic">No encontrada</span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
            {isScanning && results.length === 0 && (
              <div className="flex flex-col items-center justify-center p-8 text-textLight h-full min-h-[200px]">
                <div className="relative w-16 h-16 flex items-center justify-center mb-4">
                  <div className="absolute inset-0 border-4 border-t-primary border-r-primary/30 border-b-transparent border-l-transparent rounded-full animate-[spin_1.5s_linear_infinite]"></div>
                  <div className="absolute inset-2 border-4 border-b-blue-400 border-l-blue-400/30 border-t-transparent border-r-transparent rounded-full animate-[spin_2s_linear_infinite_reverse]"></div>
                  <Database size={20} className="text-primary animate-pulse" />
                </div>
                <p className="text-sm font-bold text-gray-600 text-center">Procesando y filtrando lista...</p>
                <p className="text-xs mt-2 opacity-70 text-center max-w-[200px] leading-relaxed">
                  Descartando negocios sin datos de contacto y validando los límites de la zona seleccionada.
                </p>
              </div>
            )}
            {!isScanning && results.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-textLight">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px rgba(163,177,198,0.5),-4px -4px 8px rgba(255,255,255,0.8)' }}>
                  <Search size={28} className="opacity-30" />
                </div>
                <p className="text-sm font-semibold">Sin resultados aún</p>
                <p className="text-xs mt-1 opacity-60 text-center">Selecciona una ubicación y comienza la búsqueda</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {showStartWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
              onClick={() => setShowStartWarning(false)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-background w-full max-w-md rounded-[24px] p-6 relative shadow-[20px_20px_40px_rgba(163,177,198,0.6),-20px_-20px_40px_rgba(255,255,255,0.8)] border border-white/50 z-10 flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mb-4 shadow-inner">
                <AlertTriangle size={32} className="text-orange-500" />
              </div>
              <h3 className="text-xl font-black text-gray-800 mb-2">Aviso Importante</h3>
              <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                El proceso de extracción de <span className="font-bold">{quantity} leads</span> tomará tiempo.
                El bot necesitará navegar y extraer correos de varios sitios web.
              </p>
              <ul className="text-left text-xs font-medium text-gray-500 space-y-2 mb-6 w-full bg-white/40 p-4 rounded-xl shadow-inner border border-white/30">
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" /> Es posible que se abran ventanas emergentes (es el bot trabajando, es completamente normal).</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" /> No cierres ni recargues esta página.</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" /> Puedes ver el progreso en vivo en el mapa.</li>
                <li className="flex items-start gap-2"><CheckCircle size={14} className="text-green-500 shrink-0 mt-0.5" /> Pausas anti-bloqueo ocurrirán automáticamente.</li>
              </ul>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setShowStartWarning(false)}
                  className="flex-1 py-3 rounded-xl font-bold text-gray-500 bg-background shadow-neu-flat active:shadow-neu-pressed transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleScraping}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-green-500 shadow-[4px_4px_10px_rgba(163,177,198,0.4),-4px_-4px_10px_rgba(255,255,255,0.8)] active:shadow-inner transition-all"
                >
                  Estoy listo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
