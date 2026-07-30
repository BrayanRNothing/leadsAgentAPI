const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const autopilotService = require('../services/autopilot');

// GET /api/autopilot/config - Get current bot config
router.get('/config', async (req, res) => {
  try {
    let config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    if (!config) {
      config = await prisma.autoPilotConfig.create({
        data: { id: 1 }
      });
    }
    res.json(config);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching config' });
  }
});

// PUT /api/autopilot/config - Update bot config
router.put('/config', async (req, res) => {
  try {
    const {
      globalActive, phase1Active, phase2Active, phase3Active,
      batchSize, delaySeconds, dailyLimit, batchCooldownHours,
      templateSubject, templateHtml,
      companyName, companyContext, availability, notifyEmail
    } = req.body;

    const data = {
      globalActive: !!globalActive,
      phase1Active: !!phase1Active,
      phase2Active: !!phase2Active,
      phase3Active: !!phase3Active,
      batchSize: parseInt(batchSize) || 50,
      delaySeconds: parseInt(delaySeconds) || 30,
      dailyLimit: parseInt(dailyLimit) || 200,
      batchCooldownHours: parseFloat(batchCooldownHours) || 4,
      templateSubject: templateSubject || '',
      templateHtml: templateHtml || '',
      companyName: companyName || 'Infiniguard',
      companyContext: companyContext || '',
      availability: availability || '',
      notifyEmail: notifyEmail || null
    };

    const updated = await prisma.autoPilotConfig.upsert({
      where: { id: 1 },
      update: data,
      create: { id: 1, ...data }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating config' });
  }
});

// GET /api/autopilot/status - Live stats
router.get('/status', async (req, res) => {
  try {
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    const [inProcess, sent, replied, interested, classified] = await Promise.all([
      prisma.lead.count({ where: { pipelineState: 'NEW' } }),
      prisma.lead.count({ where: { pipelineState: 'SENT' } }),
      prisma.lead.count({ where: { pipelineState: 'REPLIED' } }),
      prisma.lead.count({ where: { pipelineState: 'INTERESTED' } }),
      prisma.lead.count({ where: { pipelineState: { in: ['INTERESTED','NOT_INTERESTED','MEETING_BOOKED','FOLLOW_UP','REQUIRES_HUMAN','INVALID'] } } }),
    ]);
    res.json({
      isRunning: autopilotService.getIsRunning(),
      globalActive: config?.globalActive || false,
      phase1Active: config?.phase1Active || false,
      phase2Active: config?.phase2Active || false,
      phase3Active: config?.phase3Active || false,
      sentTodayCount: config?.sentTodayCount || 0,
      dailyLimit: config?.dailyLimit || 200,
      counts: { inProcess, sent, replied, interested, classified }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error fetching status' });
  }
});

// POST /api/autopilot/start - Start the bot
router.post('/start', async (req, res) => {
  try {
    autopilotService.startAutoPilot();
    res.json({ message: 'Auto-Pilot iniciado' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error starting autopilot' });
  }
});

// POST /api/autopilot/stop - Stop the bot
router.post('/stop', async (req, res) => {
  try {
    autopilotService.stopAutoPilot();
    res.json({ message: 'Auto-Pilot detenido' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error stopping autopilot' });
  }
});
// POST /api/autopilot/clear-queue - Mark all pending as SENT
router.post('/clear-queue', async (req, res) => {
  try {
    const result = await prisma.lead.updateMany({
      where: { pipelineState: 'NEW', correo: { not: null } },
      data: { pipelineState: 'SENT' }
    });
    res.json({ message: `Se marcaron ${result.count} leads como enviados para limpiar la cola.` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error clearing queue' });
  }
});

module.exports = router;
