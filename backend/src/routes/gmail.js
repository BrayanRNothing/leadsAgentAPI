const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const nodemailer = require('nodemailer');

// POST /api/gmail/connect - Guardar credenciales de correo y contraseña de aplicación
router.post('/connect', async (req, res) => {
  const { email, appPassword } = req.body;
  if (!email || !appPassword) {
    return res.status(400).json({ error: 'El correo y la contraseña de aplicación son obligatorios' });
  }

  // Quitar espacios que a veces la gente copia con la contraseña de aplicación de Google
  const cleanPassword = appPassword.replace(/\s+/g, '');

  try {
    // Probar la conexión antes de guardar en la base de datos
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: email,
        pass: cleanPassword
      }
    });

    await transporter.verify();

    // Guardar en la base de datos usando las columnas existentes
    await prisma.autoPilotConfig.upsert({
      where: { id: 1 },
      update: {
        gmailAccessToken: email,
        gmailRefreshToken: cleanPassword
      },
      create: {
        id: 1,
        gmailAccessToken: email,
        gmailRefreshToken: cleanPassword
      }
    });

    res.json({ success: true, message: 'Gmail conectado exitosamente.' });
  } catch (error) {
    console.error('Error verificando credenciales de Gmail:', error);
    res.status(400).json({
      error: 'No se pudo conectar a Gmail. Verifica tu correo y que tu Contraseña de Aplicación de 16 caracteres sea correcta.'
    });
  }
});

// GET /api/gmail/status - Ver si Gmail está conectado
router.get('/status', async (req, res) => {
  try {
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    const isConnected = Boolean(config?.gmailRefreshToken && config?.gmailAccessToken);
    res.json({ isConnected, email: config?.gmailAccessToken });
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener estado de Gmail' });
  }
});

// POST /api/gmail/disconnect - Desconectar Gmail
router.post('/disconnect', async (req, res) => {
  try {
    await prisma.autoPilotConfig.update({
      where: { id: 1 },
      data: { gmailAccessToken: null, gmailRefreshToken: null }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Error al desconectar Gmail' });
  }
});

module.exports = router;
