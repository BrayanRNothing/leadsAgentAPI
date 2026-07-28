const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');

const router = express.Router();
const prisma = new PrismaClient();
// API Key deberia estar en el .env, pero para inicializar usaremos process.env.RESEND_API_KEY
const resend = new Resend(process.env.RESEND_API_KEY);

router.post('/send', async (req, res) => {
  const { leads, asunto, cuerpo, nombreCampana } = req.body;
  if (!leads || !leads.length || !asunto || !cuerpo || !nombreCampana) {
    return res.status(400).json({ error: 'Faltan datos para crear la campaña' });
  }

  try {
    // 1. Crear campaña en la BD
    const campana = await prisma.campanaCorreo.create({
      data: {
        nombre: nombreCampana,
        asunto: asunto,
        cuerpo: cuerpo,
        estado: 'sending'
      }
    });

    // 2. Crear los registros de LeadMensaje
    const mensajesData = leads.map(lead => ({
      leadId: lead.id,
      campanaId: campana.id,
      estado: 'pending'
    }));

    await prisma.leadMensaje.createMany({ data: mensajesData });
    const mensajes = await prisma.leadMensaje.findMany({ where: { campanaId: campana.id } });

    // 3. Devolver la respuesta inmediata (la campaña se enviará en background)
    res.json({ message: 'Campaña iniciada', campana });

    // 4. Proceso en background para enviar correos pausadamente
    (async () => {
      for (let i = 0; i < leads.length; i++) {
        const lead = leads[i];
        const mensajeDb = mensajes.find(m => m.leadId === lead.id);

        try {
          // Reemplazar variables simples en el cuerpo
          let cuerpoPersonalizado = cuerpo.replace(/{{nombre}}/g, lead.nombre || 'Amigo');
          
          // Enviar correo con Resend
          const { data, error } = await resend.emails.send({
            from: process.env.RESEND_FROM_EMAIL || 'Brayan de UPDM <brayan@updm.mx>',
            reply_to: 'brayan@updm.mx',
            to: [lead.correo],
            subject: asunto,
            html: cuerpoPersonalizado,
          });

          if (error) {
            console.error('Error enviando a', lead.correo, error);
            await prisma.leadMensaje.update({
              where: { id: mensajeDb.id },
              data: { estado: 'failed', error: error.message }
            });
          } else {
            console.log('Enviado a', lead.correo, 'ID:', data.id);
            await prisma.leadMensaje.update({
              where: { id: mensajeDb.id },
              data: { estado: 'sent', mensajeId: data.id, enviadoEn: new Date() }
            });
          }
        } catch (e) {
          console.error('Exception sending to', lead.correo, e);
          await prisma.leadMensaje.update({
            where: { id: mensajeDb.id },
            data: { estado: 'failed', error: e.message }
          });
        }

        // Esperar 3 segundos entre cada correo para no saturar
        await new Promise(r => setTimeout(r, 3000));
      }

      // Finalizar campaña
      await prisma.campanaCorreo.update({
        where: { id: campana.id },
        data: { estado: 'completed' }
      });
      console.log(`Campaña "${nombreCampana}" finalizada.`);
    })();
  } catch (error) {
    console.error('Error al iniciar campaña', error);
    res.status(500).json({ error: 'Error interno al iniciar campaña' });
  }
});

// Ruta para ver el estado de la campaña
router.get('/:id', async (req, res) => {
  try {
    const campana = await prisma.campanaCorreo.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        mensajes: {
          include: { lead: true }
        }
      }
    });
    res.json(campana);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener campaña' });
  }
});

module.exports = router;
