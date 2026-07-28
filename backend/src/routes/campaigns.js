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

    // 3. Actualizar los leads a estado CONTACTING para que n8n los tome
    await prisma.lead.updateMany({
      where: { id: { in: leads.map(l => l.id) } },
      data: { pipelineState: 'CONTACTING' }
    });

    // 4. Devolver la respuesta (n8n se encargará del envío)
    res.json({ message: 'Campaña iniciada, n8n enviará los correos', campana });
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
