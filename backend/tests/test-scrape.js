const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

async function fetchPage(url) {
  const { data } = await axios.get(url, {
    timeout: 6000,
    httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'es-MX,es;q=0.9,en-US;q=0.8,en;q=0.7',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0'
    }
  });
  return data;
}

async function scrapeWebsiteDetails(url) {
  console.log("Scraping:", url);
  try {
    if (!url.startsWith('http')) url = 'https://' + url;
    
    // Función interna para parsear HTML
    const parseHtml = (html) => {
      const $ = cheerio.load(html);
      const emails = [];
      const redes = {};
      const phones = [];

      $('a').each((_, el) => {
        const href = $(el).attr('href') || '';
        if (href.startsWith('mailto:')) {
          const email = href.replace('mailto:', '').split('?')[0].trim();
          if (email && email.includes('@')) emails.push(email.toLowerCase());
        }
        if (href.startsWith('tel:')) {
          const phone = href.replace('tel:', '').split('?')[0].trim();
          if (phone && phone.length >= 8) phones.push(phone);
        }
        const lowerHref = href.toLowerCase();
        if (lowerHref.includes('instagram.com/')) redes.instagram = href;
        else if (lowerHref.includes('facebook.com/')) redes.facebook = href;
        else if (lowerHref.includes('twitter.com/') || lowerHref.includes('x.com/')) redes.twitter = href;
        else if (lowerHref.includes('linkedin.com/')) redes.linkedin = href;
      });

      const bodyText = $('body').text();
      if (emails.length === 0) {
        const matches = bodyText.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
        emails.push(...matches.map(e => e.toLowerCase()));
      }
      if (phones.length === 0) {
        const phoneMatches = bodyText.match(/\+?\d[\d\s\-()]{7,15}\d/g) || [];
        phones.push(...phoneMatches.map(p => p.trim()).filter(p => p.replace(/\D/g, '').length >= 8 && p.replace(/\D/g, '').length <= 15));
      }
      return { emails, phones, redes };
    };

    let data;
    try {
      data = await fetchPage(url);
    } catch (e) {
      console.log(`  ⚠ Fallo en homepage ${url}: ${e.message}`);
      return { correo: null, redesSociales: null };
    }

    let { emails, phones, redes } = parseHtml(data);

    // Si no hay correo, intentar buscar en subpáginas de contacto
    if (emails.length === 0) {
      const contactPaths = ['/contacto', '/contact', '/contact-us', '/es/contacto'];
      const baseUrl = new URL(url).origin;
      
      for (const path of contactPaths) {
        try {
          console.log(`  Intentando ${baseUrl}${path}...`);
          const contactData = await fetchPage(`${baseUrl}${path}`);
          const contactParsed = parseHtml(contactData);
          emails.push(...contactParsed.emails);
          if (phones.length === 0) phones.push(...contactParsed.phones);
          if (emails.length > 0) {
             console.log(`  ¡Correo encontrado en ${path}!`);
             break; // Si ya encontró, no seguir buscando
          }
        } catch (e) {
          // Ignorar si la página no existe
        }
      }
    }

    const uniqueEmails = [...new Set(emails)];
    const uniquePhones = [...new Set(phones)];
    return {
      correo: uniqueEmails.length > 0 ? uniqueEmails[0] : null,
      telefono: uniquePhones.length > 0 ? uniquePhones[0] : null,
      redesSociales: Object.keys(redes).length > 0 ? redes : null
    };
  } catch (err) {
    console.log(`  ⚠ Error general en ${url}: ${err.message}`);
    return { correo: null, redesSociales: null };
  }
}

async function test() {
  const result = await scrapeWebsiteDetails('https://hotelxcaret.com');
  console.log(result);
}

test();
