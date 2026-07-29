import React, { useState, useEffect } from "react";
import { ArrowLeft, Save, AlertCircle, Database, Send, BotMessageSquare, Building2, Mail, Power, Settings } from "lucide-react";

const API = "https://leadsagentapi-production.up.railway.app";

export default function AutoPilotView({ onBack }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [gmailConnected, setGmailConnected] = useState(false);

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API}/api/autopilot/config`);
      setConfig(await res.json());

      const gmailRes = await fetch(`${API}/api/gmail/status`);
      const gmailData = await gmailRes.json();
      setGmailConnected(gmailData.isConnected);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const connectGmail = async () => {
    try {
      const res = await fetch(`${API}/api/gmail/auth`);
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
      else setFeedback({ type: 'error', msg: data.error || 'Error al conectar' });
    } catch (err) { setFeedback({ type: 'error', msg: 'Error al conectar' }); }
  };

  const disconnectGmail = async () => {
    try {
      await fetch(`${API}/api/gmail/disconnect`, { method: 'POST' });
      setGmailConnected(false);
      setFeedback({ type: 'success', msg: 'Gmail desconectado' });
    } catch (err) { setFeedback({ type: 'error', msg: 'Error al desconectar' }); }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true); setFeedback(null);
    try {
      const res = await fetch(`${API}/api/autopilot/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      setFeedback(res.ok ? { type: "success", msg: "Configuracion guardada." } : { type: "error", msg: "Error al guardar." });
    } catch { setFeedback({ type: "error", msg: "Error de red." }); }
    setSaving(false);
  };

  if (loading || !config) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

  const nf = "4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)";
  const np = "inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)";
  const ni = "inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)";

  return (
    <div className="h-full flex flex-col relative w-full overflow-y-auto p-2 sm:p-4" style={{ background: "#e0e5ec" }}>
      
      {/* HEADER COMPACTO Y LIMPIO */}
      <div className="flex items-center gap-4 p-3 mb-6 shrink-0 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: "5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)" }}>
        <button onClick={onBack} className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 group" style={{ background: "#e0e5ec", boxShadow: nf }}
          onMouseDown={e => e.currentTarget.style.boxShadow = np} onMouseUp={e => e.currentTarget.style.boxShadow = nf} onMouseLeave={e => e.currentTarget.style.boxShadow = nf}>
          <ArrowLeft size={22} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex-1 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 m-0">Panel de Automatizacion</h2>
          
          {/* SWITCH GLOBAL */}
          <div className="flex items-center gap-3 bg-gray-200 px-4 py-2 rounded-xl" style={{ boxShadow: ni }}>
            <span className="text-sm font-bold text-gray-700">Sistema Global</span>
            <label className="relative cursor-pointer flex items-center">
              <input type="checkbox" className="sr-only" checked={config.globalActive} onChange={e => setConfig({ ...config, globalActive: e.target.checked })} />
              <div className={`w-12 h-6 rounded-full transition-colors ${config.globalActive ? "bg-indigo-600" : "bg-gray-400"}`} style={{ boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.3)" }} />
              <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform ${config.globalActive ? "translate-x-6" : ""}`} style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.4)" }} />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex-1 max-w-5xl mx-auto w-full flex flex-col gap-6 pb-12">
        
        {/* EXPLICACION FASES */}
        <div className="p-4 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: nf }}>
          <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2"><Settings size={16}/> Flujo de Trabajo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* FASE 1 */}
            <div className={`p-4 rounded-xl border-l-4 transition-all ${config.phase1Active ? "border-indigo-500 opacity-100" : "border-gray-300 opacity-60"}`} style={{ background: "#e0e5ec", boxShadow: config.phase1Active ? np : nf }}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 flex items-center gap-1.5"><Database size={14}/> Fase 1</h4>
                <label className="relative cursor-pointer">
                  <input type="checkbox" className="sr-only" disabled={!config.globalActive} checked={config.phase1Active} onChange={e => setConfig({ ...config, phase1Active: e.target.checked })} />
                  <div className={`w-8 h-4 rounded-full transition-colors ${config.phase1Active && config.globalActive ? "bg-indigo-500" : "bg-gray-300"}`} />
                  <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.phase1Active ? "translate-x-4" : ""}`} />
                </label>
              </div>
              <p className="text-xs text-gray-600 font-bold mb-1">Extraccion INEGI</p>
              <p className="text-[10px] text-gray-500 leading-tight">Busca leads en la base de datos INEGI y los pasa a la lista "En Proceso".</p>
            </div>

            {/* FASE 2 */}
            <div className={`p-4 rounded-xl border-l-4 transition-all ${config.phase2Active ? "border-indigo-500 opacity-100" : "border-gray-300 opacity-60"}`} style={{ background: "#e0e5ec", boxShadow: config.phase2Active ? np : nf }}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 flex items-center gap-1.5"><Send size={14}/> Fase 2</h4>
                <label className="relative cursor-pointer">
                  <input type="checkbox" className="sr-only" disabled={!config.globalActive} checked={config.phase2Active} onChange={e => setConfig({ ...config, phase2Active: e.target.checked })} />
                  <div className={`w-8 h-4 rounded-full transition-colors ${config.phase2Active && config.globalActive ? "bg-indigo-500" : "bg-gray-300"}`} />
                  <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.phase2Active ? "translate-x-4" : ""}`} />
                </label>
              </div>
              <p className="text-xs text-gray-600 font-bold mb-1">Envio y Monitoreo</p>
              <p className="text-[10px] text-gray-500 leading-tight">Envia correos a los leads en proceso y monitorea la bandeja esperando respuestas.</p>
            </div>

            {/* FASE 3 */}
            <div className={`p-4 rounded-xl border-l-4 transition-all ${config.phase3Active ? "border-indigo-500 opacity-100" : "border-gray-300 opacity-60"}`} style={{ background: "#e0e5ec", boxShadow: config.phase3Active ? np : nf }}>
              <div className="flex justify-between items-start mb-2">
                <h4 className="font-bold text-gray-800 flex items-center gap-1.5"><BotMessageSquare size={14}/> Fase 3</h4>
                <label className="relative cursor-pointer">
                  <input type="checkbox" className="sr-only" disabled={!config.globalActive} checked={config.phase3Active} onChange={e => setConfig({ ...config, phase3Active: e.target.checked })} />
                  <div className={`w-8 h-4 rounded-full transition-colors ${config.phase3Active && config.globalActive ? "bg-indigo-500" : "bg-gray-300"}`} />
                  <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${config.phase3Active ? "translate-x-4" : ""}`} />
                </label>
              </div>
              <p className="text-xs text-gray-600 font-bold mb-1">Clasificacion IA</p>
              <p className="text-[10px] text-gray-500 leading-tight">Lee las respuestas con IA, clasifica al lead y responde o agenda automaticamente.</p>
            </div>

          </div>
          {!config.globalActive && (
            <div className="mt-3 text-center text-xs text-red-500 font-bold">El sistema global esta APAGADO. Ninguna fase se ejecutara.</div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CONFIGURACION DE ENVIO (FASE 1 Y 2) */}
          <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: "#e0e5ec", boxShadow: nf }}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-300 pb-2 flex items-center gap-2"><Send size={16}/> Parametros de Envio (Fase 1 y 2)</h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700">Leads por lote</label>
                <input type="number" required min="10" max="200" value={config.batchSize} onChange={e => setConfig({ ...config, batchSize: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-gray-700">Espera entre envios (seg)</label>
                <input type="number" required min="5" max="300" value={config.delaySeconds} onChange={e => setConfig({ ...config, delaySeconds: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-indigo-600">Limite diario</label>
                <input type="number" required min="10" max="5000" value={config.dailyLimit || 200} onChange={e => setConfig({ ...config, dailyLimit: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-indigo-700 font-bold text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-bold text-amber-600">Cooldown entre lotes (hrs)</label>
                <input type="number" required min="0.5" max="24" step="0.5" value={config.batchCooldownHours || 4} onChange={e => setConfig({ ...config, batchCooldownHours: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-amber-700 font-bold text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
            </div>
            {config.dailyLimit && config.sentTodayCount !== undefined && (
              <div className="flex items-center gap-3 p-2 rounded-xl" style={{ boxShadow: ni }}>
                <div className="flex-1 bg-gray-300 rounded-full h-2 overflow-hidden">
                  <div className="h-2 rounded-full bg-indigo-500 transition-all"
                    style={{ width: `${Math.min(100, (config.sentTodayCount / config.dailyLimit) * 100)}%` }} />
                </div>
                <span className="text-[11px] font-bold text-gray-600 shrink-0">
                  {config.sentTodayCount || 0} / {config.dailyLimit} hoy
                </span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700">Asunto del Correo</label>
              <input type="text" required value={config.templateSubject} onChange={e => setConfig({ ...config, templateSubject: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700">Cuerpo del Correo (HTML)</label>
              <textarea required rows="6" value={config.templateHtml} onChange={e => setConfig({ ...config, templateHtml: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-mono text-[10px] px-3 py-3 rounded-xl resize-y" style={{ boxShadow: ni }} />
            </div>
          </div>

          {/* PERFIL EMPRESA Y NOTIFICACIONES (FASE 3) */}
          <div className="p-5 rounded-2xl flex flex-col gap-4" style={{ background: "#e0e5ec", boxShadow: nf }}>
            <h3 className="text-sm font-bold text-gray-800 border-b border-gray-300 pb-2 flex items-center gap-2"><Building2 size={16}/> Conocimiento de la IA (Fase 3)</h3>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700">Nombre de la Empresa</label>
              <input type="text" value={config.companyName || ""} onChange={e => setConfig({ ...config, companyName: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700">Servicios y Respuestas a Preguntas (FAQ)</label>
              <textarea rows="4" value={config.companyContext || ""} onChange={e => setConfig({ ...config, companyContext: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 text-[10px] px-3 py-3 rounded-xl resize-y" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700">Disponibilidad para Citas</label>
              <textarea rows="2" value={config.availability || ""} onChange={e => setConfig({ ...config, availability: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 text-[10px] px-3 py-3 rounded-xl resize-y" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-gray-700 text-indigo-700 flex items-center gap-1"><Mail size={12}/> Alertas al Jefe</label>
              <input type="email" placeholder="jefe@empresa.com" value={config.notifyEmail || ""} onChange={e => setConfig({ ...config, notifyEmail: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
          </div>
        </div>

        {/* CONTROLES FINALES */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!gmailConnected ? (
              <button type="button" onClick={connectGmail} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-blue-600 hover:text-blue-700 transition-all active:scale-95" style={{ background: "#e0e5ec", boxShadow: nf }}>
                <Mail size={14} /> Conectar Gmail (OAuth)
              </button>
            ) : (
              <button type="button" onClick={disconnectGmail} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 transition-all active:scale-95" style={{ background: "#e0e5ec", boxShadow: nf }}>
                <Mail size={14} /> Desconectar Gmail
              </button>
            )}
            {gmailConnected && <span className="text-xs font-bold text-green-600 px-3 py-1 bg-green-100 rounded-full">Gmail Conectado ✓</span>}
          </div>

          <div className="flex items-center gap-3">
            {feedback && (
              <div className={`px-3 py-2 flex items-center gap-2 rounded-xl text-xs font-bold ${feedback.type === "success" ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}>
                <AlertCircle size={14} /> {feedback.msg}
              </div>
            )}
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95 hover:text-indigo-800" style={{ background: "#e0e5ec", boxShadow: nf }}>
              <Save size={16} /> {saving ? "Guardando..." : "Guardar Cambios"}
            </button>
          </div>
        </div>

      </form>
    </div>
  );
}
