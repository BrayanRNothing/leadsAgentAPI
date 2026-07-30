const { google } = require('googleapis');
const prisma = require('../prisma');

const getOAuthClient = () => {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
};

async function getAuthenticatedClient() {
  const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.gmailRefreshToken) {
    throw new Error('Gmail no está conectado. Por favor, conéctalo en la configuración.');
  }

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: config.gmailAccessToken,
    refresh_token: config.gmailRefreshToken
  });

  // Escuchar si se refrescan los tokens para guardarlos en la BD
  oauth2Client.on('tokens', async (tokens) => {
    const updateData = {};
    if (tokens.access_token) updateData.gmailAccessToken = tokens.access_token;
    if (tokens.refresh_token) updateData.gmailRefreshToken = tokens.refresh_token;

    if (Object.keys(updateData).length > 0) {
      await prisma.autoPilotConfig.update({
        where: { id: 1 },
        data: updateData
      });
      console.log('[Gmail Service] Tokens de OAuth refrescados y guardados.');
    }
  });

  return oauth2Client;
}

async function sendGmailEmail({ to, subject, body }) {
  const auth = await getAuthenticatedClient();
  const gmail = google.gmail({ version: 'v1', auth });

  // Codificar el asunto en base64 para soportar acentos y caracteres especiales
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  
  // Estructurar el mensaje en formato RFC 2822
  const messageParts = [
    `To: ${to}`,
    'Content-Type: text/html; charset=utf-8',
    'MIME-Version: 1.0',
    `Subject: ${utf8Subject}`,
    '',
    body
  ];
  const message = messageParts.join('\n');

  // Codificar en Base64 seguro para URL
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage
    }
  });

  return res.data;
}

module.exports = { sendGmailEmail, getAuthenticatedClient };
