const fs = require('fs');

let code = fs.readFileSync('src/routes/scraping.js', 'utf8');

const syncEnrichment = `      if (n.fuente === 'Google Maps' && n.sitioWeb) {
        handleLog(\`[Stream] Buscando correo/redes web en: \${n.sitioWeb}\`);
        const extra = await scrapeWebsiteDetails(n.sitioWeb);
        if (extra.correo) correo = extra.correo;
        if (extra.redesSociales) redesSociales = extra.redesSociales;
      }`;

code = code.replace(syncEnrichment, '');

// Now we need to inject phase 2.
// In `search-stream`, the maps loop finishes at:
// handleLog(`[Maps] 🏁 Navegador cerrado. Total leads válidos: ${savedCountRef.count}`);
// emitEvent('done', { totalEncontrados: savedCountRef.count });
// return;

const phase2Injection = `
        handleLog(\`[Maps] 🏁 Navegador cerrado. Fase 1 completada con \${savedCountRef.count} leads.\`);
        
        // Fase 2: Deep Enrichment
        emitEvent('phase', { phase: 'enrichment' });
        handleLog(\`[Enrichment] 🔍 Iniciando análisis profundo de sitios web...\`);
        
        const leadsToEnrich = await prisma.lead.findMany({
          where: { busquedaId: Number(busqueda.id), sitioWeb: { not: null }, correo: null }
        });
        
        let enrichedCount = 0;
        for (const lead of leadsToEnrich) {
          handleLog(\`[Enrichment] 🌐 Analizando web: \${lead.sitioWeb}\`);
          const extra = await scrapeWebsiteDetails(lead.sitioWeb);
          if (extra.correo || extra.redesSociales) {
            const updatedLead = await prisma.lead.update({
              where: { id: lead.id },
              data: {
                correo: extra.correo || lead.correo,
                redesSociales: extra.redesSociales || lead.redesSociales
              }
            });
            emitEvent('update_lead', updatedLead);
            enrichedCount++;
            handleLog(\`[Enrichment] ✅ Datos encontrados para \${lead.nombre} (Correo: \${extra.correo ? 'Sí' : 'No'})\`);
          } else {
            handleLog(\`[Enrichment] ❌ Sin datos para \${lead.nombre}\`);
          }
        }
        
        handleLog(\`[Enrichment] 🏁 Análisis profundo terminado. \${enrichedCount} leads enriquecidos.\`);
        emitEvent('done', { totalEncontrados: savedCountRef.count });
        return;
`;

const mapsFinishedRegex = /handleLog\(\`\[Maps\] 🏁 Navegador cerrado\. Total leads válidos: \$\{savedCountRef\.count\}\`\);\s*emitEvent\('done', \{ totalEncontrados: savedCountRef\.count \}\);\s*return;/;

code = code.replace(mapsFinishedRegex, phase2Injection);

fs.writeFileSync('src/routes/scraping.js', code);
console.log('Backend refactored');
