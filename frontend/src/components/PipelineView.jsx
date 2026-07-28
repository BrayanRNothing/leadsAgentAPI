import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, ExternalLink, MessageSquare, AlertCircle, RefreshCw, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PIPELINE_COLUMNS = [
  { id: 'REPLIED', label: 'Respondieron', borderColor: 'border-blue-400', badgeBg: 'bg-blue-100', badgeText: 'text-blue-700', icon: <MessageSquare size={14}/> },
  { id: 'INTERESTED', label: 'Interesados', borderColor: 'border-orange-400', badgeBg: 'bg-orange-100', badgeText: 'text-orange-700', icon: <AlertCircle size={14}/> },
  { id: 'FOLLOW_UP', label: 'En Seguimiento', borderColor: 'border-teal-400', badgeBg: 'bg-teal-100', badgeText: 'text-teal-700', icon: <RefreshCw size={14}/> },
  { id: 'NOT_INTERESTED', label: 'Descartados', borderColor: 'border-red-400', badgeBg: 'bg-red-100', badgeText: 'text-red-700', icon: <AlertCircle size={14}/> }
];

export default function PipelineView({ onBack }) {
  const { dbMode } = useParams();
  const navigate = useNavigate();
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draggedLeadId, setDraggedLeadId] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);

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
    <div className="flex flex-col h-screen bg-slate-50 font-sans">
      {/* HEADER PREMIUM */}
      <div className="flex items-center justify-between p-5 px-8 relative z-10 bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-5">
          <button 
            onClick={() => {
              if (onBack) onBack();
              else navigate('/');
            }}
            className="w-10 h-10 flex items-center justify-center text-slate-500 rounded-full hover:bg-slate-100 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">CRM Pipeline</h1>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mt-0.5">
              Fuente: {dbMode === 'inegi' ? 'INEGI (DENUE)' : 'Google Maps'}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchPipeline}
          className="px-4 py-2 flex items-center gap-2 text-sm font-bold text-white bg-indigo-600 rounded-full hover:bg-indigo-700 active:scale-95 transition-all shadow-md shadow-indigo-200"
          title="Actualizar Pipeline"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Actualizar
        </button>
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

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-5">
                
                {/* Mensaje del cliente */}
                <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200">
                  <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Mail size={12} /> Mensaje Recibido
                  </h3>
                  <div className="text-sm text-slate-700 whitespace-pre-wrap font-medium">
                    {selectedLead.contactoEstado?.ultimoMensajeRecibido || <span className="text-slate-400 italic">No hay mensaje guardado.</span>}
                  </div>
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
                      <p className="text-sm text-slate-600 font-medium mt-1">
                        <span className="font-bold text-slate-700">Razonamiento:</span> {selectedLead.contactoEstado.aiAnalysis.reasoning}
                      </p>
                    </div>
                    
                    {selectedLead.contactoEstado.aiAnalysis.suggested_reply && (
                      <div className="mt-4 pt-4 border-t border-indigo-100">
                        <span className="text-[10px] font-extrabold text-indigo-500 uppercase tracking-widest block mb-3">Respuesta Sugerida por IA</span>
                        <div className="text-sm text-slate-600 font-medium bg-white p-4 rounded-xl border border-indigo-50 shadow-sm">
                          {selectedLead.contactoEstado.aiAnalysis.suggested_reply}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

