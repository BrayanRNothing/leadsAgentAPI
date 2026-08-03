require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth');
const scrapingRoutes = require('./routes/scraping');
const leadsRoutes = require('./routes/leads');
const gmailRoutes = require('./routes/gmail');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/scraping', scrapingRoutes);
const prisma = require('./prisma');

app.get('/api/home-stats', async (req, res) => {
  try {
    const INEGI_SOURCES = ['inegi_saved', 'inegi', 'inegi_autopilot'];
    const [mapsLeads, inegiNew, inegiSent, inegiInterested, inegiRaw] = await Promise.all([
      prisma.mapsLead.count({ where: { status: { not: 'discarded' } } }),
      prisma.lead.count({ where: { fuente: { in: INEGI_SOURCES }, status: { not: 'discarded' }, pipelineState: 'NEW' } }),
      prisma.lead.count({ where: { fuente: { in: INEGI_SOURCES }, status: { not: 'discarded' }, pipelineState: { in: ['CONTACTING', 'SENT'] } } }),
      prisma.lead.count({ where: { fuente: { in: INEGI_SOURCES }, status: { not: 'discarded' }, pipelineState: { in: ['REPLIED', 'INTERESTED', 'MEETING_BOOKED', 'REQUIRES_HUMAN'] } } }),
      prisma.inegiLead.count({ where: { status: 'active' } })
    ]);
    res.json({ 
      mapsLeads, 
      inegiLeads: inegiNew + inegiSent + inegiRaw,  // Total real: procesados + sin procesar
      inegiRaw,   // Leads sin procesar en banco INEGI
      inegiNew, 
      inegiSent, 
      inegiInterested 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ mapsLeads: 0, inegiLeads: 0, inegiNew: 0, inegiSent: 0, inegiInterested: 0, inegiRaw: 0 });
  }
});


app.use('/api/leads', leadsRoutes);
app.use('/api/maps', require('./routes/maps'));
app.use('/api/inegi', require('./routes/inegi'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/n8n', require('./routes/n8n'));
app.use('/api/autopilot', require('./routes/autopilot'));
app.use('/api/gmail', require('./routes/gmail'));

app.get('/api/ai-stats', (req, res) => {
  res.json({
    usedTokens: global.aiTokensUsed || 0,
    maxTokens: 500000 // Límite visual sugerido para plan gratis Groq (diario)
  });
});

app.use('/api/auth', require('./routes/auth'));

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
  
  const autopilotService = require('./services/autopilot');
  autopilotService.resumeIfActive();
});

// Desactivar timeouts del servidor para soportar conexiones SSE largas (scraping puede durar varios minutos)
server.keepAliveTimeout = 0;   // No matar conexiones keep-alive inactivas
server.headersTimeout = 0;     // No matar por timeout de headers
server.timeout = 0;            // Sin timeout global en el servidor
