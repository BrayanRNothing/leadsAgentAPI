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
  
  // Extraer los links de las tarjetas
  const links = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[class*="hfpxzc"]')).map(a => a.href);
  });
  
  console.log(`Se encontraron ${links.length} enlaces de lugares.`);
  
  const results = [];
  // Solo los primeros 3 para probar
  for (const link of links.slice(0, 3)) {
    console.log(`Entrando a: ${link}`);
    await page.goto(link, { waitUntil: 'networkidle2', timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const details = await page.evaluate(() => {
      const nombre = document.querySelector('h1')?.innerText || '';
      const text = document.body.innerText;
      
      let sitioWeb = null;
      let telefono = null;
      let direccion = null;
      
      // En la vista de detalles, los botones con iconos tienen data-item-id
      // Dirección: data-item-id="address"
      const addrBtn = document.querySelector('button[data-item-id="address"]');
      if (addrBtn) direccion = addrBtn.innerText.trim();
      
      // Teléfono: data-item-id="phone:tel:..."
      const phoneBtn = document.querySelector('button[data-tooltip*="Copiar el número de teléfono"]');
      if (phoneBtn) telefono = phoneBtn.innerText.trim();
      
      // Web: data-item-id="authority"
      const webBtn = document.querySelector('a[data-item-id="authority"]');
      if (webBtn) sitioWeb = webBtn.href;
      
      // Rating
      const ratingEl = document.querySelector('div.F7nice > span > span');
      const rating = ratingEl ? parseFloat(ratingEl.innerText.replace(',', '.')) : null;
      
      return { nombre, direccion, telefono, sitioWeb, rating };
    });
    
    results.push(details);
  }

  console.log(results);
  await browser.close();
}

scrapeGoogleMaps("dentista", "monterrey").catch(console.error);
