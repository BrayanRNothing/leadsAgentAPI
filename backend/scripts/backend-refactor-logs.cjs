const fs = require('fs');

let code = fs.readFileSync('src/routes/scraping.js', 'utf8');

const p2Filter = `
        handleLog(\`[Enrichment] 🌐 Entrando a sitio web de \${lead.nombre}: \${lead.sitioWeb}\`);
        handleLog(\`[Enrichment] ⏳ Validando sus datos...\`);
        const extra = await scrapeWebsiteDetails(lead.sitioWeb);
        
        const finalCorreo = extra.correo || lead.correo;
        const finalRedes = extra.redesSociales || lead.redesSociales;
        
        if (!finalCorreo && !lead.telefono) {
          // No encontró nada en la web y tampoco tenía teléfono, se descarta.
          await prisma.lead.delete({ where: { id: lead.id } });
          emitEvent('delete_lead', { id: lead.id });
          handleLog(\`[Enrichment] ❌ No se encontraron medios de contacto para \${lead.nombre}. Descartando...\`);
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
          handleLog(\`[Enrichment] ✅ Correo encontrado para \${lead.nombre}: \${extra.correo || 'Solo Redes'}\`);
        } else {
          handleLog(\`[Enrichment] ⚠️ Sin correo nuevo para \${lead.nombre}, pero se mantiene por tener teléfono.\`);
        }
`;

const p2Regex = /handleLog\(\`\[Enrichment\] 🌐 Analizando web: \$\{lead\.sitioWeb\}\`\);[\s\S]*?handleLog\(\`\[Enrichment\] ❌ Sin datos nuevos para \$\{lead\.nombre\} \(se mantiene por tener teléfono\)\`\);\s*\}/;

code = code.replace(p2Regex, p2Filter);

// Update Facebook skipping message
code = code.replace(/handleLog\(\`\[Enrichment\] ⏭️ Omitiendo Facebook: \$\{lead\.sitioWeb\}\`\);/, "handleLog(`[Enrichment] ⏭️ Omitiendo página de Facebook de ${lead.nombre}`);");

fs.writeFileSync('src/routes/scraping.js', code);
console.log('Backend texts updated');
