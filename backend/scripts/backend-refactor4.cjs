const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'scraping.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Regex replaces for scrapeGoogleMaps
code = code.replace(/if \(validLinksCount >= totalLimit \* 4\) \{ \/\/ Buscamos 4x para tener margen/g, 
  'if (validLinksCount >= totalLimit * 1.5 + 15) { // Margen moderado para pipeline');
code = code.replace(/linkArray = linkArray\.sort\(\(\) => Math\.random\(\) - 0\.5\)\.slice\(0, Math\.floor\(totalLimit \* 1\.5 \+ 15\)\);/g,
  'linkArray = linkArray.sort(() => Math.random() - 0.5).slice(0, Math.floor(totalLimit * 1.5 + 15));');
code = code.replace(/linkArray = linkArray\.sort\(\(\) => Math\.random\(\) - 0\.5\)\.slice\(0, totalLimit \* 6\);/g,
  'linkArray = linkArray.sort(() => Math.random() - 0.5).slice(0, Math.floor(totalLimit * 1.5 + 15));');
  
code = code.replace(/if \(onLeadFound\) await onLeadFound\(details\);/g, 
  `if (onLeadFound) {
          // Lanza el lead al pipeline de forma concurrente, sin bloquear Maps
          onLeadFound(details).catch(e => console.error("Error en pipeline concurrente:", e));
        }`);

// 2. Replace lines in search-stream
const lines = code.split('\n');

// Find the line index that matches EXACTLY "    const savedCountRef = { count: 0 };" inside the stream route
let startIndex = -1;
let endIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const savedCountRef = { count: 0 };') && startIndex === -1) {
    startIndex = i;
  }
  // Find the exact end of the route before the catch block
  if (startIndex !== -1 && lines[i].includes('res.end();') && lines[i+3] && lines[i+3].includes('} catch (error) {')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newStreamLogic = `    const savedCountRef = { count: 0 };
    let activePipelineTasks = 0;
    let validCount = 0;

    const onLeadScraped = async (n) => {
      if (validCount >= qty) return;
      activePipelineTasks++;

      try {
        let correo = n.correo || null;
        let telefono = n.telefono || null;
        let redesSociales = n.redesSociales || null;

        const normalizeName = (str) => str
          ? str.toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim()
          : '';

        const nombreNorm = normalizeName(n.nombre);

        const todos = await prisma.lead.findMany({
          where: {
            OR: [
              ...(n.telefono ? [{ telefono: n.telefono }] : []),
            ]
          },
          select: { id: true, nombre: true, telefono: true, fuente: true }
        });

        const existe = todos.find(l => normalizeName(l.nombre) === nombreNorm) ||
                       (n.telefono ? todos.find(l => l.telefono === n.telefono) : null);

        if (existe) {
          handleLog(\`[Anti-Dup] Ignorado: \${n.nombre}\`);
          return;
        }

        // PIPELINE ENRICHMENT ON-THE-FLY
        if (n.sitioWeb && (!correo || !telefono) && !n.sitioWeb.includes('facebook.com') && !n.sitioWeb.includes('instagram.com')) {
          handleLog(\`[Enrichment] 🌐 Analizando web en 2º plano: \${n.nombre}\`);
          try {
            const extra = await scrapeWebsiteDetails(n.sitioWeb);
            if (extra.correo) correo = extra.correo;
            if (extra.telefono) telefono = extra.telefono;
            if (extra.redesSociales) redesSociales = extra.redesSociales;
          } catch (e) {}
        }

        // FILTROS ESTRICTOS FINALES
        if (isReqPhone && !telefono) {
          handleLog(\`[Filtro] ❌ \${n.nombre}: sin teléfono tras análisis. Descartado.\`);
          return;
        }
        if (isReqEmail && !correo) {
          handleLog(\`[Filtro] ❌ \${n.nombre}: sin correo tras análisis. Descartado.\`);
          return;
        }
        if (isReqWeb && !n.sitioWeb) {
          handleLog(\`[Filtro] ❌ \${n.nombre}: sin sitio web. Descartado.\`);
          return;
        }
        if (!isReqPhone && !isReqEmail && !isReqWeb && !telefono && !correo && !n.sitioWeb) {
          handleLog(\`[Filtro] ❌ \${n.nombre}: sin ningún dato de contacto. Descartado.\`);
          return;
        }

        if (validCount >= qty) return;
        validCount++;
        savedCountRef.count = validCount; // Sincroniza para detener Maps

        const lead = await prisma.lead.create({
          data: { 
            nombre: n.nombre, 
            telefono: telefono, 
            sitioWeb: n.sitioWeb || null, 
            correo: correo, 
            direccion: n.direccion || null,
            categoria: n.categoria || null,
            calificacion: n.rating ? parseFloat(String(n.rating).replace(',','.')) : null,
            reviews: n.reviews ? parseInt(n.reviews) : null,
            lat: n.lat || null,
            lng: n.lng || null,
            terminoBusqueda: termino,
            ubicacion: ubicacion || null,
            redesSociales: redesSociales ? JSON.stringify(redesSociales) : null,
            fuente: n.fuente || 'Google Maps'
          }
        });

        handleLog(\`[BD] ✅ Lead #\${validCount}/\${qty} guardado: \${n.nombre}\${telefono ? ' 📞' : ''}\${correo ? ' 📧' : ''}\`);

        emitEvent('lead', { 
          ...lead, 
          fuente: n.fuente,
          rating: n.rating,
          reviews: n.reviews,
          lat: lead.lat ?? n.lat,
          lng: lead.lng ?? n.lng,
          redesSociales: redesSociales 
        });
      } catch (e) {
        console.error('Error guardando lead en pipeline:', e.message);
      } finally {
        activePipelineTasks--;
      }
    };

    const selectedSources = fuentes ? fuentes.split(',') : ['maps'];
    let sourcesToRun = [];
    if (selectedSources.includes('maps')) sourcesToRun.push('maps');
    const socialPlatforms = [];
    if (selectedSources.includes('facebook')) socialPlatforms.push('facebook');
    if (socialPlatforms.length > 0) sourcesToRun.push('social');

    const termsToSearch = expandQuery(termino).slice(0, 3);
    const boundsObj = bounds ? JSON.parse(bounds) : null;

    handleLog(\`[Engine] Meta: \${qty} leads finales. Fuentes: \${sourcesToRun.join(', ')}. Modo: Pipeline Concurrente.\`);
    handleLog(\`[Engine] Términos de búsqueda: \${termsToSearch.join(', ')}.\`);

    let negociosTotales = 0;

    let effectiveBounds = bounds; 
    let effectiveBoundsObj = boundsObj; 
    if (!bounds && statesToFilter.length > 0) {
      const stateBounds = getStateBounds(statesToFilter);
      if (stateBounds) {
        effectiveBounds = JSON.stringify(stateBounds);
        effectiveBoundsObj = stateBounds;
        handleLog(\`[Engine] 🗺️ Bounds calculados automáticamente para: \${statesToFilter.join(', ')}\`);
      }
    }

    let gridDensity = 1;
    if (effectiveBoundsObj) {
      const latSpan = Math.abs(effectiveBoundsObj[1][0] - effectiveBoundsObj[0][0]);
      const lngSpan = Math.abs(effectiveBoundsObj[1][1] - effectiveBoundsObj[0][1]);
      const area = latSpan * lngSpan;
      if (area > 20) gridDensity = 5;
      else if (area > 8) gridDensity = 4;
      else if (area > 3) gridDensity = 3;
      else gridDensity = 2;
    }

    const globalVisitedLinks = new Set();

    if (sourcesToRun.includes('maps') && !isClosed && validCount < qty) {
      emitEvent('phase', { phase: 'maps' });
      const gridPoints = effectiveBounds ? generateGrid(effectiveBounds, gridDensity) : [{ lat: null, lng: null }];
      
      const resultMaps = await scrapeGoogleMaps(
        termsToSearch,
        ubicacion,
        gridPoints,
        qty,
        onLeadScraped,
        handleLog,
        () => isClosed || validCount >= qty,
        effectiveBoundsObj,
        savedCountRef,
        globalVisitedLinks,
        statesToFilter
      );
      negociosTotales += resultMaps.length;
    }

    if (sourcesToRun.includes('social') && !isClosed && validCount < qty) {
      const socialLimitPerTerm = Math.max(1, Math.ceil((qty - validCount) / termsToSearch.length));
      for (let i = 0; i < termsToSearch.length; i++) {
        if (isClosed || validCount >= qty) break;
        const term = termsToSearch[i];
        handleLog(\`[Social] Buscando leads ocultos para "\${term}"...\`);
        const resultSocial = await scrapeSocialViaPuppeteer(term, ubicacion, socialPlatforms, socialLimitPerTerm, handleLog, () => isClosed || validCount >= qty);
        for (const n of resultSocial) {
          if (isClosed || validCount >= qty) break;
          onLeadScraped(n).catch(e => console.error(e));
        }
        negociosTotales += resultSocial.length;
      }
    }

    if (activePipelineTasks > 0) {
       handleLog(\`[Engine] ⏳ Esperando a que el pipeline termine (\${activePipelineTasks} leads procesando)...\`);
       while (activePipelineTasks > 0) {
         await new Promise(r => setTimeout(r, 500));
       }
    }

    emitEvent('done', { totalEncontrados: validCount, totalBrutos: negociosTotales });
    clearInterval(heartbeat);
    res.end();`;

  lines.splice(startIndex, endIndex - startIndex + 1, newStreamLogic);
  fs.writeFileSync(filePath, lines.join('\\n'));
  console.log('Successfully replaced stream logic. Start:', startIndex, 'End:', endIndex);
} else {
  console.log('Could not find stream logic bounds:', startIndex, endIndex);
}
