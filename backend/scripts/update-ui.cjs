const fs = require('fs');
const filePath = '../frontend/src/components/ScrapingView.jsx';
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace('setLogs([]);', 'setLogs([]);\n    setPipelineStats({ descartados: 0, conCorreo: 0, totalExtraidos: 0 });');

const logListenerOld = `eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, data.message]);
      
      if (data.message.includes('Enfriamiento')) {
        const match = data.message.match(/Esperando (\\d+)s/i) || data.message.match(/Pausa de (\\d+)s/i);
        if (match) setCooldown(parseInt(match[1], 10));
      } else {
        setCooldown(0);
      }
    });`;

const logListenerNew = `eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      setLogs(prev => [...prev, data.message]);
      
      // Actualizar KPIs
      if (data.message.includes('[Filtro] ❌') || data.message.includes('[Anti-Dup] Ignorado')) {
        setPipelineStats(p => ({ ...p, descartados: p.descartados + 1 }));
      }
      if (data.message.includes('[BD] ✅')) {
        setPipelineStats(p => {
          let hasEmail = data.message.includes('📧') ? 1 : 0;
          return { ...p, totalExtraidos: p.totalExtraidos + 1, conCorreo: p.conCorreo + hasEmail };
        });
      }

      if (data.message.includes('Enfriamiento') || data.message.includes('Cooldown')) {
        const match = data.message.match(/Esperando (\\d+)s/i) || data.message.match(/Pausa de (\\d+)s/i) || data.message.match(/Cooldown: (\\d+)s/i);
        if (match) setCooldown(parseInt(match[1], 10));
      } else {
        setCooldown(0);
      }
    });`;

code = code.replace(logListenerOld, logListenerNew);

// Ahora reemplazamos la zona de "Leads X En vivo"
const uiOld = `<div className="flex items-center gap-2">
              <h3 className="text-base font-black text-textMain">Leads</h3>
              <span className="bg-primary text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">{results.length}</span>
              {isScanning && <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>En vivo</span>}
            </div>`;

const uiNew = `<div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-textMain">Leads</h3>
                <span className="bg-primary text-white text-xs font-black px-2.5 py-0.5 rounded-full shadow-sm">{results.length}</span>
                {isScanning && <span className="flex items-center gap-1 text-[10px] font-bold text-primary uppercase tracking-wide"><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span></span>Buscando...</span>}
              </div>
              {isScanning && (
                <div className="flex items-center gap-3 text-[10px] font-medium text-gray-500 uppercase tracking-wider mt-1">
                  <span className="flex items-center gap-1"><CheckCircle size={10} className="text-green-500"/> {pipelineStats.totalExtraidos} Extraídos</span>
                  <span className="flex items-center gap-1"><XCircle size={10} className="text-red-400"/> {pipelineStats.descartados} Descartados</span>
                  <span className="flex items-center gap-1"><Mail size={10} className="text-blue-400"/> {pipelineStats.conCorreo} c/Correo</span>
                </div>
              )}
            </div>`;

code = code.replace(uiOld, uiNew);

fs.writeFileSync(filePath, code);
console.log("UI updated!");
