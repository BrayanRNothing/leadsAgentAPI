const axios = require('axios');
const cheerio = require('cheerio');

async function testDDGLite() {
    const query = `"restaurantes" "madrid" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") site:instagram.com`;
    try {
        const { data } = await axios.post('https://lite.duckduckgo.com/lite/', `q=${encodeURIComponent(query)}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36',
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });
        const $ = cheerio.load(data);
        const results = [];
        
        $('.result-snippet').each((_, el) => {
             const snippet = $(el).text().trim();
             const linkEl = $(el).closest('tr').prev().find('a.result-url');
             const title = linkEl.text().trim();
             const link = linkEl.attr('href') || '';
             if(link) results.push({ link, title, snippet });
        });
        
        console.log(`DDG Lite found ${results.length} results.`);
        if (results.length > 0) {
            console.log(results[0]);
        }
    } catch (e) {
        console.error("DDG Error:", e.message);
    }
}
testDDGLite();
