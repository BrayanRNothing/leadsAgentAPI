const fs = require('fs');

let code = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');

// 1. Add Filter icon to imports
code = code.replace(/import { (.*?) } from 'lucide-react';/, "import { $1, Filter, X } from 'lucide-react';");

// 2. Add showFiltersModal state
const modalState = `  const [showFiltersModal, setShowFiltersModal] = useState(false);\n`;
code = code.replace('  const [showCompletionModal, setShowCompletionModal]', modalState + '  const [showCompletionModal, setShowCompletionModal]');

// 3. Append to URL in handleScraping
const urlLine = "const url = `http://localhost:3001/api/scraping/search-stream?termino=${encodeURIComponent(termino)}&ubicacion=${encodeURIComponent(ubicacion)}&fuentes=${fuentesToRun.join(',')}&quantity=${quantity}${boundsParam}${statesParam}&reqPhone=${reqFilters.phone}&reqEmail=${reqFilters.email}&reqWeb=${reqFilters.website}`;";
code = code.replace(/const url = `http:\/\/localhost:3001.*?`;/, urlLine);

// 4. Add the Filter button next to Quantity
const filterButton = `
                <div className="h-6 w-px bg-gray-200 mx-2"></div>
                <button
                  type="button"
                  onClick={() => setShowFiltersModal(true)}
                  className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0 relative"
                  title="Filtros Estrictos"
                >
                  <Filter size={18} className="text-gray-500" />
                  {(reqFilters.phone || reqFilters.email || reqFilters.website) && (
                    <div className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </button>
              </div>
`;
code = code.replace(/<span className="text-gray-500 text-sm font-medium pr-3">leads<\/span>\s*<\/div>/, `<span className="text-gray-500 text-sm font-medium pr-3">leads</span>\n${filterButton}`);

// 5. Add Filters Modal JSX
const modalJSX = `
      <AnimatePresence>
        {showFiltersModal && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
            onClick={() => setShowFiltersModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="bg-[#e0e5ec] w-full max-w-sm rounded-[24px] p-6 relative"
              style={{ boxShadow: '8px 8px 16px rgba(163,177,198,0.7), -8px -8px 16px rgba(255,255,255,0.8)' }}
            >
              <button onClick={() => setShowFiltersModal(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">
                <X size={20} />
              </button>
              <h3 className="text-lg font-bold text-gray-800 mb-1 flex items-center gap-2"><Filter size={20} className="text-blue-500" /> Filtros Estrictos</h3>
              <p className="text-xs text-gray-500 mb-6">Descarta automáticamente los leads que no cumplan con estos requisitos de contacto.</p>
              
              <div className="space-y-4">
                {[
                  { key: 'phone', label: 'Debe tener Teléfono', desc: 'Descarta si no tiene número.' },
                  { key: 'email', label: 'Debe tener Correo', desc: 'Descarta si el bot no le encuentra email.' },
                  { key: 'website', label: 'Debe tener Sitio Web', desc: 'Descarta si no tiene página.' },
                ].map(f => (
                  <label key={f.key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center shrink-0 mt-1">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={reqFilters[f.key]} 
                        onChange={(e) => setReqFilters(prev => ({ ...prev, [f.key]: e.target.checked }))}
                      />
                      <div className={\`w-10 h-5 rounded-full transition-colors \${reqFilters[f.key] ? 'bg-blue-500' : 'bg-gray-300'}\`} style={{ boxShadow: 'inset 2px 2px 4px rgba(0,0,0,0.2)' }}></div>
                      <div className={\`absolute left-1 w-3.5 h-3.5 rounded-full bg-white transition-transform \${reqFilters[f.key] ? 'translate-x-4.5' : ''}\`} style={{ boxShadow: '1px 1px 3px rgba(0,0,0,0.3)' }}></div>
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-700 group-hover:text-blue-600 transition-colors">{f.label}</div>
                      <div className="text-xs text-gray-500">{f.desc}</div>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-6">
                <button onClick={() => setShowFiltersModal(false)} className="w-full h-10 rounded-xl font-bold text-sm text-gray-700 hover:text-blue-600 transition-all active:scale-95" style={{ background: '#e0e5ec', boxShadow: '4px 4px 8px rgba(163,177,198,0.5), -4px -4px 8px rgba(255,255,255,0.8)' }}>
                  Listo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
`;
code = code.replace(/<ToastContainer toasts=\{toasts\} onDismiss=\{dismissToast\} \/>/, `<ToastContainer toasts={toasts} onDismiss={dismissToast} />\n${modalJSX}`);

fs.writeFileSync('src/components/ScrapingView.jsx', code);
console.log('Frontend filters UI added');
