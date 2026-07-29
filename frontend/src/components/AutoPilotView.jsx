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
      const res = await fetch('http://localhost:3001/api/autopilot/config');
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
      const res = await fetch('http://localhost:3001/api/autopilot/config', {
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
      const res = await fetch(`http://localhost:3001/api/autopilot/${endpoint}`, { method: 'POST' });
      if (res.ok) {
        setConfig(prev => ({ ...prev, isActive: !prev.isActive }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading || !config) return <div className="p-8 text-center">Cargando Auto-Piloto...</div>;

  return (
    <div className="h-full flex flex-col relative w-full overflow-y-auto" style={{ background: '#e0e5ec' }}>
      {/* Header Neumórfico */}
      <div className="sticky top-0 z-20 px-4 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(224, 229, 236, 0.8)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.3)',
          boxShadow: '0 4px 12px rgba(163,177,198,0.1)'
        }}
      >
        <button
          onClick={onBack}
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
          style={{
            background: '#e0e5ec',
            boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'
          }}
        >
          <ArrowLeft size={20} color="#4a5568" />
        </button>
        <h1 className="text-xl font-black text-gray-800 tracking-tight">Auto-Piloto CRM</h1>
        <div className="w-10"></div>
      </div>

      <div className="flex-1 p-4 sm:p-6 max-w-4xl mx-auto w-full flex flex-col gap-6 pb-20">
        
        {/* Status Card */}
        <div className="w-full p-6 rounded-3xl"
             style={{
               background: '#e0e5ec',
               boxShadow: '8px 8px 16px rgba(163,177,198,0.5), -8px -8px 16px rgba(255,255,255,0.9)'
             }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-2 flex items-center gap-2">
                Estado del Bot: 
                <span className={`px-3 py-1 rounded-full text-sm ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {config.isActive ? 'ACTIVO (Procesando)' : 'DETENIDO'}
                </span>
              </h2>
              <p className="text-sm text-gray-600 max-w-md">
                El bot tomará leads de INEGI en bloques de <b>{config.batchSize}</b>, los agregará a tu CRM y enviará correos secuenciales esperando <b>{config.delaySeconds}s</b> entre envíos para evitar filtros de spam.
              </p>
            </div>
            
            <button
              onClick={toggleBot}
              className="flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-black text-white uppercase tracking-wider transition-all min-w-[200px]"
              style={{
                background: config.isActive ? '#ef4444' : '#10b981',
                boxShadow: config.isActive 
                  ? '6px 6px 12px rgba(239, 68, 68, 0.3), -6px -6px 12px rgba(255,255,255,0.8)'
                  : '6px 6px 12px rgba(16, 185, 129, 0.3), -6px -6px 12px rgba(255,255,255,0.8)'
              }}
            >
              {config.isActive ? <><Square fill="white" size={20} /> DETENER BOT</> : <><Play fill="white" size={20} /> INICIAR BOT</>}
            </button>
          </div>
        </div>

        {/* Formulario de Configuración */}
        <form onSubmit={handleSave} className="w-full p-6 rounded-3xl flex flex-col gap-6"
             style={{
               background: '#e0e5ec',
               boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.4), inset -4px -4px 8px rgba(255,255,255,0.8)'
             }}>
          
          <h2 className="text-lg font-black text-gray-800 flex items-center gap-2 border-b border-gray-300 pb-2">
            <Settings size={20} /> Configuración de Envío
          </h2>

          <div className="flex flex-col sm:flex-row gap-6 w-full">
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Leads por lote (Batch Size)</label>
              <input
                type="number"
                required
                min="10"
                max="200"
                value={config.batchSize}
                onChange={e => setConfig({...config, batchSize: e.target.value})}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium px-4 py-3 rounded-xl"
                style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
              />
            </div>
            
            <div className="flex-1 flex flex-col gap-2">
              <label className="text-sm font-bold text-gray-700">Espera entre envíos (Segundos)</label>
              <input
                type="number"
                required
                min="5"
                max="300"
                value={config.delaySeconds}
                onChange={e => setConfig({...config, delaySeconds: e.target.value})}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium px-4 py-3 rounded-xl"
                style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">Asunto del Correo</label>
            <input
              type="text"
              required
              value={config.templateSubject}
              onChange={e => setConfig({...config, templateSubject: e.target.value})}
              className="w-full bg-transparent border-none outline-none text-gray-800 font-medium px-4 py-3 rounded-xl"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-bold text-gray-700">Cuerpo del Correo (HTML) <span className="text-xs font-normal text-gray-500">- Usa {'{{nombre_empresa}}'} como variable</span></label>
            <textarea
              required
              rows="15"
              value={config.templateHtml}
              onChange={e => setConfig({...config, templateHtml: e.target.value})}
              className="w-full bg-transparent border-none outline-none text-gray-800 font-mono text-sm px-4 py-4 rounded-xl resize-y"
              style={{ boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)' }}
            />
          </div>

          {feedback && (
            <div className={`p-3 flex items-center gap-2 rounded-xl text-sm font-medium ${feedback.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <AlertCircle size={16} /> {feedback.msg}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-indigo-700 transition-all active:scale-95"
              style={{
                background: '#e0e5ec',
                boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'
              }}
            >
              <Save size={18} /> {saving ? 'Guardando...' : 'Guardar Plantilla y Ajustes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
