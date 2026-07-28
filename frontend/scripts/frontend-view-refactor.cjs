const fs = require('fs');

let code = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');

// 1. Update eventSource listeners
const eventSourceListeners = `
    eventSource.addEventListener('phase', (e) => {
      try {
        const data = JSON.parse(e.data);
        setScanPhase(data.phase);
      } catch (_) {}
    });

    eventSource.addEventListener('update_lead', (e) => {
      try {
        const updatedLead = JSON.parse(e.data);
        setResults(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      } catch (_) {}
    });

    eventSource.addEventListener('alert', (e) => {
`;
code = code.replace("    eventSource.addEventListener('alert', (e) => {", eventSourceListeners);

// 2. Reset scanPhase on handleScraping
code = code.replace("setLoading(true);", "setLoading(true);\n    setScanPhase('maps');");

// 3. Reset scanPhase on done
code = code.replace("setIsScanning(false);", "setIsScanning(false);\n        setScanPhase('idle');");

// 4. Update the scanning button text
const btnRegex = /<span className="relative z-10 font-bold text-sm tracking-wide group-hover:hidden text-textMain">ESCANEANDO\.\.\.<\/span>/;
code = code.replace(btnRegex, '{scanPhase === \'enrichment\' ? <span className="relative z-10 font-bold text-sm tracking-wide group-hover:hidden text-textMain">ANALIZANDO LEADS...</span> : <span className="relative z-10 font-bold text-sm tracking-wide group-hover:hidden text-textMain">ESCANEANDO...</span>}');

// 5. Hide Facebook option.
// The facebook checkbox is in a div with "Fuentes"
const facebookRegex = /<label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer group">[\s\S]*?checked=\{sources\.facebook\}[\s\S]*?<\/span>\s*<\/label>/;
code = code.replace(facebookRegex, ''); // Remove the label entirely

// 6. Update the Map/Terminal logic
// We need to find the `sources.maps || (!isScanning && !loading) ?` line and replace it with `scanPhase === 'idle' || scanPhase === 'maps' ?`
code = code.replace('{sources.maps || (!isScanning && !loading) ? (', "{scanPhase !== 'enrichment' ? (");

fs.writeFileSync('src/components/ScrapingView.jsx', code);
console.log('ScrapingView refactored');
