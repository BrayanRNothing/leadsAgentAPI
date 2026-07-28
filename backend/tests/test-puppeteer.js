const puppeteer = require('puppeteer');

async function scrapeGoogleMaps(termino, ubicacion) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' });
  
  const query = encodeURIComponent(`${termino} en ${ubicacion}`);
  await page.goto(`https://www.google.com/maps/search/${query}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 4000));
  
  const items = await page.evaluate(() => {
    const results = [];
    const elements = document.querySelectorAll('a[class*="hfpxzc"]');
    
    elements.forEach(a => {
      const nombre = a.getAttribute('aria-label');
      const sitioWeb = a.href; // El enlace del lugar, pero necesitamos su web real, no su URL de maps.
      // Wait, a.href is the Google Maps link. The actual website is inside the card.
      
      // La tarjeta entera es el div padre que lo contiene
      const card = a.closest('div[role="article"]') || a.parentElement.parentElement;
      const text = card ? card.innerText : '';
      const lines = text.split('\n').filter(l => l.trim().length > 0);
      
      let rating = null;
      let reviews = null;
      let categoria = null;
      let telefono = null;
      let direccion = null;
      
      const ratingMatch = text.match(/(\d[\.,]\d)\s*\(([\d\.]+)\)/);
      if (ratingMatch) {
        rating = parseFloat(ratingMatch[1].replace(',', '.'));
        reviews = parseInt(ratingMatch[2].replace(/\./g, ''));
      }
      
      lines.forEach(line => {
        if (/^\+?\d[\d\s-]{7,15}$/.test(line)) {
          telefono = line;
        } else if (line.includes('·') && !categoria) {
          const parts = line.split('·').map(p => p.trim());
          if (parts.length >= 2 && !parts[0].includes('Abierto') && !parts[0].includes('Cerrado')) {
            categoria = parts[0];
            direccion = parts[1];
          }
        }
      });
      
      results.push({ nombre, rating, reviews, categoria, telefono, direccion, rawText: text.replace(/\n/g, ' | ') });
    });
    return results;
  });

  console.log(`Maps devolvió ${items.length} negocios.`);
  console.log(items.slice(0, 3));
  
  await browser.close();
}

scrapeGoogleMaps("agencia de autos", "monterrey").catch(console.error);
