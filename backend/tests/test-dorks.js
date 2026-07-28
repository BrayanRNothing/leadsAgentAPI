const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function testDork(query) {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9' });
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=30`;
    console.log('\n=== Probando query ===');
    console.log('URL:', searchUrl);
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));
    
    const title = await page.title();
    console.log('Título:', title);

    // Intentar múltiples selectores de Google
    const count = await page.evaluate(() => {
      return {
        'div.g': document.querySelectorAll('div.g').length,
        'div[data-sokoban-container]': document.querySelectorAll('div[data-sokoban-container]').length,
        'h3': document.querySelectorAll('h3').length,
        'a[href]': document.querySelectorAll('a[href^="http"]').length,
      };
    });
    console.log('Selectores encontrados:', count);

    // Intentar leer los h3 disponibles (genérico)
    const h3s = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('h3')).slice(0, 5).map(h => h.innerText);
    });
    console.log('H3s encontrados:', h3s);
  } finally {
    await browser.close();
  }
}

async function run() {
  // Probar 3 variaciones del dork, de más simple a más complejo
  await testDork('pizzeria monterrey site:instagram.com');
  await testDork('pizzeria monterrey site:facebook.com');
  await testDork('pizzeria monterrey instagram "@gmail.com"');
}

run().catch(console.error);
