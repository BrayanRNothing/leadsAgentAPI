const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeDDGPuppeteer() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const query = `"restaurantes" "madrid" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") site:instagram.com`;
  
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    await page.screenshot({ path: 'ddg-search.png' });
    const content = await page.content();
    require('fs').writeFileSync('ddg-search.html', content);

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.result').forEach(el => {
        const a = el.querySelector('.result__url');
        const link = a ? a.href : '';
        const titleEl = el.querySelector('.result__title');
        const title = titleEl ? titleEl.innerText : '';
        const snipEl = el.querySelector('.result__snippet');
        const snippet = snipEl ? snipEl.innerText : '';
        if (link) {
          items.push({ link, title, snippet });
        }
      });
      return items;
    });
    
    console.log(`Found ${results.length} results.`);
    if (results.length > 0) console.log(results[0]);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

scrapeDDGPuppeteer();
