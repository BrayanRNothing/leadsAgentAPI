const fs = require('fs');
const filePath = '../frontend/src/components/HistoryView.jsx';
let code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\\n');
const sIdx = lines.findIndex(l => l.includes("leads[expandedCat]?.filter(l => {"));
let eIdx = -1;
for (let i = sIdx; i < lines.length; i++) {
  if (lines[i].includes("))") && lines[i+1]?.includes(")}")) {
    eIdx = i;
    break;
  }
}

if (eIdx !== -1) {
  const table = `              <div className="overflow-x-auto rounded-2xl p-1" style={{ background: '#e0e5ec', boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.5), inset -4px -4px 8px rgba(255,255,255,0.8)' }}>
                <table className="w-full min-w-[900px] text-left border-collapse">
                  <thead>
                    <tr className="text-[11px] text-gray-500 uppercase tracking-wider border-b border-gray-300/30">
                      <th className="p-4 font-black">Negocio</th>
                      <th className="p-4 font-black">Teléfono</th>
                      <th className="p-4 font-black">Correo</th>
                      <th className="p-4 font-black">Web / Social</th>
                      <th className="p-4 font-black text-center">Descartar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300/30 text-sm">
                    {leads[expandedCat]?.filter(l => {
                      if (filterFuente === 'all') return true;
                      const leadFuente = (l.fuente || 'desconocida').toLowerCase();
                      if (filterFuente === 'maps') return leadFuente.includes('maps');
                      return leadFuente.includes(filterFuente);
                    }).map(lead => {
                      const esSocial = ['facebook', 'instagram', 'linkedin', 'twitter'].includes((lead.fuente || '').toLowerCase());
                      let redesObj = {};
                      try { redesObj = lead.redesSociales ? (typeof lead.redesSociales === 'string' ? JSON.parse(lead.redesSociales) : lead.redesSociales) : {}; } catch(e) {}
                      
                      let webDisplay = <span className="text-gray-400 italic text-xs">No encontrada</span>;
                      if (esSocial && lead.sitioWeb) {
                        const isFb = (lead.fuente || '').toLowerCase() === 'facebook';
                        const isIg = (lead.fuente || '').toLowerCase() === 'instagram';
                        const isLi = (lead.fuente || '').toLowerCase() === 'linkedin';
                        const color = isFb ? 'text-indigo-600' : isIg ? 'text-pink-500' : isLi ? 'text-sky-600' : 'text-purple-500';
                        webDisplay = <a href={lead.sitioWeb} target="_blank" rel="noopener noreferrer" className={\`flex items-center gap-1.5 hover:underline truncate max-w-[150px] font-medium \${color}\`}><Globe size={14} className="shrink-0"/> <span className="truncate">Perfil</span></a>;
                      } else if (lead.sitioWeb) {
                        webDisplay = <a href={lead.sitioWeb} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline truncate max-w-[150px] font-medium text-blue-500"><Globe size={14} className="shrink-0"/> <span className="truncate">Sitio Web</span></a>;
                      } else if (Object.entries(redesObj)[0]) {
                        const primerRed = Object.entries(redesObj)[0];
                        webDisplay = <a href={primerRed[1]} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:underline truncate max-w-[150px] font-medium text-purple-600"><Globe size={14} className="shrink-0"/> <span className="truncate">{primerRed[0]}</span></a>;
                      }

                      return (
                        <tr key={lead.id} className={\`transition-colors hover:bg-white/30 \${lead.status === 'discarded' ? 'opacity-40 grayscale bg-gray-200/50' : ''}\`}>
                          <td className="p-4 align-top">
                            <div className="flex flex-col gap-1 max-w-[280px]">
                              <span className={\`font-bold text-gray-800 truncate \${lead.status === 'discarded' ? 'line-through' : ''}\`}>{lead.nombre}</span>
                              <span className="text-[10px] text-gray-500 leading-tight line-clamp-2">{lead.direccion || 'Sin dirección'}</span>
                              <span className="text-[9px] uppercase font-bold text-blue-500 bg-blue-100/50 w-max px-1.5 py-0.5 rounded mt-0.5">{lead.fuente || 'Maps'}</span>
                            </div>
                          </td>
                          <td className="p-4 align-top">
                            {lead.telefono ? (
                              <div className="flex items-center gap-1.5 font-bold text-gray-700">
                                <Phone size={14} className="text-green-600 shrink-0" />
                                <span className="whitespace-nowrap">{lead.telefono}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No encontrado</span>
                            )}
                          </td>
                          <td className="p-4 align-top">
                            {lead.correo ? (
                              <div className="flex items-center gap-1.5 font-bold text-gray-700">
                                <Mail size={14} className="text-red-500 shrink-0" />
                                <span className="truncate max-w-[180px]" title={lead.correo}>{lead.correo}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic text-xs">No encontrado</span>
                            )}
                          </td>
                          <td className="p-4 align-top">{webDisplay}</td>
                          <td className="p-4 align-top text-center">
                            <button 
                              onClick={() => toggleStatus(lead.id, lead.status, expandedCat)}
                              className="w-8 h-8 rounded-xl hover:scale-110 active:scale-95 transition-all inline-flex items-center justify-center bg-white shadow-sm border border-gray-100"
                              title={lead.status === 'discarded' ? "Restaurar Lead" : "Descartar Lead"}
                            >
                              {lead.status === 'discarded' ? (
                                <CheckCircle size={16} className="text-green-500" />
                              ) : (
                                <Ban size={16} className="text-red-400" />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>`;

  const newLines = [
    ...lines.slice(0, sIdx),
    table,
    ...lines.slice(eIdx + 1)
  ];
  fs.writeFileSync(filePath, newLines.join('\\n'));
  console.log('Table applied!');
} else {
  console.error('Could not find bounds');
}
