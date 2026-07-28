const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'routes', 'scraping.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. Robust bounds parsing
const boundsRegex = /const boundsObj = bounds \? JSON\.parse\(bounds\) : null;/;
const boundsReplacement = `let boundsObj = null;
    try {
      if (bounds) boundsObj = JSON.parse(bounds);
    } catch (e) {
      handleLog(\`[Engine] ⚠ Error parseando bounds: \${e.message}\`);
    }`;
code = code.replace(boundsRegex, boundsReplacement);

// 2. Add detailed initial logs
const engineRegex = /handleLog\(\`\[Engine\] Términos de búsqueda:(.*)\`\);/;
const engineReplacement = `handleLog(\`[Engine] Términos de búsqueda:$1\`);
    handleLog(\`[Engine] ⚙️ Preparando entorno del motor...\`);
    handleLog(\`[Engine] 🚀 Levantando bot de Puppeteer (esto puede tomar unos segundos)...\`);`;
code = code.replace(engineRegex, engineReplacement);

// 3. Speed up Puppeteer in scrapeGoogleMaps
const gotoRegex = /await page\.goto\(link, \{ waitUntil: 'networkidle2', timeout: 30000 \}\);/;
const gotoReplacement = `await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });`;
code = code.replace(gotoRegex, gotoReplacement);

// 4. Ensure we don't hang if Axios hangs in scrapeWebsiteDetails.
// Actually, axios already has timeout 10000, so it's fine.

// Let's replace the first `res.write` if needed, but it's already fixed.

fs.writeFileSync(filePath, code);
console.log("Robustification applied.");
