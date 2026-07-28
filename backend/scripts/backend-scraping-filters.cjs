const fs = require('fs');

let code = fs.readFileSync('src/routes/scraping.js', 'utf8');

// 1. Get reqPhone, reqEmail, reqWeb from req.query
code = code.replace(
  "  const { termino, ubicacion, fuentes, quantity, states, bounds } = req.query;",
  "  const { termino, ubicacion, fuentes, quantity, states, bounds, reqPhone, reqEmail, reqWeb } = req.query;\n  const isReqPhone = reqPhone === 'true';\n  const isReqEmail = reqEmail === 'true';\n  const isReqWeb = reqWeb === 'true';"
);

// 2. Modify onLeadScraped strict filters
const newFilter = `        // FILTROS ESTRICTOS
        if (isReqPhone && !n.telefono) {
          handleLog(\`[Filtro] Descartado \${n.nombre}: No tiene teléfono.\`);
          return;
        }
        if (isReqWeb && !n.sitioWeb) {
          handleLog(\`[Filtro] Descartado \${n.nombre}: No tiene sitio web.\`);
          return;
        }
        if (isReqEmail && !correo && !n.sitioWeb) {
          handleLog(\`[Filtro] Descartado \${n.nombre}: No tiene correo ni sitio web para buscarlo.\`);
          return;
        }

        // NUEVO FILTRO: Si no tiene teléfono, ni correo, ni sitio web, descartar de inmediato`;

code = code.replace(
  '        // NUEVO FILTRO: Si no tiene teléfono, ni correo, ni sitio web, descartar de inmediato',
  newFilter
);

// 3. Modify Enrichment phase filter
const phase2OldFilter = `        if (!finalCorreo && !lead.telefono && Object.keys(finalRedes).length === 0) {
          handleLog(\`[Enrichment] ❌ No se encontraron medios de contacto para \${lead.nombre}. Descartando...\`);`;

const phase2NewFilter = `        let descartar = (!finalCorreo && !lead.telefono && Object.keys(finalRedes).length === 0);
        
        // Filtro estricto de correo
        if (isReqEmail && !finalCorreo) {
          descartar = true;
          handleLog(\`[Enrichment] ❌ \${lead.nombre} descartado: Se exigía correo y no se encontró.\`);
        } else if (descartar) {
          handleLog(\`[Enrichment] ❌ No se encontraron medios de contacto para \${lead.nombre}. Descartando...\`);
        }

        if (descartar) {`;

code = code.replace(phase2OldFilter, phase2NewFilter);

fs.writeFileSync('src/routes/scraping.js', code);
console.log('Backend filters logic added');
