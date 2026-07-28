require('dotenv').config();
const express = require('express');
const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const https = require('https');
const router = express.Router();

let mexicoGeoJSON = null;
try {
  mexicoGeoJSON = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../frontend/public/mexico.json'), 'utf8'));
} catch (e) {
  console.log("No se pudo cargar mexico.json para filtrado estricto:", e.message);
}

// Calcular bounding box de una lista de estados usando el GeoJSON de México
function getStateBounds(stateNames) {
  if (!mexicoGeoJSON || !stateNames || stateNames.length === 0) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let found = false;
  for (const stateName of stateNames) {
    const feature = mexicoGeoJSON.features.find(f => f.properties.name === stateName);
    if (!feature) continue;
    found = true;
    const coords = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
    for (const poly of coords) {
      for (const ring of poly) {
        for (const [lng, lat] of ring) {
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
          if (lng < minLng) minLng = lng;
          if (lng > maxLng) maxLng = lng;
        }
      }
    }
  }
  if (!found) return null;
  return [[minLat, minLng], [maxLat, maxLng]];
}

// Algoritmo Ray-casting para punto en polígono
function pointInPolygon(point, polygon) {
  let x = point[0], y = point[1]; // [lng, lat]
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i][0], yi = polygon[i][1];
    let xj = polygon[j][0], yj = polygon[j][1];
    let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInFeature(lng, lat, feature) {
  const geom = feature.geometry;
  if (geom.type === 'Polygon') {
    return pointInPolygon([lng, lat], geom.coordinates[0]); // outer ring
  } else if (geom.type === 'MultiPolygon') {
    for (const poly of geom.coordinates) {
      if (pointInPolygon([lng, lat], poly[0])) return true;
    }
  }
  return false;
}


const prisma = new PrismaClient();

async function fetchPage(url) {
  try {
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
  } catch (err) {
    throw err; // Se delega al try-catch superior
  }
}

// Extrae correos y redes sociales desde una URL
async function scrapeWebsiteDetails(url) {
  try {
    if (!url.startsWith('http')) url = 'https://' + url;
    
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
          const contactData = await fetchPage(`${baseUrl}${path}`);
          const contactParsed = parseHtml(contactData);
          emails.push(...contactParsed.emails);
          if (phones.length === 0) phones.push(...contactParsed.phones);
          if (emails.length > 0) break; // Si ya encontró, no seguir buscando
        } catch (e) {
          // Ignorar si la página no existe o falla
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
    console.log(`  ⚠ No se pudo acceder a ${url}: ${err.message}`);
    return { correo: null, redesSociales: null };
  }
}

// --- Funciones para Expansión y Grid Search ---
function expandQuery(termino) {
  const dic = {
    'hotel': ['Hotel', 'Hostal', 'Resort', 'Motel', 'Posada', 'Hotel Boutique'],
    'restaurante': ['Restaurante', 'Cafetería', 'Bar', 'Comedor', 'Taquería', 'Bistro', 'Marisquería', 'Pizzería', 'Fonda', 'Asador'],
    'dentista': ['Dentista', 'Clínica Dental', 'Odontólogo', 'Ortodoncia', 'Endodoncia'],
    'inmobiliaria': ['Inmobiliaria', 'Bienes Raíces', 'Agente Inmobiliario', 'Constructora'],
    'gimnasio': ['Gimnasio', 'Gym', 'Centro Fitness', 'Crossfit', 'Pilates', 'Yoga'],
    'taller': ['Taller Automotriz', 'Mecánico', 'Refaccionaria', 'Servicio Automotriz', 'Hojalatería y Pintura'],
    'mecanico': ['Taller Automotriz', 'Mecánico', 'Refaccionaria', 'Servicio Automotriz'],
    'peluqueria': ['Peluquería', 'Barbería', 'Estética', 'Salón de Belleza', 'Spa'],
    'estetica': ['Estética', 'Salón de Belleza', 'Peluquería', 'Spa', 'Uñas'],
    'medico': ['Clínica', 'Consultorio Médico', 'Doctor', 'Hospital', 'Especialista'],
    'clinica': ['Clínica', 'Consultorio Médico', 'Hospital', 'Centro Médico'],
    'abogado': ['Despacho de Abogados', 'Bufete Jurídico', 'Asesoría Legal', 'Notaría'],
    'farmacia': ['Farmacia', 'Droguería', 'Botica'],
    'panaderia': ['Panadería', 'Pastelería', 'Repostería'],
    'ferreteria': ['Ferretería', 'Tlapalería', 'Materiales de Construcción'],
    'veterinaria': ['Veterinaria', 'Clínica Veterinaria', 'Estética Canina'],
    'ropa': ['Boutique', 'Tienda de Ropa', 'Moda', 'Confecciones'],
    'boutique': ['Boutique', 'Tienda de Ropa', 'Zapatos', 'Moda'],
    'joyeria': ['Joyería', 'Relojería'],
    'supermercado': ['Supermercado', 'Minisuper', 'Abarrotes', 'Tienda de Conveniencia'],
    'optica': ['Óptica', 'Lentes', 'Oftalmólogo'],
    'lavanderia': ['Lavandería', 'Tintorería', 'Planchaduría'],
    'limpieza': ['Servicio de Limpieza', 'Mantenimiento', 'Pulido de pisos'],
    'carpinteria': ['Carpintería', 'Mueblería', 'Ebanistería'],
    'plomero': ['Plomero', 'Fontanero', 'Instalaciones Hidráulicas'],
    'electricista': ['Electricista', 'Instalaciones Eléctricas', 'Material Eléctrico'],
    'escuela': ['Escuela', 'Colegio', 'Instituto', 'Universidad', 'Academia'],
    'colegio': ['Colegio', 'Escuela', 'Instituto', 'Academia'],
    'guarderia': ['Guardería', 'Estancia Infantil', 'Preescolar'],
    'spa': ['Spa', 'Masajes', 'Centro de Relajación', 'Estética'],
    'contabilidad': ['Despacho Contable', 'Contador', 'Asesoría Fiscal', 'Auditoría'],
    'contador': ['Despacho Contable', 'Contador', 'Asesoría Fiscal'],
    'seguros': ['Aseguradora', 'Agente de Seguros', 'Bróker de Seguros'],
    'logistica': ['Logística', 'Transporte', 'Paquetería', 'Fletes'],
    'agencia de viajes': ['Agencia de Viajes', 'Tour Operador', 'Turismo']
  };
  
  const normalized = termino.toLowerCase().trim();
  for (const [key, variants] of Object.entries(dic)) {
    if (normalized.includes(key)) {
      return variants;
    }
  }
  return [termino]; // Fallback if no match
}

