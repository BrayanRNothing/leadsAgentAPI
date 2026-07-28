const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeSocialViaPuppeteer(termino, ubicacion, platforms = ['facebook', 'instagram'], limit = 20) {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox', '--window-size=1200,800']
  });
  
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' });
  const siteQueries = platforms.map(p => {
    if (p === 'linkedin') return 'site:linkedin.com/company/ OR site:linkedin.com/in/';
    return `site:${p}.com`;
  }).join(' OR ');

  const query = `"${termino}" "${ubicacion}" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") ${siteQueries}`;
  console.log("Query:", query);
  
  const leads = [];
  
  try {
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&start=0`;
    console.log("Search URL:", searchUrl);
    await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check for accept cookies button
    try {
      const acceptBtn = await page.$('button[id="W0wltc"]'); // Reject all
      if (acceptBtn) {
        console.log("Clicking reject all cookies");
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      } else {
        const acceptAllBtn = await page.$('button[id="L2AGLb"]');
        if (acceptAllBtn) {
          console.log("Clicking accept all cookies");
          await acceptAllBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      }
    } catch (e) {}

    await page.screenshot({ path: 'google-search.png' });
    const content = await page.content();
    require('fs').writeFileSync('google-search.html', content);

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('div.g').forEach(g => {
        const a = g.querySelector('a');
        const link = a ? a.href : '';
        const title = g.querySelector('h3') ? g.querySelector('h3').innerText : '';
        const snippet = g.innerText;
        items.push({ link, title, snippet });
      });
      return items;
    });
    
    console.log(`Found ${results.length} raw results.`);
    console.log("First result:", results[0]);

    for (const item of results) {
        console.log("Checking:", item.link);
    }
  } catch (error) {
    console.error(`Error en Puppeteer Social Search: ${error.message}`);
  } finally {
    await browser.close();
  }
}

scrapeSocialViaPuppeteer("restaurantes", "madrid");
