const fs = require('fs');
const cheerio = require('cheerio');

const html = fs.readFileSync('yahoo-search.html', 'utf-8');
const $ = cheerio.load(html);

const results = [];
console.log("HTML of first .algo-sr:", $('.algo-sr').first().html());
$('.algo-sr').each((_, el) => {
  const link = $(el).find('a').first().attr('href');
  
  if (link) {
    results.push({ link });
  }
  }
});

console.log(`Found ${results.length} results using .algo`);
if (results.length > 0) {
  console.log(results[0]);
}

if (results.length === 0) {
    console.log("Dumping all class names from body:");
    const classes = new Set();
    $('[class]').each((_, el) => {
        const cls = $(el).attr('class');
        if (cls) {
            cls.split(' ').forEach(c => classes.add(c));
        }
    });
    console.log(Array.from(classes).join(', '));
}
