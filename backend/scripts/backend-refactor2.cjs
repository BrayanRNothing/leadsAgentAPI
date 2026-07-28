const fs = require('fs');

let code = fs.readFileSync('src/routes/scraping.js', 'utf8');

const phase2Injection = `
    // Fase 2: Deep Enrichment
    if (!isClosed) {
      emitEvent('phase', { phase: 'enrichment' });
      handleLog(\`[Enrichment] 🔍 Iniciando análisis profundo de sitios web...\`);
      
      const leadsToEnrich = await prisma.lead.findMany({
        where: { busquedaId: Number(busqueda.id), sitioWeb: { not: null }, correo: null }
      });
      
      let enrichedCount = 0;
      for (const lead of leadsToEnrich) {
        if (isClosed) break;
        if (lead.sitioWeb.includes('facebook.com')) {
          handleLog(\`[Enrichment] ⏭️ Omitiendo Facebook: \${lead.sitioWeb}\`);
          continue;
        }
        
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
    }

    emitEvent('done', { totalEncontrados: savedCountRef.count, totalBrutos: negociosTotales });
    clearInterval(heartbeat);
    res.end();
`;

// Replace the end of the function
const endRegex = /emitEvent\('done', \{ totalEncontrados: savedCountRef\.count, totalBrutos: negociosTotales \}\);\s*clearInterval\(heartbeat\);\s*res\.end\(\);/;

code = code.replace(endRegex, phase2Injection);

fs.writeFileSync('src/routes/scraping.js', code);
console.log('Backend refactored successfully');
