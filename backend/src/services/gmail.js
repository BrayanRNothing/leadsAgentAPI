const nodemailer = require('nodemailer');
const prisma = require('../prisma');

async function sendGmailEmail({ to, subject, body }) {
  const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
  if (!config || !config.gmailAccessToken || !config.gmailRefreshToken) {
    throw new Error('Gmail no está conectado. Por favor, ingresa tus credenciales en el Panel de Automatización.');
  }

  const gmailEmail = config.gmailAccessToken;
  const appPassword = config.gmailRefreshToken;

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: gmailEmail,
      pass: appPassword
    }
  });

  const info = await transporter.sendMail({
    from: `"Infiniguard" <${gmailEmail}>`,
    to: to,
    subject: subject,
    html: body
  });

  return info;
}

module.exports = { sendGmailEmail };
