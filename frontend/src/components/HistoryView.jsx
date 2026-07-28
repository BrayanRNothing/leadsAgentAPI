import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Download, Mail, ArrowLeft, Phone, Globe, MapPin, Trash2, XCircle, CheckCircle, ExternalLink, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function HistoryView({ onBack, dbMode = 'maps' }) {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedCat, setExpandedCat] = useState(null); // Object { termino, ubicacion, catId }
  const [filterCategoria, setFilterCategoria] = useState('all');
  const [leads, setLeads] = useState({});
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Modal states
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(null);

  useEffect(() => {
    if (dbMode === 'inegi') {
      const inegiCat = { termino: 'ALL', ubicacion: 'General', catId: 'inegi_all', title: 'Todos los Leads de INEGI' };
      setExpandedCat(inegiCat);
      setLoadingLeads(true);
      axios.get(`http://localhost:3001/api/leads/categorias/ALL/leads?dbMode=inegi`)
        .then(res => {
          setLeads(prev => ({ ...prev, inegi_all: res.data }));
          setLoading(false);
        })
        .catch(err => console.error(err))
        .finally(() => setLoadingLeads(false));
    } else {
      fetchCategorias();
    }
  }, [dbMode]);

  const fetchCategorias = async () => {
    try {
      const res = await axios.get(`http://localhost:3001/api/leads/categorias?dbMode=${dbMode}`);
      setCategorias(res.data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendCampaign = async () => {
    if (!emailSubject || !emailBody) return alert("Llena el asunto y el cuerpo del correo.");

    const leadsToSend = leads[expandedCat.catId]?.filter(l => l.correo && l.status !== 'discarded');
    if (!leadsToSend || leadsToSend.length === 0) return alert("No hay leads con correo válido en esta búsqueda.");

    setIsSendingEmail(true);
    setEmailProgress({ sent: 0, total: leadsToSend.length });

    try {
      await axios.post('http://localhost:3001/api/campaigns/send', {
        leads: leadsToSend,
        asunto: emailSubject,
        cuerpo: emailBody,
        nombreCampana: `Campaña ${expandedCat.termino} en ${expandedCat.ubicacion}`
      });

      let sent = 0;
      const interval = setInterval(() => {
        sent += 1;
        if (sent >= leadsToSend.length) {
          clearInterval(interval);
          setIsSendingEmail(false);
          setShowEmailModal(false);
          setEmailProgress(null);
        } else {
          setEmailProgress({ sent, total: leadsToSend.length });
        }
      }, 3000);
    } catch (error) {
      console.error(error);
      alert("Error al iniciar la campaña");
      setIsSendingEmail(false);
      setEmailProgress(null);
    }
  };

  const toggleCategory = async (cat) => {
    const catId = `${cat.termino}___${cat.ubicacion}`;
    setExpandedCat({ ...cat, catId });
    if (!leads[catId]) {
      setLoadingLeads(true);
      try {
        const res = await axios.get(`http://localhost:3001/api/leads/categorias/${encodeURIComponent(cat.termino)}/leads?dbMode=${dbMode}&ubicacion=${encodeURIComponent(cat.ubicacion)}`);
        setLeads(prev => ({ ...prev, [catId]: res.data }));
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingLeads(false);
      }
    }
  };

  const handleDownload = (e) => {
    e.stopPropagation();
    window.open(`http://localhost:3001/api/leads/exportar/${encodeURIComponent(expandedCat.termino)}?dbMode=${dbMode}&ubicacion=${encodeURIComponent(expandedCat.ubicacion)}`, '_blank');
  };

  const toggleStatus = async (leadId, currentStatus, catId) => {
    const newStatus = currentStatus === 'discarded' ? 'active' : 'discarded';
    try {
      await axios.patch(`http://localhost:3001/api/leads/${leadId}/status`, { status: newStatus });
      setLeads(prev => ({
        ...prev,
        [catId]: prev[catId].map(l => l.id === leadId ? { ...l, status: newStatus } : l)
      }));
    } catch (error) {
      console.error("Error updating status", error);
    }
  };

  const handleRegresar = async (leadId, catId) => {
    try {
      await axios.delete(`http://localhost:3001/api/leads/${leadId}`);
      setLeads(prev => ({
        ...prev,
        [catId]: prev[catId].filter(l => l.id !== leadId)
      }));
    } catch (error) {
      console.error("Error al regresar lead", error);
      alert("Error al regresar lead");
    }
  };

  const toggleContacto = async (leadId, field, currentState, catId) => {
    const lead = leads[catId].find(l => l.id === leadId);
    if (!lead) return;
    
    // Parse the current state (it might be a string if not properly parsed by Prisma JSON in the frontend, or an object)
    let contactoEstado = lead.contactoEstado || { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" };
    if (typeof contactoEstado === 'string') {
      try { contactoEstado = JSON.parse(contactoEstado); } catch(e) { contactoEstado = { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" }; }
    }

    const newState = {
      ...contactoEstado,
      [field]: !contactoEstado[field]
    };

    // Auto update status string based on selections
    if (newState.correo || newState.whatsapp || newState.llamada) {
      newState.estado = "Esperando respuesta";
    } else {
      newState.estado = "En Proceso";
    }

    try {
      await axios.patch(`http://localhost:3001/api/leads/${leadId}/contacto`, { contactoEstado: newState });
      setLeads(prev => ({
        ...prev,
        [catId]: prev[catId].map(l => l.id === leadId ? { ...l, contactoEstado: newState } : l)
      }));
    } catch (error) {
      console.error("Error updating contactoEstado", error);
    }
  };

  const deleteSearch = async (e, cat) => {
    e.stopPropagation();
    if (!window.confirm(`¿Seguro que quieres borrar la búsqueda "${cat.termino}" en "${cat.ubicacion}" para siempre?`)) return;

    try {
      await axios.delete(`http://localhost:3001/api/leads/categorias/${encodeURIComponent(cat.termino)}?dbMode=${dbMode}&ubicacion=${encodeURIComponent(cat.ubicacion)}`);
      setCategorias(prev => prev.filter(c => !(c.termino === cat.termino && c.ubicacion === cat.ubicacion)));
      if (expandedCat && expandedCat.termino === cat.termino && expandedCat.ubicacion === cat.ubicacion) {
        setExpandedCat(null);
      }
    } catch (error) {
      console.error("Error al borrar la búsqueda", error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="flex flex-col h-full w-full p-2 sm:p-4 bg-[#e0e5ec]"
    >
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 font-medium">Cargando...</div>
        </div>
      ) : dbMode !== 'inegi' && categorias.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full gap-6">
          <button onClick={onBack} className="flex items-center justify-center w-12 h-12 rounded-xl transition-all hover:scale-105 active:scale-95 text-gray-500 shadow-[6px_6px_12px_#a3b1c6,-6px_-6px_12px_#ffffff]">
            <ArrowLeft size={20} />
          </button>
          <div className="text-gray-500 text-lg font-medium">Aún no hay leads guardados.</div>
        </div>
      ) : expandedCat ? (
        // Pantalla 2: Lista de leads rediseñada
        <div className="flex flex-col h-full">
          {(() => {
            const uniqueInegiCategories = (dbMode === 'inegi' && leads[expandedCat.catId])
              ? [...new Set(leads[expandedCat.catId].map(l => l.categoria?.split('(')[0].trim()).filter(Boolean))]
              : [];
            return (
              <>
                {/* Header Superior */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4 p-4 rounded-2xl shadow-[6px_6px_12px_#a3b1c6,-6px_-6px_12px_#ffffff]">
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => {
                        if (dbMode === 'inegi') {
                          onBack();
                        } else {
                          setExpandedCat(null);
                        }
                      }}
                      className="w-10 h-10 rounded-xl flex items-center justify-center bg-white shadow-sm hover:shadow-md transition-all text-gray-600 shrink-0"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black text-gray-800 tracking-tight" style={{ color: '#2d3748' }}>
                        {expandedCat.termino === 'ALL' ? 'Leads Guardados (INEGI)' : expandedCat.termino}
                      </h2>
                      {expandedCat.ubicacion !== 'General' && (
                        <div className="text-sm text-gray-500 flex items-center gap-1 font-medium mt-0.5">
                          <MapPin size={14} className="text-blue-500" />
                          {expandedCat.ubicacion}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex gap-1 p-1 rounded-xl shadow-[inset_3px_3px_6px_rgba(163,177,198,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)] flex-wrap">
                      <button
                        onClick={() => setFilterCategoria('all')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCategoria === 'all' ? 'bg-white shadow-[3px_3px_6px_rgba(163,177,198,0.4)] text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        Todos
                      </button>
                      {dbMode === 'inegi' ? (
                        uniqueInegiCategories.map(cat => (
                          <button
                            key={cat}
                            onClick={() => setFilterCategoria(cat)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${filterCategoria === cat ? 'bg-white shadow-[3px_3px_6px_rgba(163,177,198,0.4)] text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                          >
                            {cat}
                          </button>
                        ))
                      ) : (
                        ['Google Maps', 'Facebook'].map(fuente => {
                          const label = fuente === 'Google Maps' ? 'Maps' : fuente;
                          const filterValue = fuente === 'Google Maps' ? 'maps' : fuente.toLowerCase();
                          const isActive = filterCategoria === filterValue;
                          return (
                            <button
                              key={fuente}
                              onClick={() => setFilterCategoria(filterValue)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${isActive ? 'bg-white shadow-[3px_3px_6px_rgba(163,177,198,0.4)] text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
                            >
                              {label}
                            </button>
                          );
                        })
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowEmailModal(true); }}
                        className="w-10 h-10 flex items-center justify-center text-purple-600 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)]"
                        title="Lanzar Campaña"
                      >
                        <Mail size={18} />
                      </button>
                      <button
                        onClick={handleDownload}
                        className="w-10 h-10 flex items-center justify-center text-blue-600 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)]"
                        title="Exportar CSV"
                      >
                        <Download size={18} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabla Neumórfica (estilo InegiView) */}
                <div className="flex-1 overflow-auto custom-scrollbar pb-4">
                  <div className="rounded-2xl overflow-hidden min-h-full" style={{
                    background: '#e0e5ec',
                    boxShadow: 'inset 5px 5px 10px rgba(163,177,198,0.5), inset -5px -5px 10px rgba(255,255,255,0.9)'
                  }}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                          <tr>
                            <th className="p-4 font-bold text-gray-600 border-b border-gray-300">Establecimiento</th>
                            <th className="p-4 font-bold text-gray-600 border-b border-gray-300">Ubicación</th>
                            <th className="p-4 font-bold text-gray-600 border-b border-gray-300">Contacto</th>
                            <th className="p-4 font-bold text-gray-600 border-b border-gray-300 text-center">Seguimiento</th>
                            <th className="p-4 font-bold text-gray-600 border-b border-gray-300 text-center">Acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {loadingLeads && !leads[expandedCat.catId] ? (
                            <tr>
                              <td colSpan="4" className="p-8 text-center text-gray-500 font-medium">Cargando leads...</td>
                            </tr>
                          ) : leads[expandedCat.catId]?.length === 0 ? (
                            <tr>
                              <td colSpan="4" className="p-8 text-center text-gray-500 font-medium">No se encontraron resultados</td>
                            </tr>
                          ) : (
                            leads[expandedCat.catId]
                              ?.filter(l => {
                                if (filterCategoria === 'all') return true;
                                if (dbMode === 'inegi') {
                                  return l.categoria?.split('(')[0].trim() === filterCategoria;
                                } else {
                                  const leadFuente = (l.fuente || 'desconocida').toLowerCase();
                                  return leadFuente.includes(filterCategoria);
                                }
                              })
                              .sort((a, b) => {
                                const scoreA = (a.correo ? 3 : 0) + (a.telefono ? 2 : 0) + (a.sitioWeb || a.redesSociales ? 1 : 0);
                                const scoreB = (b.correo ? 3 : 0) + (b.telefono ? 2 : 0) + (b.sitioWeb || b.redesSociales ? 1 : 0);
                                return scoreB - scoreA;
                              })
                              .map((lead) => {
                                const isDiscarded = lead.status === 'discarded';
                                let cleanTelefono = lead.telefono ? lead.telefono.replace(/[\uE000-\uF8FF]/g, '').replace(/\n/g, '').trim() : null;

                                return (
                                  <tr key={lead.id} className={`transition-colors border-b border-gray-300/50 last:border-0 ${isDiscarded ? 'bg-gray-200/50 opacity-50 grayscale' : 'hover:bg-gray-200/50'}`}>
                                    <td className="p-4 align-top">
                                      <div className={`font-bold text-gray-800 ${isDiscarded ? 'line-through' : ''}`}>{lead.nombre}</div>
                                      <div className="text-xs text-gray-500 mt-1">{lead.terminoBusqueda}</div>
                                    </td>
                                    <td className="p-4 align-top">
                                      <div className="flex flex-col gap-1 text-sm text-gray-700">
                                        <span className="flex items-center gap-1 font-medium"><MapPin size={14} className="text-red-400" /> {lead.ubicacion || 'General'}</span>
                                        <span className="text-xs text-gray-500 ml-5 max-w-[250px]" title={lead.direccion}>{lead.direccion || 'Sin dirección registrada'}</span>
                                      </div>
                                    </td>
                                    <td className="p-4 align-top">
                                      <div className="flex flex-col gap-1 text-sm text-gray-700">
                                        {cleanTelefono && <a href={`tel:${cleanTelefono}`} className="flex items-center gap-1 hover:text-green-600 transition-colors"><Phone size={14} className="text-green-500" /> {cleanTelefono}</a>}
                                        {lead.correo && <a href={`mailto:${lead.correo}`} className="flex items-center gap-1 hover:text-blue-600 transition-colors max-w-[200px] truncate"><Mail size={14} className="text-blue-400 shrink-0" /> <span className="truncate">{lead.correo}</span></a>}
                                        {lead.sitioWeb && <a href={lead.sitioWeb} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-indigo-600 transition-colors"><Globe size={14} className="text-indigo-400" /> Visitar sitio web</a>}
                                        {!cleanTelefono && !lead.correo && !lead.sitioWeb && <span className="text-gray-400 italic">Sin contacto digital</span>}
                                      </div>
                                    </td>
                                    <td className="p-4 align-top min-w-[220px]">
                                      {(() => {
                                        let ce = lead.contactoEstado || { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" };
                                        if (typeof ce === 'string') {
                                          try { ce = JSON.parse(ce); } catch(e) { ce = { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" }; }
                                        }
                                        return (
                                          <div className="flex flex-col gap-2 pt-1">
                                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                                              <input type="checkbox" checked={ce.correo} onChange={() => toggleContacto(lead.id, 'correo', ce, expandedCat.catId)} className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                                              Correo Enviado
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                                              <input type="checkbox" checked={ce.whatsapp} onChange={() => toggleContacto(lead.id, 'whatsapp', ce, expandedCat.catId)} className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500" />
                                              WhatsApp
                                            </label>
                                            <label className="flex items-center gap-2 text-xs font-semibold text-gray-600 cursor-pointer hover:text-gray-800 transition-colors">
                                              <input type="checkbox" checked={ce.llamada} onChange={() => toggleContacto(lead.id, 'llamada', ce, expandedCat.catId)} className="w-4 h-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                                              Llamada
                                            </label>
                                          </div>
                                        );
                                      })()}
                                    </td>
                                    <td className="p-4 text-center align-middle">
                                      <div className="flex flex-col gap-2">
                                        <button
                                          onClick={() => toggleStatus(lead.id, lead.status, expandedCat.catId)}
                                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center mx-auto gap-2 w-full ${isDiscarded ? 'text-green-600' : 'text-red-500 hover:scale-105 active:scale-95'}`}
                                          style={{
                                            background: '#e0e5ec',
                                            boxShadow: isDiscarded
                                              ? 'inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)'
                                              : '4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.8)'
                                          }}
                                        >
                                          {isDiscarded ? (
                                            <><CheckCircle size={14} /> Restaurar</>
                                          ) : (
                                            <><XCircle size={14} /> Descartar</>
                                          )}
                                        </button>
                                        <button
                                          onClick={() => handleRegresar(lead.id, expandedCat.catId)}
                                          className="px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center mx-auto gap-2 w-full text-gray-500 hover:text-gray-700 hover:scale-105 active:scale-95"
                                          style={{
                                            background: '#e0e5ec',
                                            boxShadow: '4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.8)'
                                          }}
                                          title="Regresa este lead a la base de INEGI central"
                                        >
                                          <ArrowLeft size={14} /> Regresar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </div>
      ) : (
        // Pantalla 1: Grid de categorías (Rediseñado)
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar pr-2 pb-4">
          <div className="flex items-center gap-3 mb-6 sticky top-0 bg-[#e0e5ec] pt-2 pb-2 z-10">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center justify-center w-12 h-12 shrink-0 rounded-xl transition-all hover:scale-105 active:scale-95 text-gray-500 shadow-[4px_4px_8px_rgba(163,177,198,0.6),-4px_-4px_8px_rgba(255,255,255,0.8)]"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <div>
              <h2 className="text-2xl font-black text-gray-800 tracking-tight">Mis Búsquedas</h2>
              <p className="text-sm text-gray-500 font-medium">Historial de leads extraídos</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
            {categorias.map((c) => (
              <div
                key={`${c.termino}_${c.ubicacion}`}
                onClick={() => toggleCategory(c)}
                className="rounded-2xl cursor-pointer hover:-translate-y-2 transition-all duration-300 p-6 flex flex-col relative group"
                style={{
                  background: '#e0e5ec',
                  boxShadow: '8px 8px 16px rgba(163,177,198,0.5), -8px -8px 16px rgba(255,255,255,0.9)',
                }}
              >
                <button
                  onClick={(e) => deleteSearch(e, c)}
                  className="absolute top-4 right-4 p-2 rounded-xl text-gray-400 hover:text-red-500 hover:shadow-[inset_2px_2px_5px_rgba(163,177,198,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.9)] transition-all z-10 opacity-0 group-hover:opacity-100"
                  title="Borrar búsqueda"
                >
                  <Trash2 size={16} />
                </button>

                <div className="flex-1 mb-4">
                  <h3 className="text-xl font-bold text-gray-800 capitalize line-clamp-2 leading-tight mb-2 pr-6">
                    {c.termino}
                  </h3>
                  <div className="flex items-start gap-1.5 text-gray-500">
                    <MapPin size={16} className="text-red-400 shrink-0 mt-0.5" />
                    <span className="text-sm font-medium line-clamp-2">{c.ubicacion}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-gray-300/40 pt-4">
                  <div className="flex flex-col">
                    <span className="text-2xl font-black text-blue-600 leading-none">{c._count.leads}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Leads Totals</span>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-50 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors shadow-sm">
                    <ArrowLeft size={16} className="rotate-180" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Email */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-3xl p-8 relative shadow-2xl"
            style={{ background: '#e0e5ec' }}
          >
            <button onClick={() => !isSendingEmail && setShowEmailModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-700 transition-colors">
              <XCircle size={24} />
            </button>
            <h3 className="text-2xl font-black text-gray-800 mb-6 flex items-center gap-3">
              <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                <Mail size={24} />
              </div>
              Nueva Campaña
            </h3>

            <div className="flex flex-col gap-5">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 pl-1">Asunto del Correo</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={isSendingEmail}
                  className="w-full px-5 py-3 rounded-2xl bg-[#e0e5ec] outline-none text-gray-800 font-medium transition-shadow focus:shadow-[inset_4px_4px_8px_rgba(163,177,198,0.7),inset_-4px_-4px_8px_rgba(255,255,255,1)] shadow-[inset_3px_3px_6px_rgba(163,177,198,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)]"
                  placeholder="Ej: Propuesta para tu negocio"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-2 pl-1">Mensaje (Usa {"{{nombre}}"} para personalizar)</label>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={isSendingEmail}
                  rows={6}
                  className="w-full px-5 py-4 rounded-2xl bg-[#e0e5ec] outline-none text-gray-800 font-medium custom-scrollbar transition-shadow focus:shadow-[inset_4px_4px_8px_rgba(163,177,198,0.7),inset_-4px_-4px_8px_rgba(255,255,255,1)] shadow-[inset_3px_3px_6px_rgba(163,177,198,0.5),inset_-3px_-3px_6px_rgba(255,255,255,0.8)]"
                  placeholder="Hola {{nombre}},&#10;&#10;Noté que tu negocio..."
                />
              </div>

              {isSendingEmail && emailProgress ? (
                <div className="flex flex-col gap-2 mt-2 bg-purple-50 p-4 rounded-2xl">
                  <div className="flex justify-between text-sm font-black text-purple-700">
                    <span>Enviando correos...</span>
                    <span>{emailProgress.sent} / {emailProgress.total}</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden shadow-inner bg-purple-200">
                    <div
                      className="h-full bg-purple-500 transition-all duration-500"
                      style={{ width: `${(emailProgress.sent / emailProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleSendCampaign}
                  className="mt-4 w-full py-4 rounded-2xl font-black text-white bg-purple-500 hover:bg-purple-600 transition-all shadow-[0_8px_20px_rgba(168,85,247,0.4)] hover:shadow-[0_12px_25px_rgba(168,85,247,0.5)] hover:-translate-y-1 flex justify-center items-center gap-2 text-lg"
                >
                  <Mail size={20} />
                  Lanzar Campaña
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
