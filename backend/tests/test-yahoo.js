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
    
    // Check for accept cookies button
    try {
      const agreeBtn = await page.$('button.agree');
      if (agreeBtn) {
        await agreeBtn.click();
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (e) {}
    
    await page.screenshot({ path: 'yahoo-search.png' });

    const content = await page.content();
    require('fs').writeFileSync('yahoo-search.html', content);
    console.log("Saved yahoo-search.html");
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await browser.close();
  }
}

scrapeYahoo();
