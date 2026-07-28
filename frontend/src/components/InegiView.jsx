import React, { useState, useEffect } from 'react';
import { ArrowLeft, Radar, Hotel, Building2, MapPin, Phone, Globe, Mail, ChevronLeft, ChevronRight, Search } from 'lucide-react';

export default function InegiView({ onBack }) {
  const [stats, setStats] = useState({ total: 0, categorias: [] });
  const [leads, setLeads] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 50, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);

  // Filtros
  const [ubicacionFilter, setUbicacionFilter] = useState('');
  const [categoriaFilter, setCategoriaFilter] = useState('');
  const [filterTelefono, setFilterTelefono] = useState(false);
  const [filterCorreo, setFilterCorreo] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await fetch('https://leadsagentapi-production.up.railway.app/api/inegi/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Error fetching INEGI stats:', error);
    }
  };

  const fetchLeads = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 50 });
      if (ubicacionFilter) params.append('search', ubicacionFilter);
      if (categoriaFilter) params.append('categoria', categoriaFilter);
      if (filterTelefono) params.append('telefono', 'true');
      if (filterCorreo) params.append('correo', 'true');

      const res = await fetch(`https://leadsagentapi-production.up.railway.app/api/inegi/leads?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLeads(data.data);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching INEGI leads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchLeads(1);
  }, [filterTelefono, filterCorreo]);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchLeads(newPage);
    }
    setLoading(false);
  };

  const handleApartar = async (lead) => {
    try {
      await fetch('https://leadsagentapi-production.up.railway.app/api/inegi/apartar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inegiLeadId: lead.id })
      });
      // Marcar visualmente
      lead.apartado = true;
      setLeads([...leads]);
    } catch (e) {
      console.error(e);
      alert('Error al apartar lead');
    }
  };

  return (
    <div className="flex flex-col h-full relative px-2 md:px-4 pb-2 md:pb-4 pt-1" style={{ background: '#e0e5ec' }}>
      {/* Header Neumórfico con Filtros Integrados */}
      <div
        className="flex flex-col lg:flex-row lg:items-center gap-3 mb-3 p-3 shrink-0 z-10 rounded-2xl"
        style={{
          boxShadow: '5px 5px 10px rgba(163,177,198,0.3), -5px -5px 10px rgba(255,255,255,0.7)'
        }}
      >
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onBack}
            className="w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 group shrink-0"
            style={{
              background: '#e0e5ec',
              boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)',
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.boxShadow = 'inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.8)';
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)';
            }}
          >
            <ArrowLeft size={20} className="text-gray-600 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold flex items-center gap-2 m-0" style={{ color: '#2d3748' }}>
              <Radar size={20} color="#38b2ac" /> Consulta INEGI
            </h2>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
              background: '#e0e5ec',
              boxShadow: 'inset 2px 2px 5px rgba(163,177,198,0.5), inset -2px -2px 5px rgba(255,255,255,0.9)'
            }}>
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></div>
              <span className="text-xs font-bold text-teal-600 uppercase tracking-wider">{pagination.total.toLocaleString()} leads mostrados</span>
            </div>
          </div>
        </div>

        {/* Controles de Búsqueda Integrados */}
        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Buscar por Nombre, Estado o Municipio..."
            value={ubicacionFilter}
            onChange={(e) => setUbicacionFilter(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLeads(1)}
            className="w-full sm:w-auto flex-1 min-w-[200px] h-12 px-4 rounded-xl outline-none transition-all placeholder-gray-400 font-medium text-sm"
            style={{
              background: '#e0e5ec',
              boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.8)',
              color: '#2d3748'
            }}
          />

          <select
            value={categoriaFilter}
            onChange={(e) => setCategoriaFilter(e.target.value)}
            className="w-full sm:w-auto h-12 px-4 rounded-xl outline-none transition-all font-medium appearance-none text-sm"
            style={{
              background: '#e0e5ec',
              boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.8)',
              color: categoriaFilter ? '#2d3748' : '#9ca3af'
            }}
          >
            <option value="">Todas las Categorías</option>
            {Object.entries(
              stats.categorias.reduce((acc, cat) => {
                const base = cat.nombre.split(' (')[0];
                acc[base] = (acc[base] || 0) + cat.count;
                return acc;
              }, {})
            ).map(([nombre, count], idx) => (
              <option key={idx} value={nombre}>
                {nombre}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchLeads(1)}
            className="w-full sm:w-auto h-12 px-6 rounded-xl flex items-center justify-center transition-all group shrink-0"
            style={{
              background: '#38b2ac',
              boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)',
            }}
            onMouseDown={(e) => e.currentTarget.style.boxShadow = 'inset 3px 3px 6px rgba(0,0,0,0.2)'}
            onMouseUp={(e) => e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'}
            onMouseLeave={(e) => e.currentTarget.style.boxShadow = '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.9)'}
          >
            <Search size={20} className="text-white" />
          </button>
          
          <div className="flex gap-4 items-center px-4 h-12 rounded-xl" style={{
            background: '#e0e5ec',
            boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.8)'
          }}>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-600 transition-colors hover:text-teal-600">
              <input 
                type="checkbox" 
                checked={filterTelefono} 
                onChange={(e) => setFilterTelefono(e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 text-teal-500 focus:ring-teal-500" 
              />
              Teléfono
            </label>
            <div className="w-px h-6 bg-gray-300"></div>
            <label className="flex items-center gap-2 cursor-pointer text-sm font-bold text-gray-600 transition-colors hover:text-blue-600">
              <input 
                type="checkbox" 
                checked={filterCorreo} 
                onChange={(e) => setFilterCorreo(e.target.checked)} 
                className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500" 
              />
              Correo
            </label>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar pb-4">

        {/* Tabla Neumórfica (Sunken Panel) */}
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
                  <th className="p-4 font-bold text-gray-600 border-b border-gray-300">Categoría</th>
                  <th className="p-4 font-bold text-gray-600 border-b border-gray-300 text-center">Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-gray-300 animate-pulse">
                      <td className="p-4">
                        <div className="h-4 bg-gray-300 rounded-md w-3/4 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded-md w-1/2"></div>
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-gray-300 rounded-md w-full mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded-md w-2/3"></div>
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-gray-300 rounded-md w-5/6 mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded-md w-4/6"></div>
                      </td>
                      <td className="p-4">
                        <div className="h-4 bg-gray-300 rounded-md w-3/4"></div>
                      </td>
                      <td className="p-4">
                        <div className="h-8 bg-gray-300 rounded-xl w-24 mx-auto"></div>
                      </td>
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-gray-500 font-medium">No se encontraron resultados</td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-200/50 transition-colors border-b border-gray-300/50 last:border-0">
                      <td className="p-4">
                        <div className="font-bold text-gray-800">{lead.nombre}</div>
                        <div className="text-xs text-gray-500 mt-1">{lead.terminoBusqueda}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-sm text-gray-700">
                          {lead.lat && lead.lng ? (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lead.nombre + ' ' + lead.ubicacion)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 hover:text-blue-600 hover:underline transition-colors w-fit"
                              title="Buscar en Google Maps"
                            >
                              <MapPin size={14} className="text-red-400" /> {lead.ubicacion}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1"><MapPin size={14} className="text-red-400" /> {lead.ubicacion}</span>
                          )}
                          <span className="text-xs text-gray-500 ml-5 truncate max-w-[200px]" title={lead.direccion}>{lead.direccion}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 text-sm text-gray-700">
                          {lead.telefono && <span className="flex items-center gap-1"><Phone size={14} className="text-green-500" /> {lead.telefono}</span>}
                          {lead.correo && <span className="flex items-center gap-1"><Mail size={14} className="text-blue-400" /> {lead.correo}</span>}
                          {lead.sitioWeb && <span className="flex items-center gap-1"><Globe size={14} className="text-indigo-400" /> {lead.sitioWeb}</span>}
                          {!lead.telefono && !lead.correo && !lead.sitioWeb && <span className="text-gray-400 italic">Sin contacto digital</span>}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-gray-600">
                        {lead.categoria.split('(')[0]}
                      </td>
                      <td className="p-4 text-center align-middle">
                        <button
                          onClick={() => handleApartar(lead)}
                          disabled={lead.apartado}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center mx-auto gap-2 ${lead.apartado ? 'text-green-600 cursor-not-allowed' : 'text-blue-600 hover:scale-105 active:scale-95'}`}
                          style={{
                            background: '#e0e5ec',
                            boxShadow: lead.apartado
                              ? 'inset 3px 3px 6px rgba(163,177,198,0.5), inset -3px -3px 6px rgba(255,255,255,0.9)'
                              : '4px 4px 8px rgba(163,177,198,0.6), -4px -4px 8px rgba(255,255,255,0.8)'
                          }}
                        >
                          {lead.apartado ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div> Guardado
                            </>
                          ) : 'Apartar'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="p-4 flex items-center justify-between border-t border-gray-300 bg-gray-200/30">
            <span className="text-sm font-medium text-gray-600">
              Mostrando página <b className="text-gray-800">{pagination.page}</b> de <b className="text-gray-800">{pagination.totalPages}</b>
              <span className="ml-2 text-xs">({pagination.total} resultados)</span>
            </span>
            <div className="flex gap-2">
              <button
                disabled={pagination.page <= 1}
                onClick={() => handlePageChange(pagination.page - 1)}
                className="p-2 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                style={{
                  background: '#e0e5ec',
                  boxShadow: '3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.9)',
                }}
              >
                <ChevronLeft size={18} className="text-gray-700" />
              </button>
              <button
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => handlePageChange(pagination.page + 1)}
                className="p-2 rounded-lg flex items-center justify-center transition-all disabled:opacity-50"
                style={{
                  background: '#e0e5ec',
                  boxShadow: '3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.9)',
                }}
              >
                <ChevronRight size={18} className="text-gray-700" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
