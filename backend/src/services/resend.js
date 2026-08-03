const { Resend } = require('resend');

// Asegúrate de que el API Key exista
const resend = new Resend(process.env.RESEND_API_KEY || 're_key');

async function sendResendEmail({ to, subject, body, fromEmail = 'brayan@updm-mx.com' }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY no está configurada en las variables de entorno.');
  }

  const { data, error } = await resend.emails.send({
    from: `Infiniguard <${fromEmail}>`,
    to: [to],
    subject: subject,
    html: body,
  });

  if (error) {
    throw new Error(`Error de Resend: ${error.message}`);
  }

  return data;
}

module.exports = { sendResendEmail };
