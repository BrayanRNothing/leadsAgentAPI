const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeYahoo() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const query = `"restaurantes" "madrid" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") site:instagram.com`;
  
  try {
    const url = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`;
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check for agree cookies button
    try {
      const agreeBtn = await page.$('button.agree');
      if (agreeBtn) {
        await agreeBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {}

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('.algo-sr').forEach(el => {
        // Find the title and link
        const a = el.querySelector('a');
        if (!a) return;
        const link = a.href;
        const title = a.innerText;
        // Find the snippet
        const snipEl = el.querySelector('.compText');
        const snippet = snipEl ? snipEl.innerText : '';
        
        items.push({ link, title, snippet });
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

scrapeYahoo();
