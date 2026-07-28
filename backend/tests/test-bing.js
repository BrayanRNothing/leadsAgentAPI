const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

async function scrapeBing() {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--headless=new', '--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  const query = `"restaurantes" "madrid" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") site:instagram.com`;
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Check for accept cookies button
    try {
      const acceptBtn = await page.$('button[id="bnp_btn_accept"]');
      if (acceptBtn) {
        console.log("Clicking accept all cookies");
        await acceptBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {}

    await page.screenshot({ path: 'bing-search.png' });

    const results = await page.evaluate(() => {
      const items = [];
      document.querySelectorAll('li.b_algo').forEach(el => {
        const a = el.querySelector('h2 a');
        const link = a ? a.href : '';
        const title = a ? a.innerText : '';
        const p = el.querySelector('.b_caption p') || el.querySelector('p');
        const snippet = p ? p.innerText : '';
        items.push({ link, title, snippet });
      });
      return items;
    });
    
    console.log(`Found ${results.length} results.`);
    console.log(results[0]);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

scrapeBing();
