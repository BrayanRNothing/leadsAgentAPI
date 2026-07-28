const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'scraping.js');
let code = fs.readFileSync(filePath, 'utf8');

code = code.replace(/handleLog\(\`\[Anti-Dup\] Ignorado:/g, 'console.log(`[Anti-Dup] Ignorado:`); handleLog(`[Anti-Dup] Ignorado:');
code = code.replace(/handleLog\(\`\[Filtro\] ❌/g, 'console.log(`[Filtro] ❌`); handleLog(`[Filtro] ❌');
code = code.replace(/handleLog\(\`\[BD\] ✅/g, 'console.log(`[BD] ✅`); handleLog(`[BD] ✅');

// Also log enrichment
code = code.replace(/handleLog\(\`\[Enrichment\] 🌐 Analizando web en 2º plano:/g, 'console.log(`[Enrichment] 🌐 Analizando web en 2º plano:`); handleLog(`[Enrichment] 🌐 Analizando web en 2º plano:');

fs.writeFileSync(filePath, code);
console.log("Added console.logs");
