import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, ExternalLink, MessageSquare, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PIPELINE_COLUMNS = [
  { id: 'REPLIED', label: 'Respondieron', borderColor: 'border-blue-400', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', icon: <MessageSquare size={14}/> },
  { id: 'INTERESTED', label: 'Interesados', borderColor: 'border-orange-400', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', icon: <AlertCircle size={14}/> },
  { id: 'MEETING_BOOKED', label: 'Cita Agendada', borderColor: 'border-green-400', badgeBg: 'bg-green-100', badgeText: 'text-green-700', icon: <Calendar size={14}/> },
  { id: 'FOLLOW_UP', label: 'En Seguimiento', borderColor: 'border-teal-400', badgeBg: 'bg-teal-100', badgeText: 'text-teal-700', icon: <RefreshCw size={14}/> },
  { id: 'REQUIRES_HUMAN', label: 'Requiere Humano', borderColor: 'border-purple-400', badgeBg: 'bg-purple-100', badgeText: 'text-purple-700', icon: <AlertCircle size={14}/> },
  { id: 'INVALID', label: 'Inválidos/Spam', borderColor: 'border-gray-400', badgeBg: 'bg-gray-200', badgeText: 'text-gray-700', icon: <AlertCircle size={14}/> },
  { id: 'NOT_INTERESTED', label: 'No Interesados', borderColor: 'border-red-400', badgeBg: 'bg-red-100', badgeText: 'text-red-700', icon: <AlertCircle size={14}/> },
  { id: 'DISCARDED', label: 'Descartados', borderColor: 'border-red-600', badgeBg: 'bg-red-200', badgeText: 'text-red-800', icon: <AlertCircle size={14}/> }
];

export default function PipelineView({ onBack }) {
  const { dbMode } = useParams();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    if (selectedLead) {
      const prevSubject = selectedLead.correos?.[selectedLead.correos.length - 1]?.subject || 
                          selectedLead.mensajes?.[0]?.campana?.asunto || 
                          'Propuesta de Valor';
      const cleanSubject = prevSubject.startsWith('Re:') ? prevSubject : `Re: ${prevSubject}`;
      setReplySubject(cleanSubject);
    } else {
      setReplyText('');
      setReplySubject('');
    }
  }, [selectedLead]);

  const handleSendReply = async () => {
    if (!replyText.trim()) return alert('El cuerpo de la respuesta es obligatorio.');
    setReplying(true);
    try {
      const res = await axios.post(`https://leadsagentapi-production.up.railway.app/api/leads/${selectedLead.id}/responder`, {
        asunto: replySubject || 'Seguimiento - Infiniguard',
        cuerpo: replyText
      });
      if (res.data.success) {
        setLeads(prev => prev.map(l => l.id === selectedLead.id ? res.data.lead : l));
        setSelectedLead(res.data.lead);
        setReplyText('');
        alert('Respuesta enviada con éxito. El lead ahora está en Seguimiento.');
      }
    } catch (error) {
      console.error('Error al enviar respuesta:', error);
      alert('Error al enviar respuesta: ' + (error.response?.data?.error || error.message));
    } finally {
      setReplying(false);
    }
  };

  const fetchPipeline = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`https://leadsagentapi-production.up.railway.app/api/leads/pipeline?dbMode=${dbMode}`);
      setLeads(res.data);
    } catch (error) {
      console.error('Error fetching pipeline', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipeline();
  }, [dbMode]);

  const updateLeadState = async (leadId, newState) => {
    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipelineState: newState, status: newState === 'NOT_INTERESTED' ? 'discarded' : l.status } : l));
    
    try {
      await axios.patch(`https://leadsagentapi-production.up.railway.app/api/leads/${leadId}/pipeline`, {
        pipelineState: newState
      });
    } catch (error) {
      console.error('Error updating state', error);
      fetchPipeline();
    }
  };

  const handleDragStart = (e, leadId) => {
    setDraggedLeadId(leadId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', leadId.toString());
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, colId) => {
    e.preventDefault();
    const leadId = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (leadId) {
      updateLeadState(leadId, colId);
    }
    setDraggedLeadId(null);
  };

  const columns = PIPELINE_COLUMNS.map(col => ({
    ...col,
    items: leads.filter(l => l.pipelineState === col.id)
  }));

  const openWhatsApp = (telefono) => {
    const num = telefono.replace(/[^\d+]/g, '');
    window.open(`https://wa.me/${num}`, '_blank');
  };

  const openEmail = (correo) => {
    window.open(`mailto:${correo}`, '_blank');
  };

  return (
    <div className="flex flex-col h-screen bg-[#e0e5ec] font-sans p-2 sm:p-4 overflow-hidden">
      {/* HEADER COMPACTO CON BOTÓN CUADRADO (Estilo Scanner Maps) */}
      <div 
        className="flex items-center gap-4 p-3 mb-3 shrink-0 rounded-2xl"
        style={{
          background: '#e0e5ec',
          boxShadow: '5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)'
        }}
      >
        <button 
          onClick={() => {
            if (onBack) onBack();
            else navigate('/');
          }}
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
          <h2 className="text-lg font-bold text-gray-800 m-0">Pipeline de Leads - Interesados</h2>
          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-3 py-1 rounded-full uppercase tracking-wider">
            Fase 3
          </span>
        </div>
      </div>

      {/* BOARD KANBAN */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 custom-scrollbar">
        <div className="flex h-full gap-6 min-w-max pb-4">
          
          {columns.map(col => (
            <div 
              key={col.id}
              className="w-80 h-full flex flex-col rounded-2xl p-4 bg-slate-100/50 border border-slate-200/60"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-md ${col.badgeBg} ${col.badgeText}`}>
                    {col.icon}
                  </div>
                  <h3 className="font-bold text-sm text-slate-700 uppercase tracking-wide">
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs font-extrabold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-full shadow-sm">
                  {col.items.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-10 custom-scrollbar">
                <AnimatePresence>
                  {col.items.map(lead => {
                    const isDiscarded = lead.status === 'discarded';
                    return (
                    <motion.div
                      key={lead.id}
                      layoutId={lead.id.toString()}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className={`group relative p-4 rounded-xl cursor-grab active:cursor-grabbing border-l-4 ${col.borderColor} bg-white shadow-sm hover:shadow-md transition-all border border-slate-100`}
                    >
                      <h4 className={`font-bold text-slate-800 leading-tight mb-1 truncate ${isDiscarded ? 'line-through text-slate-400' : ''}`}>
                        {lead.nombre}
                      </h4>
                      <p className="text-xs font-medium text-slate-400 mb-3 truncate">
                        {lead.categoria || lead.terminoBusqueda}
                      </p>
                      
                      <div className={`text-[10px] font-semibold text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-2 mb-3 ${isDiscarded ? 'opacity-60' : ''}`}>
                        {lead.mensajes && lead.mensajes.length > 0 && lead.mensajes[0].enviadoEn ? (
                          <div className="flex items-center gap-1.5 mb-1">
                            <Mail size={12} className="text-indigo-400" />
                            Enviado: {new Date(lead.mensajes[0].enviadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertCircle size={12} className="text-slate-300" />
                            Sin campañas
                          </div>
                        )}
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                          Ingresó: {new Date(lead.creadoEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <div className={`flex gap-1.5 ${isDiscarded ? 'opacity-50' : ''}`}>
                          {lead.telefono && (
                            <button onClick={() => openWhatsApp(lead.telefono)} className="p-1.5 text-slate-400 hover:text-emerald-500 hover:bg-emerald-50 rounded-md transition-colors" title="WhatsApp">
                              <Phone size={14} />
                            </button>
                          )}
                          {lead.correo && (
                            <button onClick={() => openEmail(lead.correo)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-colors" title="Correo">
                              <Mail size={14} />
                            </button>
                          )}
                          {lead.sitioWeb && (
                            <a href={lead.sitioWeb} target="_blank" rel="noopener noreferrer" className="p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 rounded-md transition-colors" title="Sitio Web">
                              <ExternalLink size={14} />
                            </a>
                          )}
                        </div>
                        
                        <button 
                          onClick={() => setSelectedLead(lead)}
                          className={`text-[10px] font-bold px-2.5 py-1.5 rounded-md transition-colors flex items-center gap-1
                            ${isDiscarded 
                              ? 'bg-slate-100 text-slate-400 hover:bg-slate-200' 
                              : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
                        >
                          <MessageSquare size={12} /> Ver Info
                        </button>
                      </div>
                    </motion.div>
                  )})}
                </AnimatePresence>
                
                {col.items.length === 0 && (
                  <div className="h-28 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-xs font-bold bg-white/50">
                    <span className="text-slate-300 mb-1">Arrastra un lead aquí</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          
        </div>
      </div>

      {/* Modal Ver Respuesta */}
      <AnimatePresence>
        {selectedLead && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-2xl bg-white rounded-3xl p-8 relative flex flex-col max-h-[90vh] shadow-2xl border border-slate-100"
            >
              <button 
                onClick={() => setSelectedLead(null)} 
                className="absolute top-6 right-6 text-slate-400 hover:text-slate-700 transition-colors bg-slate-100 hover:bg-slate-200 p-2 rounded-full"
              >
                ✕
              </button>
              
              <h2 className="text-2xl font-extrabold text-slate-800 mb-1 pr-10">{selectedLead.nombre}</h2>
              <p className="text-sm font-medium text-slate-500 mb-6">{selectedLead.correo}</p>

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-6">
                
                {/* Historial de conversación */}
                <div className="flex flex-col gap-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                    <Mail size={14} className="text-slate-400" /> Historial de Conversación
                  </h3>
                  
                  {selectedLead.correos && selectedLead.correos.length > 0 ? (
                    <div className="flex flex-col gap-4 p-2 bg-slate-50/50 rounded-2xl border border-slate-100 max-h-[40vh] overflow-y-auto custom-scrollbar">
                      {selectedLead.correos.map((correo) => {
                        const isIncoming = correo.isIncoming;
                        return (
                          <div 
                            key={correo.id} 
                            className={`flex flex-col max-w-[85%] rounded-2xl p-4 shadow-sm border ${
                              isIncoming 
                                ? 'self-start bg-white border-slate-200 text-slate-800' 
                                : 'self-end bg-indigo-600 border-indigo-700 text-white'
                            }`}
                          >
                            {correo.subject && (
                              <div className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${
                                isIncoming ? 'text-slate-400' : 'text-indigo-200'
                              }`}>
                                Asunto: {correo.subject}
                              </div>
                            )}
                            <div className="text-xs whitespace-pre-wrap font-medium leading-relaxed">
                              {correo.bodyText}
                            </div>
                            <div className={`text-[9px] mt-2 text-right ${
                              isIncoming ? 'text-slate-400' : 'text-indigo-200'
                            }`}>
                              {isIncoming ? 'Recibido' : 'Enviado'} • {new Date(correo.sentAt).toLocaleString('es-MX', { 
                                day: 'numeric', 
                                month: 'short', 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center border border-dashed border-slate-200 rounded-2xl bg-slate-50">
                      <p className="text-xs text-slate-400 italic font-medium">No se han registrado correos interactivos para este lead.</p>
                      {selectedLead.contactoEstado?.ultimoMensajeRecibido && (
                        <div className="mt-4 text-left p-4 bg-white border border-slate-100 rounded-xl">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Último mensaje recibido:</span>
                          <p className="text-xs text-slate-700 font-medium">{selectedLead.contactoEstado.ultimoMensajeRecibido}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Análisis de IA */}
                {selectedLead.contactoEstado?.aiAnalysis && (
                  <div className="p-5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                    <h3 className="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <AlertCircle size={12} /> Análisis de IA Groq
                    </h3>
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-black rounded-full mb-2">
                        {selectedLead.contactoEstado.aiAnalysis.classification}
                      </span>
                      <p className="text-xs text-slate-600 font-medium mt-1">
                        <span className="font-bold text-slate-700">Razonamiento:</span> {selectedLead.contactoEstado.aiAnalysis.reasoning}
                      </p>
                    </div>
                    
                    {selectedLead.contactoEstado.aiAnalysis.suggested_reply && (
                      <div className="mt-4 pt-4 border-t border-indigo-100">
                        <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest block mb-3">Respuesta Sugerida por IA</span>
                        <div className="text-xs text-slate-600 font-medium bg-white p-4 rounded-xl border border-indigo-50 shadow-sm leading-relaxed whitespace-pre-wrap">
                          {selectedLead.contactoEstado.aiAnalysis.suggested_reply}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {/* Responder por Correo */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col gap-4">
                  <h3 className="text-xs font-black text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Send size={14} className="text-indigo-500" /> Responder por Correo
                    </span>
                    {selectedLead.contactoEstado?.aiAnalysis?.suggested_reply && (
                      <button
                        type="button"
                        onClick={() => setReplyText(selectedLead.contactoEstado.aiAnalysis.suggested_reply)}
                        className="text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors"
                      >
                        Usar sugerencia de IA
                      </button>
                    )}
                  </h3>

                  <div className="flex flex-col gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Asunto del Correo</label>
                      <input 
                        type="text" 
                        value={replySubject}
                        onChange={(e) => setReplySubject(e.target.value)}
                        className="w-full bg-white border border-slate-200 outline-none text-xs text-slate-700 px-3 py-2 rounded-xl focus:border-indigo-400 transition-colors" 
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-bold text-slate-400">Cuerpo del Correo</label>
                      <textarea 
                        rows={4}
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Escribe tu correo de respuesta aquí..."
                        className="w-full bg-white border border-slate-200 outline-none text-xs text-slate-700 px-3 py-2 rounded-xl resize-none focus:border-indigo-400 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={handleSendReply}
                      disabled={replying}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all disabled:opacity-50 active:scale-95 shadow-md shadow-indigo-100"
                    >
                      <Send size={14} /> {replying ? "Enviando..." : "Enviar Correo"}
                    </button>
                  </div>
                </div>
                
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

