import React, { useState, useEffect } from "react";
import { ArrowLeft, Play, Square, Save, AlertCircle, Building2, Clock, Mail, BotMessageSquare, Eye, Zap } from "lucide-react";

const API = "https://leadsagentapi-production.up.railway.app";

export default function AutoPilotView({ onBack }) {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [activeTab, setActiveTab] = useState("status");

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API}/api/autopilot/config`);
      setConfig(await res.json());
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleSave = async (e) => {
    e.preventDefault(); setSaving(true); setFeedback(null);
    try {
      const res = await fetch(`${API}/api/autopilot/config`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
      setFeedback(res.ok ? { type: "success", msg: "Configuracion guardada." } : { type: "error", msg: "Error al guardar." });
    } catch { setFeedback({ type: "error", msg: "Error de red." }); }
    setSaving(false);
  };

  const toggleBot = async () => {
    const ep = config.isActive ? "stop" : "start";
    try { const res = await fetch(`${API}/api/autopilot/${ep}`, { method: "POST" }); if (res.ok) setConfig(p => ({ ...p, isActive: !p.isActive })); }
    catch (err) { console.error(err); }
  };

  if (loading || !config) return <div className="p-8 text-center text-gray-500">Cargando...</div>;

  const tabs = [
    { id: "status",  label: "Estado",    icon: <Zap size={14} /> },
    { id: "email",   label: "Correo",    icon: <Mail size={14} /> },
    { id: "company", label: "Empresa",   icon: <Building2 size={14} /> },
    { id: "gmail",   label: "Gmail Bot", icon: <BotMessageSquare size={14} /> },
  ];

  const nf = "4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)";
  const np = "inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)";
  const ni = "inset 2px 2px 5px rgba(163,177,198,0.6), inset -2px -2px 5px rgba(255,255,255,0.9)";

  return (
    <div className="h-full flex flex-col relative w-full overflow-y-auto p-2 sm:p-4" style={{ background: "#e0e5ec" }}>
      <div className="flex items-center gap-4 p-3 mb-3 shrink-0 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: "5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)" }}>
        <button onClick={onBack} className="w-12 h-12 rounded-xl flex items-center justify-center transition-all shrink-0 group" style={{ background: "#e0e5ec", boxShadow: nf }}
          onMouseDown={e => e.currentTarget.style.boxShadow = np} onMouseUp={e => e.currentTarget.style.boxShadow = nf} onMouseLeave={e => e.currentTarget.style.boxShadow = nf}>
          <ArrowLeft size={22} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
        </button>
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-800 m-0">Auto-Piloto CRM</h2>
          <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-3 py-1 rounded-full uppercase tracking-wider">Automatizacion</span>
        </div>
      </div>

      <div className="flex gap-2 mb-3 flex-wrap">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: "#e0e5ec", color: activeTab === t.id ? "#4f46e5" : "#6b7280", boxShadow: activeTab === t.id ? np : "3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.9)" }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="flex-1 max-w-5xl mx-auto w-full flex flex-col gap-4 pb-12">

        {activeTab === "status" && (
          <div className="w-full p-4 sm:p-5 rounded-2xl" style={{ background: "#e0e5ec", boxShadow: "6px 6px 12px rgba(163,177,198,0.5), -6px -6px 12px rgba(255,255,255,0.9)" }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-gray-800 mb-1 flex items-center gap-2">Bot de Envio:
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold ${config.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>{config.isActive ? "ACTIVO" : "DETENIDO"}</span>
                </h2>
                <p className="text-xs text-gray-600 max-w-lg">Jala leads de INEGI en bloques de <b>{config.batchSize}</b>, los pasa al CRM y envia correos con <b>{config.delaySeconds}s</b> de espera entre envios.</p>
              </div>
              <button type="button" onClick={toggleBot} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white uppercase tracking-wider text-xs transition-all shrink-0"
                style={{ background: config.isActive ? "#ef4444" : "#10b981", boxShadow: `4px 4px 10px rgba(${config.isActive ? "239,68,68" : "16,185,129"},0.3)` }}>
                {config.isActive ? <><Square fill="white" size={16} /> DETENER</> : <><Play fill="white" size={16} /> INICIAR</>}
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-300 flex flex-col sm:flex-row gap-4">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">Leads por lote</label>
                <input type="number" required min="10" max="200" value={config.batchSize} onChange={e => setConfig({ ...config, batchSize: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs font-bold text-gray-700">Delay entre envios (seg)</label>
                <input type="number" required min="5" max="300" value={config.delaySeconds} onChange={e => setConfig({ ...config, delaySeconds: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
              </div>
            </div>
          </div>
        )}

        {activeTab === "email" && (
          <div className="w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4" style={{ background: "#e0e5ec", boxShadow: np }}>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-300 pb-2"><Mail size={16} /> Plantilla de Correo de Presentacion</h2>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Asunto</label>
              <input type="text" required value={config.templateSubject} onChange={e => setConfig({ ...config, templateSubject: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Cuerpo del Correo (HTML) <span className="text-[10px] font-normal text-gray-400 ml-2">Variable: {"{{nombre_empresa}}"}</span></label>
              <textarea required rows="12" value={config.templateHtml} onChange={e => setConfig({ ...config, templateHtml: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-mono text-xs px-3 py-3 rounded-xl resize-y" style={{ boxShadow: ni }} />
            </div>
          </div>
        )}

        {activeTab === "company" && (
          <div className="w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4" style={{ background: "#e0e5ec", boxShadow: np }}>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-300 pb-2"><Building2 size={16} /> Perfil de la Empresa (Contexto para la IA)</h2>
            <p className="text-xs text-gray-500">La IA usara esta informacion para clasificar respuestas y redactar correos de seguimiento personalizados.</p>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Nombre de la Empresa</label>
              <input type="text" value={config.companyName || ""} onChange={e => setConfig({ ...config, companyName: e.target.value })}
                className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Descripcion de Servicios y Empresa</label>
              <p className="text-[11px] text-gray-400">Incluye: que hacen, a quien van dirigidos, casos de exito, argumentos de venta, preguntas frecuentes y respuestas.</p>
              <textarea rows="10" value={config.companyContext || ""} onChange={e => setConfig({ ...config, companyContext: e.target.value })}
                placeholder="Ej: Somos una empresa especializada en mantenimiento, recubrimiento anticorrosivo y reubicacion de sistemas HVAC..."
                className="w-full bg-transparent border-none outline-none text-gray-800 text-xs px-3 py-3 rounded-xl resize-y leading-relaxed" style={{ boxShadow: ni }} />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700 flex items-center gap-1"><Clock size={13} /> Disponibilidad para Videollamadas / Citas</label>
              <p className="text-[11px] text-gray-400">La IA lo incluira al proponer una cita. Agrega el link de Calendly u otra forma de agendar.</p>
              <textarea rows="3" value={config.availability || ""} onChange={e => setConfig({ ...config, availability: e.target.value })}
                placeholder="Ej: Lunes a Viernes, 9:00am - 6:00pm. Para agendar: https://calendly.com/mi-empresa"
                className="w-full bg-transparent border-none outline-none text-gray-800 text-xs px-3 py-3 rounded-xl resize-y" style={{ boxShadow: ni }} />
            </div>
          </div>
        )}

        {activeTab === "gmail" && (
          <div className="w-full p-4 sm:p-5 rounded-2xl flex flex-col gap-4" style={{ background: "#e0e5ec", boxShadow: np }}>
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2 border-b border-gray-300 pb-2"><BotMessageSquare size={16} /> Bot Lector de Gmail — Fase 2</h2>
            <p className="text-xs text-gray-500">Lee la bandeja de tu jefe, cruza remitentes con leads enviados y los clasifica usando IA.</p>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input type="checkbox" className="sr-only" checked={!!config.gmailReaderActive} onChange={e => setConfig({ ...config, gmailReaderActive: e.target.checked })} />
                <div className={`w-10 h-5 rounded-full transition-colors ${config.gmailReaderActive ? "bg-indigo-500" : "bg-gray-300"}`} style={{ boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.2)" }} />
                <div className={`absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.gmailReaderActive ? "translate-x-5" : ""}`} style={{ boxShadow: "1px 1px 3px rgba(0,0,0,0.3)" }} />
              </div>
              <span className="text-sm font-bold text-gray-700">{config.gmailReaderActive ? "Bot Activo" : "Bot Inactivo"}</span>
            </label>
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold text-gray-700">Modo de Accion al Clasificar</label>
              <div className="flex gap-3">
                {[
                  { value: "notify", label: "Notificar", desc: "La IA clasifica y avisa a tu jefe por correo. El decide que hacer." },
                  { value: "auto_reply", label: "Auto-Responder", desc: "La IA responde automaticamente segun la clasificacion del lead." }
                ].map(opt => (
                  <button key={opt.value} type="button" onClick={() => setConfig({ ...config, gmailReaderMode: opt.value })}
                    className="flex-1 p-3 rounded-xl text-left transition-all"
                    style={{ background: "#e0e5ec", boxShadow: config.gmailReaderMode === opt.value ? np : "3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.9)", borderLeft: config.gmailReaderMode === opt.value ? "3px solid #6366f1" : "3px solid transparent" }}>
                    <div className="text-xs font-bold text-gray-800 mb-1">{opt.label}</div>
                    <div className="text-[11px] text-gray-500">{opt.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-bold text-gray-700">Correo de tu Jefe (para notificaciones)</label>
              <input type="email" value={config.notifyEmail || ""} onChange={e => setConfig({ ...config, notifyEmail: e.target.value })}
                placeholder="jefe@empresa.com" className="w-full bg-transparent border-none outline-none text-gray-800 font-medium text-sm px-3 py-2 rounded-xl" style={{ boxShadow: ni }} />
            </div>
            <div className="p-3 rounded-xl text-xs text-amber-700 bg-amber-50 border border-amber-200">
              <b>Proximo paso:</b> Primero rellena el Perfil de Empresa (pestana "Empresa") — la IA lo necesita para clasificar y responder. Luego conectaremos Gmail con OAuth2.
            </div>
            <button type="button" disabled className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-gray-400 cursor-not-allowed self-start"
              style={{ background: "#e0e5ec", boxShadow: "2px 2px 4px rgba(163,177,198,0.3)" }}>
              <Mail size={14} /> Conectar Gmail (proximamente)
            </button>
          </div>
        )}

        {feedback && (
          <div className={`p-2.5 flex items-center gap-2 rounded-xl text-xs font-medium ${feedback.type === "success" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
            <AlertCircle size={15} /> {feedback.msg}
          </div>
        )}
        <div className="flex justify-end">
          <button type="submit" disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-indigo-700 transition-all active:scale-95"
            style={{ background: "#e0e5ec", boxShadow: nf }}>
            <Save size={16} /> {saving ? "Guardando..." : "Guardar Configuracion"}
          </button>
        </div>
      </form>
    </div>
  );
}
