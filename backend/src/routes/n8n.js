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
          orderBy: { id: 'desc' }, // <- Cambiado a desc para tomar la campaña más reciente
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

async function analyzeEmailWithAI(text, leadInfo, config) {
  if (!process.env.GROQ_API_KEY) {
    console.error('❌ Error: GROQ_API_KEY no configurada. Saltando análisis.');
    return null;
  }
  
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  // Usa el perfil de empresa guardado en la BD o valores por defecto
  const knowledgeBase = {
    nombre_empresa: config?.companyName || 'Infiniguard',
    descripcion: config?.companyContext || 'Especialistas en recubrimiento anticorrosivo y mantenimiento HVAC.',
    disponibilidad: config?.availability || 'Lunes a Viernes 9am-6pm',
    contacto_ventas: config?.notifyEmail || '',
  };

  const prompt = `Eres un asistente de ventas experto de ${knowledgeBase.nombre_empresa}.
Tu empresa: ${knowledgeBase.descripcion}
Disponibilidad para citas: ${knowledgeBase.disponibilidad}

ATENCIÓN: El correo suele incluir el historial de mensajes anteriores. IGNORA todo después de "El ... escribió:", "On ... wrote:" o "---". Analiza SOLO lo que el cliente acaba de escribir.

Respuesta del cliente:
"${text}"

Clasifica en UNA de estas categorías:
1. "INTERESTED" - Muestra interés claro
2. "NOT_INTERESTED" - Dice que no le interesa
3. "DOUBT" - Hace pregunta sobre el servicio antes de decidir
4. "MEETING" - Pide agendar cita o llamada
5. "REQUIRES_HUMAN" - Pregunta técnica compleja o caso especial que necesita intervención humana
6. "INVALID" - Correo de respuesta automática, rebote, fuera de oficina o SPAM

Responde ÚNICAMENTE con JSON válido (sin markdown):
{
  "classification": "una de las 6 categorias",
  "reasoning": "breve justificacion",
  "suggested_reply": "si es INTERESTED, DOUBT o MEETING, redacta la respuesta ideal usando info de la empresa. Si es NOT_INTERESTED, INVALID o REQUIRES_HUMAN, dejar vacio."
}`;

  try {
    const completion = await groq.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'llama-3.1-8b-instant',
      temperature: 0.1,
      response_format: { type: 'json_object' }
    });

    if (!global.aiTokensUsed) global.aiTokensUsed = 0;
    if (completion.usage?.total_tokens) {
      global.aiTokensUsed += completion.usage.total_tokens;
    }

    return JSON.parse(completion.choices[0].message.content);
  } catch (error) {
    // Detectar si el error es por tokens agotados (rate limit de Groq)
    const isRateLimit = error?.status === 429 || error?.message?.includes('rate_limit') || error?.message?.includes('quota');
    if (isRateLimit) {
      console.warn('⏸️ Tokens de Groq agotados. La IA pausará hasta que se rellenen. El lead quedará como REPLIED.');
      // Marcar en un global para que el sistema lo muestre en la UI
      global.aiPaused = { paused: true, reason: 'tokens_exhausted', since: new Date().toISOString() };
    } else {
      console.error('Error analizando con Groq:', error);
    }
    return null;
  }
}

function cleanEmailText(text) {
  if (!text) return "(Sin texto)";
  let cleaned = text;
  // Remover historial de correos citado
  const regex = /(\bEl\s+.+?escribió:|\bOn\s+.+?wrote:|---)/i;
  const match = cleaned.match(regex);
  if (match) {
    cleaned = cleaned.substring(0, match.index);
  }
  // Remover = o espacios extras al inicio (falla común de Gmail con n8n)
  cleaned = cleaned.replace(/^[\s=]+/, '').trim();
  return cleaned || "(Sin texto)";
}

// 2. Webhook para recibir correos entrantes desde n8n (Inbound)
router.post('/webhooks/email-reply', async (req, res) => {
  try {
    // Datos que n8n debe enviar
    const { from, subject, text, threadId } = req.body;

    console.log('📬 Nuevo correo recibido. Body completo:', JSON.stringify(req.body, null, 2));

    // Limpiar el email de formato "Nombre <email@dom.com>"
    let cleanEmail = from || "";
    if (typeof cleanEmail === 'string') {
      const match = cleanEmail.match(/<(.+)>/);
      if (match) cleanEmail = match[1];
      cleanEmail = cleanEmail.trim().toLowerCase();
    } else {
      console.log('⚠️ El campo "from" no es un string:', from);
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
      console.log('Ignorando correo (No es de un lead):', cleanEmail, '| raw from:', from);
      return res.json({ 
        success: true, // Lo marcamos en true para que n8n no lo marque como error (probablemente es un correo que tú enviaste)
        ignored: true,
        message: 'Lead no encontrado (Probablemente un correo enviado por ti mismo). Ignorado correctamente.', 
        searchedEmail: cleanEmail
      });
    }

    // Análisis de la IA (Groq) — solo si Fase 3 activa
    const autopilotConfig = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    const phase3Active = autopilotConfig?.phase3Active && autopilotConfig?.globalActive;

    console.log(`🤖 Analizando respuesta del lead ${lead.nombre} con IA... (Fase 3 activa: ${phase3Active})`);
    
    let aiAnalysis = null;
    if (phase3Active) {
      aiAnalysis = await analyzeEmailWithAI(text, lead, autopilotConfig);
    }
    
    let nextState = 'REPLIED';
    
    if (aiAnalysis) {
      console.log('🧠 Resultado de IA:', aiAnalysis.classification);
      
      switch (aiAnalysis.classification) {
        case 'INTERESTED': nextState = 'INTERESTED'; break;
        case 'NOT_INTERESTED': nextState = 'NOT_INTERESTED'; break;
        case 'DOUBT': nextState = 'REPLIED'; break;
        case 'MEETING': nextState = 'MEETING_BOOKED'; break;
        case 'REQUIRES_HUMAN': nextState = 'REQUIRES_HUMAN'; break;
        case 'INVALID': nextState = 'INVALID'; break;
        default: nextState = 'REPLIED';
      }
    }

    let contactoActual = {};
    if (lead.contactoEstado) {
      contactoActual = typeof lead.contactoEstado === 'string' ? JSON.parse(lead.contactoEstado) : lead.contactoEstado;
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: { 
        pipelineState: nextState,
        status: nextState === 'NOT_INTERESTED' ? 'discarded' : undefined,
        contactoEstado: {
          ...contactoActual,
          ultimoMensajeRecibido: cleanEmailText(text),
          aiAnalysis: aiAnalysis || null
        }
      }
    });

    // Guardar en historial de correos
    await prisma.emailMessage.create({
      data: {
        leadId: lead.id,
        isIncoming: true,
        subject: subject || '(Sin asunto)',
        bodyText: cleanEmailText(text)
      }
    });

    console.log(`✅ Lead ${lead.nombre} -> ${nextState}. Historial guardado.`);

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