function generateGrid(boundsStr, divisiones = 2) {
  if (!boundsStr) return null;
  try {
    const bounds = JSON.parse(boundsStr); // [[south, west], [north, east]]
    const south = bounds[0][0];
    const west = bounds[0][1];
    const north = bounds[1][0];
    const east = bounds[1][1];
    
    const grid = [];
    const latStep = (north - south) / divisiones;
    const lngStep = (east - west) / divisiones;
    
    for (let i = 0; i < divisiones; i++) {
      for (let j = 0; j < divisiones; j++) {
        const lat = south + (latStep * i) + (latStep / 2);
        const lng = west + (lngStep * j) + (lngStep / 2);
        grid.push({ lat, lng });
      }
    }
    return grid;
  } catch (e) {
    console.error("Error parseando bounds:", e.message);
    return null;
  }
}

// Scraper principal con Google Maps y Puppeteer - UNA SOLA sesión para todo el grid
async function scrapeGoogleMaps(terms, ubicacion, gridPoints, totalLimit = 20, onLeadFound = null, onLog = null, isStopped = () => false, boundsFilter = null, savedCountRef = null, globalVisitedLinks = new Set(), statesToFilter = []) {
  const log = (msg) => { console.log(msg); if (onLog) onLog(msg); };
  log(`[Maps] Iniciando navegador (sesión única) para ${terms.length} término(s) × ${gridPoints.length} cuadrante(s). Meta: ${totalLimit} leads.`);

  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--disable-software-rasterizer'
    ]
  });

  // Calcular zoom apropiado según el tamaño del bounding box (una sola vez)
  let zoom = 12;
  if (boundsFilter) {
    const latSpan = Math.abs(boundsFilter[1][0] - boundsFilter[0][0]);
    const lngSpan = Math.abs(boundsFilter[1][1] - boundsFilter[0][1]);
    const span = Math.max(latSpan, lngSpan);
    if (span < 0.1) zoom = 15;
    else if (span < 0.5) zoom = 13;
    else if (span < 1.5) zoom = 11;
    else if (span < 4) zoom = 10;
    else zoom = 9;
  }

  const allLinks = new Set(); // Conjunto único de URLs para evitar duplicados de links
  const results = [];

  try {
    const page = await browser.newPage();
    await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' });

    // === FASE 1: Recolectar links de todas las búsquedas (term × grid point) ===
    let enoughLinks = false;
    for (const term of terms) {
      if (isStopped() || enoughLinks) break;
      for (const point of gridPoints) {
        if (isStopped() || enoughLinks) break;

        let searchUrl;
        if (point.lat && point.lng) {
          searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(term)}/@${point.lat},${point.lng},${zoom}z/data=!3m1!4b1`;
        } else {
          searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${term} en ${ubicacion}`)}`;
        }

        log(`[Maps] 🔍 Buscando "${term}" en cuadrante (${point.lat?.toFixed(3) ?? ubicacion})...`);
        try {
          await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 45000 });

          // Detectar CAPTCHA
          const pageText = await page.evaluate(() => document.body?.innerText?.substring(0, 500) || '');
          const isBanned = pageText.toLowerCase().includes('unusual traffic') ||
            pageText.toLowerCase().includes('recaptcha') ||
            page.url().includes('sorry/index');
          if (isBanned) {
            const banMsg = '🚫 [Maps] IP bloqueada / CAPTCHA detectado.';
            log(banMsg);
            throw Object.assign(new Error(banMsg), { type: 'ban' });
          }

          await new Promise(r => setTimeout(r, 3000));

          // Scroll para cargar más resultados
          const scrollableSelector = 'div[role="feed"]';
          try {
            await page.waitForSelector(scrollableSelector, { timeout: 8000 });
            for (let i = 0; i < 10; i++) { // Max 10 scrolls per grid point
              await page.evaluate((sel) => {
                const c = document.querySelector(sel);
                if (c) c.scrollTop = c.scrollHeight;
              }, scrollableSelector);
              await new Promise(r => setTimeout(r, 1500));
              
              // Evaluar links on-the-fly para detener la recolección si ya tenemos suficientes
              const currentLinks = await page.evaluate(() =>
                Array.from(document.querySelectorAll('a[class*="hfpxzc"]')).map(a => a.href)
              );
              currentLinks.forEach(l => allLinks.add(l));
              
              let validLinksCount = allLinks.size;
              if (boundsFilter) {
                const [sw, ne] = boundsFilter;
                validLinksCount = Array.from(allLinks).filter(link => {
                  let lat = null, lng = null;
                  const pinMatch = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                                   link.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
                  if (pinMatch) { lat = parseFloat(pinMatch[1]); lng = parseFloat(pinMatch[2]); }
                  else {
                    const urlMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
                    if (urlMatch) { lat = parseFloat(urlMatch[1]); lng = parseFloat(urlMatch[2]); }
                  }
                  if (!lat || !lng) return false;
                  return lat >= sw[0] && lat <= ne[0] && lng >= sw[1] && lng <= ne[1];
                }).length;
              }
              
              if (validLinksCount >= totalLimit * 1.5 + 15) { // Margen moderado para pipeline
                 enoughLinks = true;
                 log(`[Maps] 🎯 Suficientes links potenciales encontrados (${validLinksCount} válidos). Deteniendo recolección de links para evitar gastar tiempo de más.`);
                 break; // rompe el scroll
              }
            }
          } catch (_) {}

          if (!enoughLinks) {
             const links = await page.evaluate(() =>
               Array.from(document.querySelectorAll('a[class*="hfpxzc"]')).map(a => a.href)
             );
             links.forEach(l => allLinks.add(l));
             log(`[Maps] 📍 Cuadrante aportó resultados. Total acumulado bruto: ${allLinks.size}`);
          }
        } catch (e) {
          if (e.type === 'ban') throw e; // Propagar ban
          log(`[Maps] ⚠ Error en cuadrante: ${e.message}`);
        }
      }
    }

    log(`[Maps] 📊 Total links brutos recolectados: ${allLinks.size}`);
    if (allLinks.size === 0) {
      log('⚠ No se encontraron resultados (cero links) en el área seleccionada.');
      return [];
    }

    // === FASE 2: Extraer datos de los links recolectados (shuffle + limit) ===
    let linkArray = Array.from(allLinks);

    // Pre-filtrar por área ANTES de abrir cada página (ahorra muchísimo tiempo)
    if (boundsFilter || statesToFilter.length > 0) {
      const sw = boundsFilter ? boundsFilter[0] : null;
      const ne = boundsFilter ? boundsFilter[1] : null;
      
      linkArray = linkArray.filter(link => {
        const baseLink = link.split('?')[0];
        if (globalVisitedLinks.has(baseLink)) return false;

        let lat = null, lng = null;
        const pinMatch = link.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                         link.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
        if (pinMatch) { lat = parseFloat(pinMatch[1]); lng = parseFloat(pinMatch[2]); }
        else {
          const urlMatch = link.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (urlMatch) { lat = parseFloat(urlMatch[1]); lng = parseFloat(urlMatch[2]); }
        }
        
        if (!lat || !lng) return false;
        
        // Filtro estricto por bounding box
        if (sw && ne) {
          if (lat < sw[0] || lat > ne[0] || lng < sw[1] || lng > ne[1]) return false;
        }

        // Filtro estricto exacto por Polígono del Estado
        if (statesToFilter.length > 0 && mexicoGeoJSON) {
          let insideState = false;
          for (const stateName of statesToFilter) {
            const feature = mexicoGeoJSON.features.find(f => f.properties.name === stateName);
            if (feature && pointInFeature(lng, lat, feature)) {
              insideState = true;
              break;
            }
          }
          if (!insideState) {
            return false;
          }
        }

        return true;
      });
      log(`[Maps] 📍 Links válidos dentro del polígono estricto: ${linkArray.length}`);
    } else {
      // Si no hay filtro geográfico, de todos modos filtramos los ya visitados
      linkArray = linkArray.filter(link => !globalVisitedLinks.has(link.split('?')[0]));
    }

    if (linkArray.length === 0) {
      log('⚠ Ningún resultado sobrevivió al filtro estricto de área.');
      return [];
    }

    linkArray = linkArray.sort(() => Math.random() - 0.5).slice(0, Math.floor(totalLimit * 1.5 + 15)); // tomar 6x para compensar filtros geográficos, calidad y deduplicación en BD
    linkArray.forEach(l => globalVisitedLinks.add(l.split('?')[0])); // Marcar como visitados para siguientes iteraciones de reintento
    log(`[Maps] 🎯 Extrayendo datos de ${linkArray.length} candidatos (meta: ${totalLimit} leads guardados)...`);

    for (const link of linkArray) {
      // Verificar tanto el stop externo como el contador de leads realmente guardados en BD
      const savedSoFar = savedCountRef ? savedCountRef.count : results.length;
      if (isStopped() || savedSoFar >= totalLimit) break;

      try {
        const delay = Math.floor(Math.random() * 2000) + 2500;
        log(`[Maps] ❄️ Cooldown: ${Math.round(delay/1000)}s...`);
        await new Promise(r => setTimeout(r, delay));

        await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await new Promise(r => setTimeout(r, 1500));

        const details = await page.evaluate(() => {
          const nombre = document.querySelector('h1')?.innerText || '';
          let sitioWeb = null, telefono = null, direccion = null;
          let rating = null, categoria = null, reviews = null;
          let lat = null, lng = null;

          // Coordenadas
          const pinMatch = window.location.href.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) ||
                           window.location.href.match(/!8m2!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
          if (pinMatch) { lat = parseFloat(pinMatch[1]); lng = parseFloat(pinMatch[2]); }
          else {
            const urlMatch = window.location.href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
            if (urlMatch) { lat = parseFloat(urlMatch[1]); lng = parseFloat(urlMatch[2]); }
          }

          // Dirección
          const addrBtn = document.querySelector('button[data-item-id="address"]');
          if (addrBtn) direccion = addrBtn.innerText.trim().replace('\\n', '');

          // Teléfono
          const phoneBtn = document.querySelector('button[data-tooltip*="Copiar el número de teléfono"], button[data-tooltip*="Copy phone number"], button[data-item-id*="phone"]');
          if (phoneBtn) telefono = phoneBtn.innerText.trim().replace('\\n', '');
          if (!telefono) {
            const allBtns = Array.from(document.querySelectorAll('button[data-tooltip]'));
            const phoneByTel = allBtns.find(b => b.getAttribute('data-tooltip')?.toLowerCase().includes('phone') || b.getAttribute('data-tooltip')?.toLowerCase().includes('teléfono'));
            if (phoneByTel) telefono = phoneByTel.innerText.trim().replace('\\n', '');
          }

          // Web
          const webBtn = document.querySelector('a[data-item-id="authority"]');
          if (webBtn) sitioWeb = webBtn.href;

          // Rating
          const ratingEl = document.querySelector('div.F7nice > span > span');
          if (ratingEl) rating = parseFloat(ratingEl.innerText.replace(',', '.'));
          const reviewsEl = document.querySelector('div.F7nice span[aria-label*="opiniones"]');
          if (reviewsEl) reviews = parseInt(reviewsEl.innerText.replace(/\D/g, ''));

          // Categoría
          const catBtn = document.querySelector('button[jsaction*="pane.rating.category"]');
          categoria = catBtn ? catBtn.innerText.trim() : 'Negocio Local';

          return { nombre, direccion, telefono, sitioWeb, rating, reviews, categoria, lat, lng, fuente: 'Google Maps' };
        });

        if (!details.nombre) {
          log(`[Maps] ⚠ Lead sin nombre, omitiendo.`);
          continue;
        }

        // Filtro geográfico estricto
        if (boundsFilter) {
          if (!details.lat || !details.lng) {
            log(`[Maps] 📍 "${details.nombre}" descartado: sin coordenadas para validar área.`);
            continue;
          }
          const [sw, ne] = boundsFilter;
          const inBounds = details.lat >= sw[0] && details.lat <= ne[0] &&
                           details.lng >= sw[1] && details.lng <= ne[1];
          if (!inBounds) {
            log(`[Maps] 📍 "${details.nombre}" fuera del área (${details.lat?.toFixed(3)},${details.lng?.toFixed(3)}), descartado.`);
            continue;
          }
        }

        // Filtro de calidad mínima
        if (!details.telefono && !details.sitioWeb && !details.direccion) {
          log(`[Maps] 🗑 "${details.nombre}" descartado: sin datos de contacto.`);
          continue;
        }

        if (onLeadFound) {
          // Lanza el lead al pipeline de forma concurrente, sin bloquear Maps
          onLeadFound(details).catch(e => console.error("Error en pipeline concurrente:", e));
        }
        results.push(details);
        log(`[Maps] ✅ Lead extraído: ${details.nombre}`);

      } catch (e) {
        if (e.message.includes('bloqueada') || e.message.includes('CAPTCHA')) {
          log(`[Maps] 🚫 Bloqueo detectado: ${e.message}`);
          if (onLog) onLog({ type: 'ban', msg: `Google Maps bloqueó la sesión: ${e.message}` });
          break;
        }
        log(`[Maps] ⚠ Error extrayendo negocio: ${e.message}`);
      }
    }

    return results;
  } finally {
    await browser.close();
    log(`[Maps] 🏁 Navegador cerrado. Total leads válidos: ${results.length}`);
  }
}

// Scraper usando Puppeteer en Google Search (Leads Ocultos Sociales) - ¡Sin API Key!
async function scrapeSocialViaPuppeteer(termino, ubicacion, platforms = ['facebook', 'instagram'], limit = 20, onLog = null, isStopped = () => false) {
  const log = (msg) => { console.log(msg); if (onLog) onLog(msg); };
  log(`[Social] Iniciando búsqueda Social via Puppeteer: ${termino} en ${ubicacion} para: ${platforms.join(', ')}`);
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--window-size=1280,800',
      '--disable-software-rasterizer'
    ]
  });
  
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' });
  const siteQueries = platforms.map(p => {
    if (p === 'linkedin') return 'site:linkedin.com/company/ OR site:linkedin.com/in/';
    return `site:${p}.com`;
  }).join(' OR ');

  const query = `"${termino}" "${ubicacion}" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com" OR "@empresa.com") ${siteQueries}`;
  
  const leads = [];
  const names = new Set();
  
  try {
    for (let start = 0; start <= 10; start += 10) {
      if (isStopped()) {
        log('[Social] 🛑 Scraper Social detenido por el usuario.');
        break;
      }
      
      const searchUrl = `https://search.yahoo.com/search?p=${encodeURIComponent(query)}&b=${start + 1}`;
      await page.goto(searchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // Check for agree cookies button
      try {
        const agreeBtn = await page.$('button.agree');
        if (agreeBtn) {
          await agreeBtn.click();
          await new Promise(r => setTimeout(r, 2000));
        }
      } catch (e) {}
      
      // Delay antiban para parecer humano leyendo los resultados
      const delay = Math.floor(2000 + Math.random() * 2000);
      log(`[Social] ❄️ Cooldown de búsqueda: Pausa de ${Math.round(delay/1000)}s...`);
      await new Promise(r => setTimeout(r, delay));
      
      const results = await page.evaluate(() => {
        const items = [];
        document.querySelectorAll('.algo-sr').forEach(el => {
          const a = el.querySelector('a');
          if (!a) return;
          const link = a.href || '';
          const title = a.innerText || '';
          const snipEl = el.querySelector('.compText');
          const snippet = snipEl ? snipEl.innerText : '';
          items.push({ link, title, snippet });
        });
        return items;
      });
      
      // Detectar CAPTCHA/bloqueo de Yahoo
      const yahooBlocked = await page.evaluate(() => {
        const body = document.body?.innerText?.toLowerCase() || '';
        return body.includes('bots use duckduckgo') ||
          body.includes('please complete the following challenge') ||
          body.includes('captcha') ||
          body.includes('unusual traffic') ||
          body.includes('verify you are human');
      });
      if (yahooBlocked) {
        log('[Social] 🚫 Yahoo detectó actividad de bot. Búsqueda social bloqueada.');
        if (onLog) onLog({ type: 'ban', msg: 'Yahoo Search bloqueó la búsqueda social (CAPTCHA). Intenta de nuevo más tarde.' });
        break;
      }
      
      if (results.length === 0) {
        log('[Social] ⚠ Sin resultados en esta página, terminando búsqueda social.');
        break;
      }

      for (const item of results) {
        const isSocial = item.link.includes('instagram.com') || item.link.includes('facebook.com') || item.link.includes('linkedin.com');
        if (!isSocial) continue;
        
        const snippet = item.snippet || '';
        const emailsMatch = snippet.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g) || [];
        const correo = emailsMatch.length > 0 ? emailsMatch[0].toLowerCase() : null;
        
        const phoneMatch = snippet.match(/\+?\d[\d\s-]{7,15}/);
        let telefono = phoneMatch ? phoneMatch[0].trim() : null;
        if (telefono && telefono.length < 8) telefono = null;
        
        let categoria = 'Social';
        if (item.link.includes('instagram.com')) categoria = 'Instagram';
        else if (item.link.includes('facebook.com')) categoria = 'Facebook';
        else if (item.link.includes('linkedin.com')) categoria = 'LinkedIn';
        let nombre = item.title.split('-')[0].split('|')[0].trim();
        // Limpiar nombre de texto basura de Yahoo (ej: "Instagram
https://...")
        nombre = nombre.split('\\n')[0].trim();
        
        // Guardar el lead aunque no tenga correo ni teléfono, el perfil social ya es valioso
        if (nombre && !names.has(nombre)) {
          names.add(nombre);
          leads.push({
            nombre,
            categoria,
            rating: null,
            reviews: null,
            direccion: ubicacion,
            telefono,
            sitioWeb: item.link,
            correo: correo,
            redesSociales: { [categoria.toLowerCase()]: item.link },
            fuente: categoria
          });
          log(`[Social] ¡Lead encontrado! ${nombre} (${categoria})${correo ? ' ✉' : ''}${telefono ? ' 📞' : ''}`);
          if (leads.length >= limit) break;
        }
      }
      if (leads.length >= limit) break;
    }
  } catch (error) {
    log(`[Social] Error en Puppeteer Social Search: ${error.message}`);
  } finally {
    await browser.close();
  }
  
  return leads.slice(0, limit);
}

