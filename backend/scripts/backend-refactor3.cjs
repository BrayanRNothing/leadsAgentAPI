const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'scraping.js');
let code = fs.readFileSync(filePath, 'utf8');
const lines = code.split('\n');

const startIdx = 976; // Line 977 (0-indexed)
const endIdx = 1127; // Line 1128

const newCode = `    let finalCount = 0;
    let globalRetry = 0;
    const MAX_GLOBAL_RETRIES = 4;
    let gridDensity = 1;
    
    // Calcular densidad inicial del grid
    if (effectiveBoundsObj) {
      const latSpan = Math.abs(effectiveBoundsObj[1][0] - effectiveBoundsObj[0][0]);
      const lngSpan = Math.abs(effectiveBoundsObj[1][1] - effectiveBoundsObj[0][1]);
      const area = latSpan * lngSpan;
      if (area > 20) gridDensity = 5;
      else if (area > 8) gridDensity = 4;
      else if (area > 3) gridDensity = 3;
      else gridDensity = 2;
      handleLog(\`[Engine] 🛠️ Grid inicial \${gridDensity}×\${gridDensity} para área de \${(latSpan * lngSpan).toFixed(1)}°²\`);
    }

    const globalVisitedLinks = new Set();
    const enrichedIds = new Set();

    while (finalCount < qty && globalRetry < MAX_GLOBAL_RETRIES && !isClosed) {
      const leadsFaltantes = qty - finalCount;
      
      if (globalRetry > 0) {
        handleLog(\`[Engine] 🔄 Ciclo \${globalRetry + 1}: Faltan \${leadsFaltantes} leads para la meta. Refinando búsqueda...\`);
      }

      // 1. Google Maps
      if (sourcesToRun.includes('maps') && !isClosed) {
        const gridPoints = effectiveBounds ? generateGrid(effectiveBounds, gridDensity) : [{ lat: null, lng: null }];
        if (gridPoints[0]?.lat) {
          handleLog(\`[Engine] Grid \${gridDensity}×\${gridDensity}: \${gridPoints.length} cuadrantes a explorar.\`);
        }
        
        const resultMaps = await scrapeGoogleMaps(
          termsToSearch,
          ubicacion,
          gridPoints,
          qty,
          onLeadScraped,
          handleLog,
          () => isClosed,
          effectiveBoundsObj,
          savedCountRef,
          globalVisitedLinks,
          statesToFilter
        );
        negociosTotales += resultMaps.length;
        if (effectiveBounds) gridDensity++;
      }

      // 2. Redes Sociales
      if (sourcesToRun.includes('social') && !isClosed) {
        const socialLimitPerTerm = Math.max(1, Math.ceil(leadsFaltantes / termsToSearch.length));
        for (let i = 0; i < termsToSearch.length; i++) {
          if (isClosed) break;
          const term = termsToSearch[i];
          handleLog(\`[Social] Buscando leads ocultos para "\${term}" (\${i+1}/\${termsToSearch.length})...\`);
          const resultSocial = await scrapeSocialViaPuppeteer(term, ubicacion, socialPlatforms, socialLimitPerTerm, handleLog, () => isClosed);
          for (const n of resultSocial) {
            if (isClosed || savedCountRef.count >= qty) break;
            await onLeadScraped(n);
          }
          negociosTotales += resultSocial.length;
        }
      }

      // 3. Fase 2: Deep Enrichment
      if (!isClosed) {
        emitEvent('phase', { phase: 'enrichment' });
        handleLog(\`[Enrichment] 🔍 Iniciando análisis profundo de sitios web (Ciclo \${globalRetry + 1})...\`);
        
        const allLeadsWithWeb = await prisma.lead.findMany({
          where: { terminoBusqueda: termino, sitioWeb: { not: null } }
        });
        
        // Solo enriquecer los que no hemos procesado antes
        const leadsToEnrich = allLeadsWithWeb.filter(l => !enrichedIds.has(l.id));
        
        if (leadsToEnrich.length > 0) {
          handleLog(\`[Enrichment] 🌐 \${leadsToEnrich.length} leads nuevos con web para analizar.\`);
          let enrichedCount = 0;
          let discardedCount = 0;

          const enrichOne = async (lead) => {
            if (isClosed) return;
            enrichedIds.add(lead.id);

            if (lead.correo && lead.telefono) return; 

            if (lead.sitioWeb.includes('facebook.com') || lead.sitioWeb.includes('instagram.com')) {
              handleLog(\`[Enrichment] ⏭️ Omitiendo red social de \${lead.nombre}\`);
              return;
            }

            handleLog(\`[Enrichment] 🌐 Analizando: \${lead.nombre}\`);
            const extra = await scrapeWebsiteDetails(lead.sitioWeb);

            const finalCorreo = extra.correo || lead.correo;
            const finalTelefono = extra.telefono || lead.telefono;
            const finalRedes = extra.redesSociales || (lead.redesSociales ? JSON.parse(lead.redesSociales) : null);

            let descartar = false;

            if (isReqEmail && !finalCorreo) {
              descartar = true;
              handleLog(\`[Enrichment] ❌ \${lead.nombre}: sin correo tras análisis. Descartado.\`);
            } else if (isReqPhone && !finalTelefono) {
              descartar = true;
              handleLog(\`[Enrichment] ❌ \${lead.nombre}: sin teléfono tras análisis. Descartado.\`);
            }

            if (descartar) {
              discardedCount++;
              await prisma.lead.delete({ where: { id: lead.id } });
              emitEvent('delete_lead', { id: lead.id });
              savedCountRef.count--;
            } else if (extra.correo || extra.telefono || extra.redesSociales) {
              const updatedLead = await prisma.lead.update({
                where: { id: lead.id },
                data: {
                  correo: finalCorreo,
                  telefono: finalTelefono,
                  redesSociales: finalRedes ? JSON.stringify(finalRedes) : null
                }
              });
              emitEvent('update_lead', updatedLead);
              enrichedCount++;
              const found = [];
              if (extra.correo) found.push(\`📧 \${extra.correo}\`);
              if (extra.telefono) found.push(\`📞 \${extra.telefono}\`);
              handleLog(\`[Enrichment] ✅ \${lead.nombre}: \${found.join(', ')}\`);
            } else {
              handleLog(\`[Enrichment] ⚠️ \${lead.nombre}: sin datos nuevos. Se mantiene.\`);
            }
          };

          const CONCURRENCY = 5;
          for (let i = 0; i < leadsToEnrich.length; i += CONCURRENCY) {
            if (isClosed) break;
            const batch = leadsToEnrich.slice(i, i + CONCURRENCY);
            await Promise.allSettled(batch.map(lead => enrichOne(lead)));
          }
          handleLog(\`[Enrichment] 🏁 Análisis del ciclo terminado. ✅ \${enrichedCount} enriquecidos, ❌ \${discardedCount} descartados.\`);
        } else {
          handleLog(\`[Enrichment] ⏭️ No hay leads nuevos con web para analizar en este ciclo.\`);
        }
      }

      // 4. Actualizar conteo final para evaluar si se rompe el bucle
      finalCount = await prisma.lead.count({ where: { terminoBusqueda: termino } });
      savedCountRef.count = finalCount;
      
      globalRetry++;
      
      if (finalCount >= qty) {
        handleLog(\`[Engine] 🎉 Meta alcanzada (\${finalCount}/\${qty}). Terminando proceso.\`);
        break;
      } else if (globalRetry < MAX_GLOBAL_RETRIES && !isClosed) {
        handleLog(\`[Engine] ⚠️ Aún faltan leads (\${finalCount}/\${qty}). Iniciando nuevo ciclo de búsqueda...\`);
        emitEvent('phase', { phase: 'maps' }); // Volver a mostrar fase 'maps' en el UI
      }
    }
`;

lines.splice(startIdx, endIdx - startIdx + 1, newCode);
fs.writeFileSync(filePath, lines.join('\n'));
console.log('Replaced lines successfully');
