import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Mail, Phone, ExternalLink, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const PIPELINE_COLUMNS = [
  { id: 'REPLIED', label: 'Respondieron', color: 'border-yellow-400', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  { id: 'INTERESTED', label: 'Interesados', color: 'border-orange-400', bg: 'bg-orange-100', text: 'text-orange-700' },
  { id: 'FOLLOW_UP', label: 'En Seguimiento', color: 'border-teal-400', bg: 'bg-teal-100', text: 'text-teal-700' },
  { id: 'NOT_INTERESTED', label: 'No Interesados', color: 'border-gray-400', bg: 'bg-gray-200', text: 'text-gray-600' }
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
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipelineState: newState } : l));
    
    try {
      await axios.patch(`https://leadsagentapi-production.up.railway.app/api/leads/${leadId}/pipeline`, {
        pipelineState: newState
      });
    } catch (error) {
      console.error('Error updating state', error);
      // Revert if error
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

  // Agrupar leads por estado
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
    <div className="flex flex-col h-screen" style={{ background: '#e0e5ec' }}>
      {/* HEADER */}
      <div className="flex items-center justify-between p-4 px-6 relative z-10 shadow-[4px_4px_8px_rgba(163,177,198,0.3),-4px_-4px_8px_rgba(255,255,255,0.7)]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (onBack) onBack();
              else navigate('/');
            }}
            className="w-12 h-12 flex items-center justify-center text-gray-600 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)] hover:text-teal-600"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-gray-800 tracking-tight">CRM Pipeline</h1>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Fuente: {dbMode === 'inegi' ? 'INEGI (DENUE)' : 'Google Maps'}
            </p>
          </div>
        </div>

        <button 
          onClick={fetchPipeline}
          className="w-12 h-12 flex items-center justify-center text-teal-600 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)]"
          title="Actualizar Pipeline"
        >
          <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* BOARD KANBAN */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex h-full gap-6 min-w-max pb-4">
          
          {columns.map(col => (
            <div 
              key={col.id}
              className="w-80 h-full flex flex-col rounded-3xl p-4 transition-all"
              style={{
                background: '#e0e5ec',
                boxShadow: 'inset 6px 6px 12px rgba(163,177,198,0.4), inset -6px -6px 12px rgba(255,255,255,0.8)'
              }}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.id)}
            >
              {/* Encabezado de Columna */}
              <div className="flex items-center justify-between mb-4 px-2">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${col.bg} border-2 ${col.color}`} />
                  <h3 className={`font-black text-sm uppercase tracking-wider ${col.text}`}>
                    {col.label}
                  </h3>
                </div>
                <span className="text-xs font-bold text-gray-500 bg-gray-200 px-2 py-1 rounded-lg">
                  {col.items.length}
                </span>
              </div>

              {/* Lista de Tarjetas */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-10 custom-scrollbar">
                <AnimatePresence>
                  {col.items.map(lead => (
                    <motion.div
                      key={lead.id}
                      layoutId={lead.id.toString()}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`relative p-4 rounded-2xl cursor-grab active:cursor-grabbing border-l-4 ${col.color}`}
                      style={{
                        background: '#e0e5ec',
                        boxShadow: '4px 4px 10px rgba(163,177,198,0.4), -4px -4px 10px rgba(255,255,255,0.9)'
                      }}
                    >
                      <h4 className="font-bold text-gray-800 leading-tight mb-1">{lead.nombre}</h4>
                      <p className="text-xs font-medium text-gray-500 mb-3 truncate">{lead.categoria || lead.terminoBusqueda}</p>
                      
                      <div className="flex gap-2 mb-2">
                        {lead.telefono && (
                          <button
                            onClick={() => openWhatsApp(lead.telefono)}
                            className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm"
                            title="WhatsApp"
                          >
                            <Phone size={14} />
                          </button>
                        )}
                        {lead.correo && (
                          <button
                            onClick={() => openEmail(lead.correo)}
                            className="p-1.5 bg-blue-100 text-blue-700 rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm"
                            title="Correo"
                          >
                            <Mail size={14} />
                          </button>
                        )}
                        {lead.sitioWeb && (
                          <a
                            href={lead.sitioWeb}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 bg-gray-200 text-gray-600 rounded-lg hover:scale-105 active:scale-95 transition-all shadow-sm"
                            title="Sitio Web"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </div>
                      
                      <button 
                        onClick={() => setSelectedLead(lead)}
                        className="w-full text-xs font-bold py-1.5 rounded-lg text-teal-700 bg-teal-100 hover:bg-teal-200 transition-colors flex items-center justify-center gap-1 mt-2"
                      >
                        <MessageSquare size={14} /> Ver Respuesta
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {col.items.length === 0 && (
                  <div className="h-24 flex items-center justify-center border-2 border-dashed border-gray-300 rounded-xl text-gray-400 text-sm font-semibold">
                    Arrastra aquí
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-2xl rounded-[2rem] p-8 relative flex flex-col max-h-[90vh] shadow-2xl"
              style={{ background: '#e0e5ec' }}
            >
              <button 
                onClick={() => setSelectedLead(null)} 
                className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition-colors"
              >
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-white/50 shadow-sm">✕</div>
              </button>
              
              <h2 className="text-2xl font-black text-gray-800 mb-1">{selectedLead.nombre}</h2>
              <p className="text-sm font-semibold text-gray-500 mb-6">{selectedLead.correo}</p>

              <div className="overflow-y-auto pr-2 custom-scrollbar flex-1 space-y-6">
                
                {/* Mensaje del cliente */}
                <div className="p-5 rounded-2xl bg-white shadow-sm border border-gray-100">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Mail size={14} /> Mensaje Recibido
                  </h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap font-medium">
                    {selectedLead.contactoEstado?.ultimoMensajeRecibido || <span className="text-gray-400 italic">No hay mensaje guardado para este lead. Probablemente se clasificó manualmente.</span>}
                  </div>
                </div>

                {/* Análisis de IA */}
                {selectedLead.contactoEstado?.aiAnalysis && (
                  <div className="p-5 rounded-2xl bg-purple-50 shadow-sm border border-purple-100">
                    <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <AlertCircle size={14} /> Análisis de IA Groq
                    </h3>
                    <div className="mb-3">
                      <span className="inline-block px-3 py-1 bg-purple-200 text-purple-800 text-xs font-black rounded-full mb-2">
                        {selectedLead.contactoEstado.aiAnalysis.classification}
                      </span>
                      <p className="text-sm text-gray-700 font-medium">
                        <span className="font-bold">Razonamiento:</span> {selectedLead.contactoEstado.aiAnalysis.reasoning}
                      </p>
                    </div>
                    
                    {selectedLead.contactoEstado.aiAnalysis.suggested_reply && (
                      <div className="mt-4 pt-4 border-t border-purple-200">
                        <span className="text-xs font-bold text-purple-500 uppercase tracking-wider block mb-2">Respuesta Sugerida por IA</span>
                        <div className="text-sm text-gray-600 italic bg-white p-3 rounded-xl border border-purple-100">
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