router.post('/search', async (req, res) => {
  const { termino, ubicacion, tipoBusqueda } = req.body;

  if (!termino || !ubicacion) {
    return res.status(400).json({ error: 'Término y ubicación son requeridos' });
  }

  try {
    let negocios = [];
    try {
      if (tipoBusqueda === 'social') {
        negocios = await scrapeSocialViaPuppeteer(termino, ubicacion);
      } else if (tipoBusqueda === 'maps-oculto') {
        negocios = await scrapeGoogleMaps(termino, ubicacion, null, null, 20);
      } else {
        negocios = await scrapeGoogleMaps(termino, ubicacion, null, null, 20);
      }
      
      if (negocios.length === 0) {
        return res.status(404).json({ error: 'No se encontraron leads con esos parámetros en esta fuente.' });
      }
    } catch (apiErr) {
      console.error('Error usando Puppeteer:', apiErr);
      return res.status(500).json({ error: apiErr.message || 'Error desconocido al usar el bot de extracción.' });
    }

    const leadsGuardados = [];

    // 2. Procesar cada negocio y enriquecerlo buscando web (solo si vino de Maps, los de social ya tienen sus datos)
    for (const n of negocios) {
      let correo = n.correo || null;
      let redesSociales = n.redesSociales || null;

      if (tipoBusqueda !== 'social' && n.sitioWeb) {
        console.log(`  → Buscando correo y redes en: ${n.sitioWeb}`);
        const extra = await scrapeWebsiteDetails(n.sitioWeb);
        if (extra.correo) correo = extra.correo;
        if (extra.redesSociales) redesSociales = extra.redesSociales;
      }

      try {
        const existe = await prisma.lead.findFirst({
          where: { nombre: n.nombre }
        });

        if (existe) {
          console.log(`  → Repetido ignorado: ${n.nombre}`);
          continue;
        }

        const lead = await prisma.lead.create({
          data: { 
            nombre: n.nombre, 
            telefono: n.telefono, 
            sitioWeb: n.sitioWeb, 
            correo: correo, 
            direccion: n.direccion,
            categoria: n.categoria,
            calificacion: n.rating,
            reviews: n.reviews,
            terminoBusqueda: termino,
            redesSociales: redesSociales ? JSON.stringify(redesSociales) : null,
            fuente: n.fuente
          }
        });
        leadsGuardados.push({ ...lead, fuente: n.fuente });
      } catch (e) {
        console.error('Error guardando lead:', e.message);
      }
    }

    console.log(`✅ Búsqueda completada: ${leadsGuardados.length} leads guardados.`);
    res.json({ leads: leadsGuardados, totalEncontrados: negocios.length });

  } catch (error) {
    console.error("Error general en el scraping:", error);
    res.status(500).json({ error: 'Hubo un error al realizar la búsqueda' });
  }
});

