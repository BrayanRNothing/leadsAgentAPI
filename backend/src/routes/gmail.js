const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { google } = require('googleapis');

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

router.get('/auth', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Faltan credenciales de Google en el .env' });
  }
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.modify'],
    prompt: 'consent'
  });
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send('No code');
  try {
    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    await prisma.autoPilotConfig.upsert({
      where: { id: 1 },
      update: {
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token || undefined
      },
      create: {
        id: 1,
        gmailAccessToken: tokens.access_token,
        gmailRefreshToken: tokens.refresh_token
      }
    });
    res.send('<html><body><h2>✅ Gmail Conectado Exitosamente</h2><p>Cierra esta ventana.</p><script>setTimeout(() => { window.close(); }, 3000);</script></body></html>');
  } catch (error) {
    console.error('Callback error:', error);
    res.status(500).send('Error');
  }
});

router.get('/status', async (req, res) => {
  try {
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    const isConnected = Boolean(config?.gmailRefreshToken || config?.gmailAccessToken);
    res.json({ isConnected });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

router.post('/disconnect', async (req, res) => {
  try {
    await prisma.autoPilotConfig.update({
      where: { id: 1 },
      data: { gmailAccessToken: null, gmailRefreshToken: null }
    });
    res.json({ success: true });
  } catch (error) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;
