const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 1. Endpoint para que n8n extraiga leads listos para enviar (Outbound)
router.get('/leads-outbound', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    
    const leadsDb = await prisma.lead.findMany({
      where: {
        pipelineState: 'CONTACTING',
        correo: { not: null }
      },
      include: {
        mensajes: {
          where: { estado: 'pending' },
          include: { campana: true },
          orderBy: { id: 'asc' },
          take: 1
        }
      },
      take: limit
    });

    const leads = leadsDb.map(l => {
      const msg = l.mensajes[0];
      let subject = 'Propuesta de Valor';
      let body = `Hola ${l.nombre || 'Amigo'},\n\nNos gustaría conectar contigo.`;
      
      if (msg && msg.campana) {
        subject = msg.campana.asunto;
        body = msg.campana.cuerpo.replace(/{{nombre}}/g, l.nombre || 'Amigo');
      }

      return {
        id: l.id,
        nombre: l.nombre,
        correo: l.correo,
        n8n_subject: subject,
        n8n_body: body,
        mensajeId: msg ? msg.id : null
      };
    });

    res.json({ success: true, count: leads.length, leads });
  } catch (error) {
    console.error('Error fetching leads for n8n:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// Endpoint para que n8n marque como enviados los correos
router.post('/mark-sent', async (req, res) => {
  try {
    const { leadIds, mensajeIds } = req.body; // Array de IDs
    if (!leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({ error: 'Falta leadIds' });
    }

    const parsedLeadIds = leadIds.map(id => parseInt(id)).filter(id => !isNaN(id));

    const leads = await prisma.lead.findMany({ where: { id: { in: parsedLeadIds } } });
    
    for (const lead of leads) {
      let contactoEstado = lead.contactoEstado || { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" };
      if (typeof contactoEstado === 'string') {
        try { contactoEstado = JSON.parse(contactoEstado); } catch(e) { contactoEstado = { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" }; }
      }
      
      // Auto marcar el checkbox de correo enviado
      contactoEstado.correo = true;
      contactoEstado.estado = "Esperando respuesta";

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineState: 'SENT',
          contactoEstado: contactoEstado
        }
      });
    }

    if (mensajeIds && Array.isArray(mensajeIds)) {
      const parsedMsgIds = mensajeIds.map(id => parseInt(id)).filter(id => !isNaN(id));
      if (parsedMsgIds.length > 0) {
        await prisma.leadMensaje.updateMany({
          where: { id: { in: parsedMsgIds } },
          data: { estado: 'sent', enviadoEn: new Date() }
        });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error marking leads as sent:', error);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

const { Groq } = require('groq-sdk');

async function analyzeEmailWithAI(text, leadInfo) {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ Error: GROQ_API_KEY no está configurada. Saltando análisis de IA.');
    return null;
  }
  
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  
  try {
    const prompt = `Eres un asistente de ventas. Tu trabajo es analizar la respuesta de un cliente potencial (Lead) a nuestro correo de prospección en frío.
El nombre del lead es: ${leadInfo.nombre}
Su término de búsqueda (giro) es: ${leadInfo.terminoBusqueda}

El cliente respondió lo siguiente al correo:
"${text}"

Clasifica la intención del cliente en una de estas categorías:
1. "INTERESTED": Muestra interés claro en el producto/servicio.
2. "NOT_INTERESTED": Pide que dejen de molestar o dice que no le interesa.
3. "DOUBT": Hace una pregunta sobre el servicio o precio antes de decidir.
4. "MEETING": Pide agendar una llamada o cita.

Responde ÚNICAMENTE con un objeto JSON válido con la siguiente estructura (sin formato Markdown adicional):
{
  "classification": "una de las 4 categorias",
  "reasoning": "breve justificación de tu decisión",
  "suggested_reply": "Si es INTERESTED o DOUBT, redacta la respuesta ideal para enviársela. Si es NOT_INTERESTED, déjalo vacío."
}`;

    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama3-8b-8192", // Modelo rápido y gratuito de Groq
      temperature: 0.1, // Baja temperatura para respuestas más predecibles
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return result;
  } catch (error) {
    console.error('Error analizando con Groq:', error);
    return null;
  }
}

// 2. Webhook para recibir correos entrantes desde n8n (Inbound)
router.post('/webhooks/email-reply', async (req, res) => {
  try {
    // Datos que n8n debe enviar
    const { from, subject, text, threadId } = req.body;

    console.log('📬 Nuevo correo recibido de:', from);

    // Limpiar el email de formato "Nombre <email@dom.com>"
    let cleanEmail = from || "";
    if (typeof cleanEmail === 'string') {
      const match = cleanEmail.match(/<(.+)>/);
      if (match) cleanEmail = match[1];
      cleanEmail = cleanEmail.trim().toLowerCase();
    }

    // Buscar si ese correo pertenece a un lead
    const lead = await prisma.lead.findFirst({
      where: { 
        correo: {
          equals: cleanEmail,
          mode: 'insensitive'
        }
      }
    });

    if (!lead) {
      console.log('No se encontró lead asociado al correo:', cleanEmail);
      return res.json({ success: false, message: 'Lead no encontrado', searchedEmail: cleanEmail });
    }

    // Análisis de la IA (Groq)
    console.log(`🤖 Analizando respuesta del lead ${lead.nombre} con IA...`);
    const aiAnalysis = await analyzeEmailWithAI(text, lead);
    
    let nextState = 'REPLIED';
    
    if (aiAnalysis) {
      console.log('🧠 Resultado de IA:', aiAnalysis.classification);
      
      switch (aiAnalysis.classification) {
        case 'INTERESTED':
          nextState = 'INTERESTED';
          break;
        case 'NOT_INTERESTED':
          nextState = 'NOT_INTERESTED'; // Lo descartamos
          break;
        case 'DOUBT':
          nextState = 'REPLIED'; // Sigue en espera de atención o respuesta automática
          break;
        case 'MEETING':
          nextState = 'INTERESTED'; // Cita agendada
          break;
      }
    }

    // Obtener estado de contacto actual o inicializarlo
    let contactoActual = {};
    if (lead.contactoEstado) {
      contactoActual = typeof lead.contactoEstado === 'string' ? JSON.parse(lead.contactoEstado) : lead.contactoEstado;
    }

    // Actualizar estado del lead en la BD
    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        pipelineState: nextState,
        contactoEstado: {
          ...contactoActual,
          ultimoMensajeRecibido: text || "(Sin texto)",
          aiAnalysis: aiAnalysis || null
        }
      }
    });

    console.log(`✅ Lead ${lead.nombre} actualizado a estado: ${nextState}.`);

    // TODO: Si la IA sugirió una respuesta y queremos enviarla en automático, 
    // tendríamos que hacer un POST al Webhook de n8n aquí pasando el suggested_reply y threadId.

    res.json({ 
      success: true, 
      message: 'Correo procesado', 
      leadId: lead.id,
      analysis: aiAnalysis 
    });
  } catch (error) {
    console.error('Error en webhook de respuesta:', error);
    res.status(500).json({ success: false, error: 'Error interno', details: error.message, stack: error.stack });
  }
});

module.exports = router;
