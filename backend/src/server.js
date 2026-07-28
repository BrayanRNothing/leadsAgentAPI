require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const scrapingRoutes = require('./routes/scraping');
const leadsRoutes = require('./routes/leads');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/scraping', scrapingRoutes);
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

app.get('/api/home-stats', async (req, res) => {
  try {
    const [mapsLeads, inegiLeads] = await Promise.all([
      prisma.lead.count({ where: { fuente: 'maps' } }),
      prisma.lead.count({ where: { fuente: 'inegi_saved' } })
    ]);
    res.json({ mapsLeads, inegiLeads });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mapsLeads: 0, inegiLeads: 0 });
  }
});

app.use('/api/leads', leadsRoutes);
app.use('/api/inegi', require('./routes/inegi'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/n8n', require('./routes/n8n'));

// Ruta de salud para verificar que el servidor responde
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// === CONFIGURACIÓN DE MONOREPO PARA RAILWAY ===
// Servir archivos estáticos del frontend (React/Vite)
const path = require('path');
const frontendDistPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// Cualquier otra ruta que no sea /api/... se la mandamos a React (para que funcione el React Router)
app.get(/(.*)/, (req, res) => {
  if (!req.path.startsWith('/api/')) {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  }
});

const PORT = process.env.PORT || 3001;
const server = app.listen(PORT, () => {
  console.log(`✅ Server corriendo en http://localhost:${PORT}`);
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ cargado' : '✗ NO ENCONTRADO'}`);
});

// Desactivar timeouts del servidor para soportar conexiones SSE largas (scraping puede durar varios minutos)
server.keepAliveTimeout = 0;   // No matar conexiones keep-alive inactivas
server.headersTimeout = 0;     // No matar por timeout de headers
server.timeout = 0;            // Sin timeout global en el servidor