router.post('/validate-query', (req, res) => {
  const { termino } = req.body;
  if (!termino) return res.status(400).json({ valid: false, message: 'El término es requerido' });

  // Solo limpiamos exceso de espacios para la validación, pero mantenemos el término original intacto.
  let cleanTerm = termino.replace(/\s+/g, ' ').trim();
  
  if (cleanTerm.length < 3) {
    return res.json({ valid: false, message: 'Término muy corto. Intenta usar algo más específico.' });
  }

  // Detectar texto sin sentido (muchas consonantes seguidas o caracteres repetidos)
  const isGibberish = 
    /^[bcdfghjklmnpqrstvwxyz]{5,}$/i.test(cleanTerm) || 
    /(.)\1{4,}/.test(cleanTerm);
    
  if (isGibberish) {
    return res.json({ 
      valid: false, 
      message: 'El término parece no ser válido. Por favor, escribe un tipo de negocio real.' 
    });
  }
  
  const words = cleanTerm.toLowerCase().split(' ');
  const genericWords = ['tienda', 'taller', 'consultorio', 'negocio', 'local', 'venta'];
  
  if (words.length === 1 && genericWords.includes(words[0])) {
    return res.json({ 
      valid: false, 
      message: `"${cleanTerm}" es muy general. Sugerencia: "${cleanTerm} mecánico" o "${cleanTerm} ropa".` 
    });
  }

  const synonyms = expandQuery(cleanTerm);
  
  if (synonyms.length > 1) {
    res.json({
      valid: true,
      original: termino,
      improved: cleanTerm, // Devolvemos el mismo término limpio de espacios extra
      synonyms,
      message: `Búsqueda optimizada. Se usarán ${synonyms.length} variaciones.`
    });
  } else {
    res.json({
      valid: true,
      original: termino,
      improved: cleanTerm,
      synonyms: [],
      message: `Término listo para extraer.`
    });
  }
});

