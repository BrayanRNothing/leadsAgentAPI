const fs = require('fs');

let code = fs.readFileSync('src/routes/scraping.js', 'utf8');

// 1. Phase 1 Filter: Ignore leads with NO phone, NO email, NO website
const p1Filter = `
        if (existe) {
          handleLog(\`[Anti-Dup] Ignorado: \${n.nombre}\`);
          return;
        }

        // NUEVO FILTRO: Si no tiene teléfono, ni correo, ni sitio web, descartar de inmediato
        if (!n.telefono && !correo && !n.sitioWeb) {
          handleLog(\`[Filtro] Descartado \${n.nombre}: sin teléfono, correo ni web.\`);
          return;
        }
`;
code = code.replace(`
        if (existe) {
          handleLog(\`[Anti-Dup] Ignorado: \${n.nombre}\`);
          return;
        }
`, p1Filter);

// 2. Phase 2 Filter: If after enrichment it still lacks phone and email, delete it.
const p2Filter = `
        handleLog(\`[Enrichment] 🌐 Analizando web: \${lead.sitioWeb}\`);
        const extra = await scrapeWebsiteDetails(lead.sitioWeb);
        
        const finalCorreo = extra.correo || lead.correo;
        const finalRedes = extra.redesSociales || lead.redesSociales;
        
        if (!finalCorreo && !lead.telefono) {
          // No encontró nada en la web y tampoco tenía teléfono, se descarta.
          await prisma.lead.delete({ where: { id: lead.id } });
          emitEvent('delete_lead', { id: lead.id });
          handleLog(\`[Enrichment] 🗑️ Descartando \${lead.nombre}: sin correo ni teléfono tras análisis.\`);
        } else if (extra.correo || extra.redesSociales) {
          // Sí encontró algo, actualizar.
          const updatedLead = await prisma.lead.update({
            where: { id: lead.id },
            data: {
              correo: finalCorreo,
              redesSociales: finalRedes
            }
          });
          emitEvent('update_lead', updatedLead);
          enrichedCount++;
          handleLog(\`[Enrichment] ✅ Datos encontrados para \${lead.nombre}\`);
        } else {
          handleLog(\`[Enrichment] ❌ Sin datos nuevos para \${lead.nombre} (se mantiene por tener teléfono)\`);
        }
`;

const p2Regex = /handleLog\(\`\[Enrichment\] 🌐 Analizando web: \$\{lead\.sitioWeb\}\`\);\s*const extra = await scrapeWebsiteDetails\(lead\.sitioWeb\);\s*if \(extra\.correo \|\| extra\.redesSociales\) \{[\s\S]*?\} else \{\s*handleLog\(\`\[Enrichment\] ❌ Sin datos para \$\{lead\.nombre\}\`\);\s*\}/;

code = code.replace(p2Regex, p2Filter);

fs.writeFileSync('src/routes/scraping.js', code);
console.log('Backend discard filter applied');

// Now, update ScrapingView to handle 'delete_lead'
let viewCode = fs.readFileSync('src/components/ScrapingView.jsx', 'utf8');
const deleteHandler = `
    eventSource.addEventListener('update_lead', (e) => {
      try {
        const updatedLead = JSON.parse(e.data);
        setResults(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
      } catch (_) {}
    });

    eventSource.addEventListener('delete_lead', (e) => {
      try {
        const { id } = JSON.parse(e.data);
        setResults(prev => prev.filter(l => l.id !== id));
      } catch (_) {}
    });
`;

viewCode = viewCode.replace(/eventSource\.addEventListener\('update_lead', \(e\) => \{[\s\S]*?\}\);/, deleteHandler);

fs.writeFileSync('src/components/ScrapingView.jsx', viewCode);
console.log('Frontend delete_lead handler added');
