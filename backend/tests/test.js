const axios = require('axios');
const cheerio = require('cheerio');
axios.get('http://www.laspalmassanfelipe.com/', { timeout: 8000 })
  .then(res => {
    const $ = cheerio.load(res.data);
    const bodyText = $('body').text() || '';
    const s2 = Date.now();
    const phoneMatches = bodyText.match(/\+?\d[\d\s\-()]{7,15}\d/g) || [];
    console.log('Regex took', Date.now() - s2, 'ms', 'Matches:', phoneMatches.length);
  }).catch(e => console.log(e.stack));