router.get('/search-stream', async (req, res) => {
  const { termino, ubicacion, fuentes, quantity, bounds, states, reqPhone, reqEmail, reqWeb } = req.query;
  const isReqPhone = reqPhone === 'true';
  const isReqEmail = reqEmail === 'true';
  const isReqWeb = reqWeb === 'true';
  const statesToFilter = states ? states.split(',') : [];
  const qty = parseInt(quantity) || 50;
  // Buscamos exactamente la cantidad solicitada para no pasarnos del límite del usuario
  const searchQty = qty;

  if (!termino || !ubicacion) {
    return res.status(400).json({ error: 'Término y ubicación son requeridos' });
  }

  // Configurar headers para SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Desactivar buffering en nginx/proxies
  res.flushHeaders();

  // Desactivar timeouts en el socket TCP de esta conexión específica
  req.setTimeout(0);
  res.setTimeout(0);
  if (res.socket) {
    res.socket.setTimeout(0);
    res.socket.setKeepAlive(true, 1000);
  }

  let isClosed = false;

  // Heartbeat cada 2s para mantener el socket vivo en todos los proxies y navegadores
  const heartbeat = setInterval(() => {
    if (!isClosed) {
      res.write(':\\n\\n');
    }
  }, 2000);

  req.on('close', () => {
    isClosed = true;
    clearInterval(heartbeat);
  });

  const emitEvent = (event, data) => {
    if (!isClosed) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  try {
    console.log(`📡 SSE Connected: ${termino}`); emitEvent('connected', { message: 'Búsqueda iniciada', busquedaId: `${termino}__${ubicacion || ''}` });

    const handleLog = (msgOrAlert) => {
      // Si es un objeto con tipo (alert), emitir evento alert tipificado
      if (msgOrAlert && typeof msgOrAlert === 'object' && msgOrAlert.type) {
        emitEvent('alert', { type: msgOrAlert.type, message: msgOrAlert.msg });
      } else {
        emitEvent('log', { message: msgOrAlert });
      }
    };

    const savedCountRef = { count: 0 };
    let activePipelineTasks = 0;
    let validCount = 0;

    const onLeadScraped = async (n) => {
      if (validCount >= qty) return;
      activePipelineTasks++;

      try {
        let correo = n.correo || null;
        let telefono = n.telefono || null;
        let redesSociales = n.redesSociales || null;

        const normalizeName = (str) => str
          ? str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim()
          : '';

        const nombreNorm = normalizeName(n.nombre);

        const todos = await prisma.lead.findMany({
          where: {
            OR: [
              { nombre: n.nombre },
              ...(n.telefono ? [{ telefono: n.telefono }] : []),
            ]
          },
          select: { id: true, nombre: true, telefono: true, fuente: true }
        });

        const existe = todos.find(l => normalizeName(l.nombre) === nombreNorm) ||
                       (n.telefono ? todos.find(l => l.telefono === n.telefono) : null);

        if (existe) {
          console.log(`[Anti-Dup] Ignorado:`); console.log(`[Anti-Dup] Ignorado:`); handleLog(`[Anti-Dup] Ignorado: ${n.nombre}`);
          return;
        }

        // PIPELINE ENRICHMENT ON-THE-FLY
        if (n.sitioWeb && (!correo || !telefono) && !n.sitioWeb.includes('facebook.com') && !n.sitioWeb.includes('instagram.com')) {
          console.log(`[Enrichment] 🌐 Analizando web en 2º plano:`); console.log(`[Enrichment] 🌐 Analizando web en 2º plano:`); handleLog(`[Enrichment] 🌐 Analizando web en 2º plano: ${n.nombre}`);
          try {
            const extra = await scrapeWebsiteDetails(n.sitioWeb);
            if (extra.correo) correo = extra.correo;
            if (extra.telefono) telefono = extra.telefono;
            if (extra.redesSociales) redesSociales = extra.redesSociales;
          } catch (e) {}
        }

        // FILTROS ESTRICTOS FINALES
        if (isReqPhone && !telefono) {
          console.log(`[Filtro] ❌`); console.log(`[Filtro] ❌`); handleLog(`[Filtro] ❌ ${n.nombre}: sin teléfono tras análisis. Descartado.`);
          return;
        }
        if (isReqEmail && !correo) {
          console.log(`[Filtro] ❌`); console.log(`[Filtro] ❌`); handleLog(`[Filtro] ❌ ${n.nombre}: sin correo tras análisis. Descartado.`);
          return;
        }
        if (isReqWeb && !n.sitioWeb) {
          console.log(`[Filtro] ❌`); console.log(`[Filtro] ❌`); handleLog(`[Filtro] ❌ ${n.nombre}: sin sitio web. Descartado.`);
          return;
        }
        if (!isReqPhone && !isReqEmail && !isReqWeb && !telefono && !correo && !n.sitioWeb) {
          console.log(`[Filtro] ❌`); console.log(`[Filtro] ❌`); handleLog(`[Filtro] ❌ ${n.nombre}: sin ningún dato de contacto. Descartado.`);
          return;
        }

        if (validCount >= qty) return;
        validCount++;
        savedCountRef.count = validCount; // Sincroniza para detener Maps

        const lead = await prisma.lead.create({
          data: { 
            nombre: n.nombre, 
            telefono: telefono, 
            sitioWeb: n.sitioWeb || null, 
            correo: correo, 
            direccion: n.direccion || null,
            categoria: n.categoria || null,
            calificacion: n.rating ? parseFloat(String(n.rating).replace(',','.')) : null,
            reviews: n.reviews ? parseInt(n.reviews) : null,
            lat: n.lat || null,
            lng: n.lng || null,
            terminoBusqueda: termino,
            ubicacion: ubicacion || null,
            redesSociales: redesSociales ? JSON.stringify(redesSociales) : null,
            fuente: n.fuente || 'Google Maps'
          }
        });

        console.log(`[BD] ✅`); console.log(`[BD] ✅`); handleLog(`[BD] ✅ Lead #${validCount}/${qty} guardado: ${n.nombre}${telefono ? ' 📞' : ''}${correo ? ' 📧' : ''}`);

        emitEvent('lead', { 
          ...lead, 
          fuente: n.fuente,
          rating: n.rating,
          reviews: n.reviews,
          lat: lead.lat ?? n.lat,
          lng: lead.lng ?? n.lng,
          redesSociales: redesSociales 
        });
      } catch (e) {
        console.error('Error guardando lead en pipeline:', e.message);
      } finally {
        activePipelineTasks--;
      }
    };

    const selectedSources = fuentes ? fuentes.split(',') : ['maps'];
    let sourcesToRun = [];
    if (selectedSources.includes('maps')) sourcesToRun.push('maps');
    const socialPlatforms = [];
    if (selectedSources.includes('facebook')) socialPlatforms.push('facebook');
    if (socialPlatforms.length > 0) sourcesToRun.push('social');

    const termsToSearch = expandQuery(termino).slice(0, 3);
    let boundsObj = null;
    try {
      if (bounds) boundsObj = JSON.parse(bounds);
    } catch (e) {
      handleLog(`[Engine] ⚠ Error parseando bounds: ${e.message}`);
    }

    handleLog(`[Engine] Meta: ${qty} leads finales. Fuentes: ${sourcesToRun.join(', ')}. Modo: Pipeline Concurrente.`);
    handleLog(`[Engine] Términos de búsqueda: ${termsToSearch.join(', ')}.`);
    handleLog(`[Engine] ⚙️ Preparando entorno del motor...`);
    handleLog(`[Engine] 🚀 Levantando bot de Puppeteer (esto puede tomar unos segundos)...`);

    let negociosTotales = 0;

    let effectiveBounds = bounds; 
    let effectiveBoundsObj = boundsObj; 
    if (!bounds && statesToFilter.length > 0) {
      const stateBounds = getStateBounds(statesToFilter);
      if (stateBounds) {
        effectiveBounds = JSON.stringify(stateBounds);
        effectiveBoundsObj = stateBounds;
        handleLog(`[Engine] 🗺️ Bounds calculados automáticamente para: ${statesToFilter.join(', ')}`);
      }
    }

    let gridDensity = 1;
    if (effectiveBoundsObj) {
      const latSpan = Math.abs(effectiveBoundsObj[1][0] - effectiveBoundsObj[0][0]);
      const lngSpan = Math.abs(effectiveBoundsObj[1][1] - effectiveBoundsObj[0][1]);
      const area = latSpan * lngSpan;
      if (area > 20) gridDensity = 5;
      else if (area > 8) gridDensity = 4;
      else if (area > 3) gridDensity = 3;
      else gridDensity = 2;
    }

    const globalVisitedLinks = new Set();
    let globalRetry = 0;
    const MAX_GLOBAL_RETRIES = 6; // Allow up to 6 cycles of Map gathering if rejection is high

    while (validCount < qty && globalRetry < MAX_GLOBAL_RETRIES && !isClosed) {
      const leadsFaltantes = qty - validCount;
      
      if (globalRetry > 0) {
        handleLog(`[Engine] 🔄 Ciclo ${globalRetry + 1}: Faltan ${leadsFaltantes} leads para la meta. Buscando más...`);
      }

      if (sourcesToRun.includes('maps') && !isClosed && validCount < qty) {
        emitEvent('phase', { phase: 'maps' });
        const gridPoints = effectiveBounds ? generateGrid(effectiveBounds, gridDensity) : [{ lat: null, lng: null }];
        
        const resultMaps = await scrapeGoogleMaps(
          termsToSearch,
          ubicacion,
          gridPoints,
          qty,
          onLeadScraped,
          handleLog,
          () => isClosed || validCount >= qty,
          effectiveBoundsObj,
          savedCountRef,
          globalVisitedLinks,
          statesToFilter
        );
        negociosTotales += resultMaps.length;
        if (effectiveBounds) gridDensity++;
      }

      if (sourcesToRun.includes('social') && !isClosed && validCount < qty) {
        const socialLimitPerTerm = Math.max(1, Math.ceil((qty - validCount) / termsToSearch.length));
        for (let i = 0; i < termsToSearch.length; i++) {
          if (isClosed || validCount >= qty) break;
          const term = termsToSearch[i];
          handleLog(`[Social] Buscando leads ocultos para "${term}"...`);
          const resultSocial = await scrapeSocialViaPuppeteer(term, ubicacion, socialPlatforms, socialLimitPerTerm, handleLog, () => isClosed || validCount >= qty);
          for (const n of resultSocial) {
            if (isClosed || validCount >= qty) break;
            onLeadScraped(n).catch(e => console.error(e));
          }
          negociosTotales += resultSocial.length;
        }
      }

      // Wait for the pipeline to empty before deciding to loop again
      if (activePipelineTasks > 0) {
         handleLog(`[Engine] ⏳ Evaluando leads en progreso (${activePipelineTasks} leads procesando)...`);
         while (activePipelineTasks > 0) {
           await new Promise(r => setTimeout(r, 500));
         }
      }

      globalRetry++;
      
      if (validCount >= qty) {
        handleLog(`[Engine] 🎉 Meta alcanzada (${validCount}/${qty}). Terminando proceso.`);
        break;
      }
    }

    emitEvent('done', { totalEncontrados: validCount, totalBrutos: negociosTotales });
    clearInterval(heartbeat);
    res.end();


  } catch (error) {
    console.error("Error general en el scraping stream:", error);
    emitEvent('error', { message: error.message || 'Hubo un error al realizar la búsqueda' });
    clearInterval(heartbeat);
    res.end();
  }
});

module.exports = router;
