const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'scraping.js');
let code = fs.readFileSync(filePath, 'utf8');

const lines = code.split('\n');

let startIndex = -1;
let endIndex = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('let gridDensity = 1;') && startIndex === -1) {
    startIndex = i; // Start right before calculating gridDensity
  }
  if (startIndex !== -1 && lines[i].includes('res.end();') && lines[i+3] && lines[i+3].includes('} catch (error) {')) {
    endIndex = i;
    break;
  }
}

if (startIndex !== -1 && endIndex !== -1) {
  const newLogic = `    let gridDensity = 1;
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
    let globalRetry = 0;
    const MAX_GLOBAL_RETRIES = 6; // Allow up to 6 cycles of Map gathering if rejection is high

    while (validCount < qty && globalRetry < MAX_GLOBAL_RETRIES && !isClosed) {
      const leadsFaltantes = qty - validCount;
      
      if (globalRetry > 0) {
        handleLog(\`[Engine] 🔄 Ciclo \${globalRetry + 1}: Faltan \${leadsFaltantes} leads para la meta. Buscando más...\`);
      }

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
        if (effectiveBounds) gridDensity++;
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

      // Wait for the pipeline to empty before deciding to loop again
      if (activePipelineTasks > 0) {
         handleLog(\`[Engine] ⏳ Evaluando leads en progreso (\${activePipelineTasks} leads procesando)...\`);
         while (activePipelineTasks > 0) {
           await new Promise(r => setTimeout(r, 500));
         }
      }

      globalRetry++;
      
      if (validCount >= qty) {
        handleLog(\`[Engine] 🎉 Meta alcanzada (\${validCount}/\${qty}). Terminando proceso.\`);
        break;
      }
    }

    emitEvent('done', { totalEncontrados: validCount, totalBrutos: negociosTotales });
    clearInterval(heartbeat);
    res.end();`;

  lines.splice(startIndex, endIndex - startIndex + 1, newLogic);
  fs.writeFileSync(filePath, lines.join('\n'));
  console.log('Restored while loop successfully.');
} else {
  console.log('Could not find bounds to restore loop.', startIndex, endIndex);
}
