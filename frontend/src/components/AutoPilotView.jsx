import React, { useState, useEffect, useRef } from "react";
import { ArrowLeft, Save, AlertCircle, Database, Send, BotMessageSquare, Mail, Settings, Bot, Activity, CheckCircle2, Users, Inbox } from "lucide-react";

const API = "https://leadsagentapi-production.up.railway.app";

export default function AutoPilotView({ onBack }) {
  const [config, setConfig] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    fetchConfig();
    startPolling();
    return () => stopPolling();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API}/api/autopilot/config`);
      setConfig(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API}/api/autopilot/status`);
      if (res.ok) {
        const data = await res.json();
        setStatus(prev => {
          if (!prev) return data;
          return JSON.stringify(prev) === JSON.stringify(data) ? prev : data;
        });
      }
    } catch (_) {
      // Fallo silencioso de red
    }
  };

  const startPolling = () => {
    fetchStatus();
    pollRef.current = setInterval(fetchStatus, 4000);
  };

  const stopPolling = () => {
    if (pollRef.current) clearInterval(pollRef.current);
  };

  const saveConfig = async (toSave, showFeedback = false) => {
    setSaving(true);
    try {
      const res = await fetch(`${API}/api/autopilot/config`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave)
      });
      if (!res.ok) throw new Error("save failed");
      if (toSave.globalActive) {
        await fetch(`${API}/api/autopilot/start`, { method: "POST" });
      } else {
        await fetch(`${API}/api/autopilot/stop`, { method: "POST" });
      }
      await fetchStatus();
      if (showFeedback) setFeedback({ type: "success", msg: "Configuracion guardada." });
    } catch {
      if (showFeedback) setFeedback({ type: "error", msg: "Error al guardar." });
    }
    setSaving(false);
  };

  const toggleGlobal = (val) => {
    const next = { ...config, globalActive: val };
    setConfig(next);
    saveConfig(next, false);
  };

  const togglePhase = (phase, val) => {
    const next = { ...config, [phase]: val };
    setConfig(next);
    saveConfig(next, false);
  };

  const handleSave = (e) => {
    e.preventDefault();
    saveConfig(config, true);
  };

  if (loading || !config) return (
    <div className="h-full flex items-center justify-center" style={{ background: "#e0e5ec" }}>
      <div className="text-gray-500 font-bold animate-pulse">Cargando...</div>
    </div>
  );

  const nf = "4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)";
  const np = "inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)";
  const ni = "inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)";

  const isActive = status?.globalActive && status?.isRunning;
  const counts = status?.counts || {};

  const StatBox = ({ icon, label, value, color }) => (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl" style={{ background: "#e0e5ec", boxShadow: ni }}>
      <div className={`${color} mb-0.5`}>{icon}</div>
      <span className="text-lg font-black text-gray-800">{value ?? "0"}</span>
      <span className="text-[10px] font-bold text-gray-500 text-center leading-tight">{label}</span>
    </div>
  );

  const Toggle = ({ checked, onChange, disabled }) => (
    <label className="relative cursor-pointer flex items-center">
      <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} disabled={disabled} />
      <div className={`w-8 h-4 rounded-full transition-colors ${checked && !disabled ? "bg-indigo-500" : "bg-gray-300"}`}
        style={{ boxShadow: "inset 1px 1px 3px rgba(0,0,0,0.2)" }} />
      <div className={`absolute left-0.5 top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        style={{ boxShadow: "1px 1px 2px rgba(0,0,0,0.3)" }} />
    </label>
  );

  return (
    <div className="h-full flex flex-col w-full overflow-y-auto p-2 sm:p-4" style={{ background: "#e0e5ec" }}>

      <div className="flex items-center gap-3 p-3 mb-4 shrink-0 rounded-2xl"
        style={{ background: "#e0e5ec", boxShadow: "5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)" }}>
        <button onClick={onBack} className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 group"
          style={{ background: "#e0e5ec", boxShadow: nf }}
          onMouseDown={e => e.currentTarget.style.boxShadow = np}
          onMouseUp={e => e.currentTarget.style.boxShadow = nf}
          onMouseLeave={e => e.currentTarget.style.boxShadow = nf}>
          <ArrowLeft size={20} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex-1 flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-gray-800 m-0">Panel de Automatizacion</h2>
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ boxShadow: ni }}>
            <div className={`w-2 h-2 rounded-full transition-colors ${isActive ? "bg-green-500 animate-pulse" : "bg-gray-400"}`} />
            <span className="text-xs font-bold text-gray-700">Sistema Global</span>
            <label className="relative cursor-pointer flex items-center ml-1">
              <input type="checkbox" className="sr-only" checked={config.globalActive} onChange={e => toggleGlobal(e.target.checked)} />
              <div className={`w-11 h-6 rounded-full transition-colors duration-300 ${config.globalActive ? "bg-indigo-600" : "bg-gray-400"}`}
                style={{ boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.3)" }} />
              <div className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 ${config.globalActive ? "translate-x-5" : ""}`}
                style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.4)" }} />
            </label>
          </div>
        </div>
      </div>

      <form onSubmit={handleSave} className="flex-1 max-w-5xl mx-auto w-full flex flex-col gap-4 pb-12">

        <div className="p-4 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: nf }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-black text-gray-700 flex items-center gap-2">
              <Activity size={13} className={isActive ? "text-green-500" : "text-gray-400"} />
              {isActive ? "Sistema activo — datos en vivo cada 4s" : "Sistema detenido"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={async () => {
                  if(window.confirm("¿Seguro que deseas marcar todos los leads pendientes en cola como ENVIADOS? Usa esto solo si hubo un error y se quedaron atascados.")) {
                    try {
                      const res = await fetch(`${API}/api/autopilot/clear-queue`, { method: 'POST' });
                      const data = await res.json();
                      setFeedback({ type: "success", msg: data.message });
                      fetchStatus();
                    } catch (e) {
                      setFeedback({ type: "error", msg: "Error al limpiar cola" });
                    }
                  }
                }}
                className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors"
              >
                Limpiar Cola Atascada
              </button>
              {status && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                  {status.sentTodayCount}/{status.dailyLimit} enviados hoy
                </span>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
            <StatBox icon={<Database size={15}/>} label="En Cola" value={counts.inQueue} color="text-blue-500" />
            <StatBox icon={<Send size={15}/>} label="Enviando..." value={counts.sending} color="text-yellow-500" />
            <StatBox icon={<CheckCircle2 size={15}/>} label="Enviados" value={counts.sent} color="text-indigo-500" />
            <StatBox icon={<Inbox size={15}/>} label="Respondieron" value={counts.replied} color="text-amber-500" />
            <StatBox icon={<Users size={15}/>} label="Interesados" value={counts.interested} color="text-orange-500" />
            <StatBox icon={<Activity size={15}/>} label="Clasificados" value={counts.classified} color="text-green-500" />
            <StatBox icon={<AlertCircle size={15}/>} label="Descartados" value={counts.discarded} color="text-red-500" />
          </div>
          {status?.dailyLimit > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                <div className="h-full bg-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, ((status.sentTodayCount || 0) / status.dailyLimit) * 100)}%` }} />
              </div>
              <span className="text-[10px] text-gray-500 font-bold shrink-0">
                {Math.round(((status.sentTodayCount || 0) / status.dailyLimit) * 100)}% del dia
              </span>
            </div>
          )}
        </div>

        <div className="p-4 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: nf }}>
          <h3 className="text-xs font-black text-gray-700 mb-3 flex items-center gap-2"><Settings size={13}/> Flujo de Trabajo</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { key: "phase1Active", icon: <Database size={12}/>, label: "Fase 1 — Extraccion INEGI",
                desc: "Busca leads calificados en la BD de INEGI y los pasa a la cola de envio." },
              { key: "phase2Active", icon: <Send size={12}/>, label: "Fase 2 — Envio de Correos",
                desc: "Envia correos en lotes respetando el limite diario y el cooldown." },
              { key: "phase3Active", icon: <BotMessageSquare size={12}/>, label: "Fase 3 — Clasificacion IA",
                desc: "Lee respuestas con IA, clasifica al lead y actua automaticamente." }
            ].map(({ key, icon, label, desc }) => {
              const on = config[key] && config.globalActive;
              return (
                <div key={key} className={`p-3 rounded-xl border-l-4 transition-all ${on ? "border-indigo-500" : "border-gray-300 opacity-60"}`}
                  style={{ background: "#e0e5ec", boxShadow: on ? np : nf }}>
                  <div className="flex justify-between items-start mb-1.5">
                    <h4 className="font-black text-gray-800 text-[11px] flex items-center gap-1">{icon} {label}</h4>
                    <Toggle checked={config[key]} disabled={!config.globalActive}
                      onChange={e => togglePhase(key, e.target.checked)} />
                  </div>
                  <p className="text-[10px] text-gray-500 leading-snug">{desc}</p>
                </div>
              );
            })}
          </div>
          {!config.globalActive && (
            <div className="mt-3 text-center text-xs text-red-500 font-bold py-1.5 rounded-lg bg-red-50">
              Sistema Global APAGADO — activa el switch del encabezado.
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl flex flex-col gap-3" style={{ background: "#e0e5ec", boxShadow: nf }}>
              <h3 className="text-[11px] font-black text-gray-700 border-b border-gray-300 pb-2 flex items-center gap-1.5"><Send size={12}/> Parametros de Envio</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Lote (leads)", key: "batchSize", color: "text-gray-800" },
                  { label: "Espera (seg)", key: "delaySeconds", color: "text-gray-800" },
                  { label: "Limite/dia", key: "dailyLimit", color: "text-indigo-700" },
                  { label: "Cooldown (h)", key: "batchCooldownHours", color: "text-amber-700" },
                ].map(({ label, key, color }) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className={`text-[10px] font-bold ${color}`}>{label}</label>
                    <input type="number" value={config[key] || ''} onChange={e => setConfig({ ...config, [key]: e.target.value })}
                      className={`w-full bg-transparent border-none outline-none ${color} font-bold text-sm px-2 py-1.5 rounded-xl`} style={{ boxShadow: ni }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl flex flex-col gap-3 flex-1" style={{ background: "#e0e5ec", boxShadow: nf }}>
              <h3 className="text-[11px] font-black text-gray-700 border-b border-gray-300 pb-2">Plantilla del Correo</h3>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-700">Asunto</label>
                <input type="text" value={config.templateSubject || ''} onChange={e => setConfig({ ...config, templateSubject: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-gray-700">Cuerpo HTML</label>
                <textarea value={config.templateHtml || ''} onChange={e => setConfig({ ...config, templateHtml: e.target.value })}
                  className="w-full h-52 bg-transparent border-none outline-none text-gray-700 font-mono text-[10px] px-3 py-2 rounded-xl resize-none"
                  style={{ boxShadow: ni }} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-2xl flex flex-col gap-3 h-full" style={{ background: "#e0e5ec", boxShadow: nf }}>
              <h3 className="text-[11px] font-black text-gray-700 border-b border-gray-300 pb-2 flex items-center gap-1.5"><Bot size={12}/> Conocimiento de la IA (Fase 3)</h3>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-700">Nombre de la Empresa</label>
                <input type="text" value={config.companyName || ''} onChange={e => setConfig({ ...config, companyName: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-bold text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1 flex-1">
                <label className="text-[10px] font-bold text-gray-700">Servicios, Precios y FAQ</label>
                <textarea value={config.companyContext || ''} onChange={e => setConfig({ ...config, companyContext: e.target.value })}
                  className="w-full h-36 bg-transparent border-none outline-none text-gray-800 text-[11px] px-3 py-2 rounded-xl resize-none" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-gray-700 flex justify-between">
                  <span>Disponibilidad / Link Calendly</span>
                  <span className="text-[9px] text-indigo-600 font-extrabold uppercase">Tip: Incluye tu link completo https://calendly.com/...</span>
                </label>
                <textarea value={config.availability || ''} onChange={e => setConfig({ ...config, availability: e.target.value })}
                  className="w-full h-16 bg-transparent border-none outline-none text-gray-800 text-[11px] px-3 py-2 rounded-xl resize-none" style={{ boxShadow: ni }} />
              </div>
              <div className="flex flex-col gap-1 pt-3 border-t border-gray-300">
                <label className="text-[10px] font-bold text-gray-700 flex items-center gap-1"><Mail size={11}/> Correo de Alertas al Jefe</label>
                <input type="email" placeholder="jefe@empresa.com" value={config.notifyEmail || ''}
                  onChange={e => setConfig({ ...config, notifyEmail: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 text-xs px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-1">
          {feedback && (
            <div className={`px-3 py-2 flex items-center gap-2 rounded-xl text-xs font-bold ${feedback.type === "success" ? "text-green-600 bg-green-100" : "text-red-600 bg-red-100"}`}>
              <AlertCircle size={13} /> {feedback.msg}
            </div>
          )}
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95"
            style={{ background: "#e0e5ec", boxShadow: nf }}
            onMouseDown={e => e.currentTarget.style.boxShadow = np}
            onMouseUp={e => e.currentTarget.style.boxShadow = nf}
            onMouseLeave={e => e.currentTarget.style.boxShadow = nf}>
            <Save size={14} /> {saving ? "Guardando..." : "Guardar Cambios"}
          </button>
        </div>

      </form>
    </div>
  );
}
