import React, { useState, useEffect } from 'react';
import { ArrowLeft, Play, Square, Settings, Save, AlertCircle } from 'lucide-react';

export default function AutoPilotView({ onBack }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/config');
      const data = await res.json();
      setConfig(data);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('https://leadsagentapi-production.up.railway.app/api/autopilot/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        setFeedback({ type: 'success', msg: 'Configuración guardada correctamente.' });
      } else {
        setFeedback({ type: 'error', msg: 'Error al guardar configuración.' });
      }
    } catch (err) {
      setFeedback({ type: 'error', msg: 'Error de red.' });
    }
    setSaving(false);
  };

  const toggleBot = async () => {
    const endpoint = config.isActive ? 'stop' : 'start';
    try {
      const res = await fetch(`https://leadsagentapi-production.up.railway.app/api/autopilot/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        setConfig(prev => ({ ...prev, isActive: !prev.isActive }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !config) return <div className="p-8 text-center">Cargando Auto-Piloto...</div>;

  return (
    <div className="h-full flex flex-col relative w-full overflow-y-auto p-2 sm:p-4" style={{ background: '#e0e5ec' }}>
      {/* HEADER COMPACTO CON BOTÓN CUADRADO (Estilo Scanner Maps) */}
      <div 
        className="flex items-center gap-4 p-3 mb-3 shrink-0 rounded-2xl"
        style={{
          background: '#e0e5ec',
          boxShadow: '5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)'
        }}
      >
        <button 
          onClick={onBack}
          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 group"
          style={{
            background: '#e0e5ec',
            boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)',
          }}
          onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)'}
          onMouseUp={(e) => e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'}
          onMouseLeave={(e) => e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'}
        >
          <ArrowLeft size={22} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 m-0">Auto-Piloto CRM</h2>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">
            Automatización
          </span>
        </div>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full flex flex-col gap-4 pb-12">
        
        {/* Status Card */}
        <div className="w-full p-4 sm:p-5 rounded-2xl"
             style={{
               background: '#e0e5ec',
               boxShadow: '6px 6px 12px rgba(163,177,198,0.5), -6px -6px 12px rgba(255,255,255,0.9)'
             }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">
                Estado del Bot: 
                <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {config.isActive ? 'ACTIVO (Procesando)' : 'DETENIDO'}
                </span>
              </h2>
              <p className="text-xs text-gray-600 max-w-lg">
                El bot tomará leads de INEGI en bloques de <b>{config.batchSize}</b>, los agregará a tu CRM y enviará correos secuenciales esperando <b>{config.delaySeconds}s</b> entre envíos para evitar filtros de spam.
              </p>
            </div>
            
            <button
              onClick={toggleBot}
              className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white uppercase tracking-wider text-xs transition-all shrink-0"
              style={{
                background: config.isActive ? '#ef4444' : '#10b981',
                boxShadow: config.isActive 
                  ? '4px 4px 10px rgba(239, 68, 68, 0.3)'
                  : '4px 4px 10px rgba(16, 185, 129, 0.3)'
              }}
            >
              {config.isActive ? <><Square fill="white" size={16} /> DETENER BOT</> : <><Play fill="white" size={16} /> INICIAR BOT</>}
            </button>
          </div>
        </div>

        {/* Formulario de Configuración */}
        <form onSubmit={handleSave} className="w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4"
             style={{
               background: '#e0e5ec',
               boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.4), inset -4px -4px 8px rgba(255,255,255,0.8)'
             }}>
          
          <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-300 pb-2">
            <Settings size={18} /> Configuración de Envío
          </h2>

          <div className="flex flex-col sm:flex-row gap-4 w-full">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Leads por lote (Batch Size)</label>
              <input
                type="number"
                required
                min="10"
                max="200"
                value={config.batchSize}
                onChange={e => setConfig({...config, batchSize: e.target.value})}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl"
                style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
              />
            </div>
            
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Espera entre envíos (Segundos)</label>
              <input
                type="number"
                required
                min="5"
                max="300"
                value={config.delaySeconds}
                onChange={e => setConfig({...config, delaySeconds: e.target.value})}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl"
                style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Asunto del Correo</label>
            <input
              type="text"
              required
              value={config.templateSubject}
              onChange={e => setConfig({...config, templateSubject: e.target.value})}
              className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-bold text-gray-700">Cuerpo del Correo (HTML) <span className="text-[10px] font-normal text-gray-500">- Usa {'{{nombre_empresa}}'} como variable</span></label>
            <textarea
              required
              rows="8"
              value={config.templateHtml}
              onChange={e => setConfig({...config, templateHtml: e.target.value})}
              className="w-full bg-transparent border-none outline-none text-gray-800 font-mono text-xs px-3 py-3 rounded-xl resize-y"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
            />
          </div>

          {feedback && (
            <div className={`p-2.5 flex items-center gap-2 rounded-xl text-xs font-medium ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <AlertCircle size={15} /> {feedback.msg}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95"
              style={{
                background: '#e0e5ec',
                boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'
              }}
            >
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar Plantilla y Ajustes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
