const fs = require('fs');

let code = fs.readFileSync('src/components/HistoryView.jsx', 'utf8');

// 1. Añadir variables de estado
const stateVarsStr = `  const [loadingLeads, setLoadingLeads] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailProgress, setEmailProgress] = useState(null);`;

code = code.replace(`  const [loadingLeads, setLoadingLeads] = useState(false);`, stateVarsStr);

// 2. Añadir función handleSendCampaign
const funcStr = `  const handleSendCampaign = async () => {
    if (!emailSubject || !emailBody) return alert("Llena el asunto y el cuerpo del correo.");
    
    const leadsToSend = leads[expandedCat]?.filter(l => l.correo && l.status !== 'discarded');
    if (!leadsToSend || leadsToSend.length === 0) return alert("No hay leads con correo válido en esta búsqueda.");
    
    setIsSendingEmail(true);
    setEmailProgress({ sent: 0, total: leadsToSend.length });
    
    try {
      const res = await axios.post('http://localhost:3001/api/campaigns/send', {
        leads: leadsToSend,
        asunto: emailSubject,
        cuerpo: emailBody,
        nombreCampana: \`Campaña \${expandedCat}\`
      });
      
      let sent = 0;
      const interval = setInterval(() => {
        sent += 1;
        if (sent >= leadsToSend.length) {
          clearInterval(interval);
          setIsSendingEmail(false);
          setShowEmailModal(false);
          setEmailProgress(null);
          // Opcional: mostrar un toast de finalización
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

  const toggleCategory =`;

code = code.replace(`  const toggleCategory =`, funcStr);

// 3. Añadir botón Campaña al lado de Exportar
const btnGroup = `            <div className="flex gap-2 self-end sm:self-auto">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowEmailModal(true); }}
                className="px-4 py-2 flex items-center gap-2 text-purple-600 font-bold text-sm rounded-xl hover:scale-105 active:scale-95 transition-all"
                style={{ background: '#e0e5ec', boxShadow: '3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.8)' }}
              >
                <Mail size={16} />
                Campaña
              </button>
              <button 
                onClick={(e) => handleDownload(e, expandedCat)}
                className="px-4 py-2 flex items-center gap-2 text-blue-600 font-bold text-sm rounded-xl hover:scale-105 active:scale-95 transition-all"
                style={{ background: '#e0e5ec', boxShadow: '3px 3px 6px rgba(163,177,198,0.5), -3px -3px 6px rgba(255,255,255,0.8)' }}
              >
                <Download size={16} />
                Exportar
              </button>
            </div>`;

code = code.replace(/<button\s*onClick={\(e\) => handleDownload\(e, expandedCat\)}[\s\S]*?<\/button>/m, btnGroup);

// 4. Añadir Modal de Email
const modalCode = `      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-lg rounded-2xl p-6 relative"
            style={{ background: '#e0e5ec', boxShadow: '12px 12px 24px rgba(163,177,198,0.7), -12px -12px 24px rgba(255,255,255,0.9)' }}
          >
            <button onClick={() => !isSendingEmail && setShowEmailModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <XCircle size={24} />
            </button>
            <h3 className="text-xl font-black text-gray-800 mb-4 flex items-center gap-2">
              <Mail className="text-purple-500" />
              Nueva Campaña: {expandedCat}
            </h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">Asunto del Correo</label>
                <input 
                  type="text" 
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  disabled={isSendingEmail}
                  className="w-full px-4 py-2 rounded-xl bg-transparent outline-none text-gray-700 font-medium"
                  style={{ boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.9)' }}
                  placeholder="Ej: Propuesta de software para tu restaurante"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-600 mb-1">Mensaje (Usa {{nombre}} para personalizar)</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  disabled={isSendingEmail}
                  rows={6}
                  className="w-full px-4 py-3 rounded-xl bg-transparent outline-none text-gray-700 font-medium custom-scrollbar"
                  style={{ boxShadow: 'inset 4px 4px 8px rgba(163,177,198,0.6), inset -4px -4px 8px rgba(255,255,255,0.9)' }}
                  placeholder="Hola {{nombre}},\n\nNoté que tu negocio..."
                />
              </div>

              {isSendingEmail && emailProgress ? (
                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between text-xs font-bold text-purple-600">
                    <span>Enviando correos...</span>
                    <span>{emailProgress.sent} / {emailProgress.total}</span>
                  </div>
                  <div className="w-full h-3 rounded-full overflow-hidden" style={{ boxShadow: 'inset 2px 2px 4px rgba(163,177,198,0.6)' }}>
                    <div 
                      className="h-full bg-purple-500 transition-all duration-500" 
                      style={{ width: \`\${(emailProgress.sent / emailProgress.total) * 100}%\` }}
                    />
                  </div>
                </div>
              ) : (
                <button 
                  onClick={handleSendCampaign}
                  className="mt-2 w-full py-3 rounded-xl font-black text-white bg-purple-500 hover:bg-purple-600 transition-colors shadow-lg shadow-purple-500/30 flex justify-center items-center gap-2"
                >
                  <Mail size={18} />
                  Lanzar Campaña
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );`;

code = code.replace(/<\/motion\.div>\s*;\s*}\s*$/, modalCode + '\n}\n');

fs.writeFileSync('src/components/HistoryView.jsx', code);
console.log('Script ejecutado correctamente.');
