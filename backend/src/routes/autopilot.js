const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
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
    const { batchSize, delaySeconds, templateSubject, templateHtml } = req.body;
    const updated = await prisma.autoPilotConfig.upsert({
      where: { id: 1 },
      update: {
        batchSize: parseInt(batchSize) || 50,
        delaySeconds: parseInt(delaySeconds) || 30,
        templateSubject,
        templateHtml
      },
      create: {
        id: 1,
        batchSize: parseInt(batchSize) || 50,
        delaySeconds: parseInt(delaySeconds) || 30,
        templateSubject,
        templateHtml
      }
    });
    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error updating config' });
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

module.exports = router;
