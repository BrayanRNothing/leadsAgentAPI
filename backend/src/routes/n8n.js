const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// 1. Endpoint para que n8n extraiga leads listos para enviar (Outbound)
router.get('/leads-outbound', async (req, res) => {
  try {
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    
    // Si la fase 2 global está desactivada, no enviar leads a n8n
    if (!config?.globalActive || !config?.phase2Active) {
      return res.json({ success: true, count: 0, leads: [], message: 'Fase 2 desactivada' });
    }

    // Verificar límite diario
    const today = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().split("T")[0];
    if (config.sentTodayDate !== today) {
      await prisma.autoPilotConfig.update({ where: { id: 1 }, data: { sentTodayCount: 0, sentTodayDate: today } });
      config.sentTodayCount = 0;
    }

    if (config.sentTodayCount >= config.dailyLimit) {
      return res.json({ success: true, count: 0, leads: [], message: 'Límite diario alcanzado' });
    }

    // Límite por lote
    let limit = parseInt(req.query.limit) || config.batchSize || 10;
    const remaining = config.dailyLimit - config.sentTodayCount;
    if (limit > remaining) limit = remaining;

    let leadsDb = await prisma.lead.findMany({
      where: {
        pipelineState: 'CONTACTING', 
        correo: { not: null }
      },
      take: limit
    });

    if (leadsDb.length < limit) {
      const remainingLimit = limit - leadsDb.length;
      const newLeads = await prisma.lead.findMany({
        where: {
          pipelineState: 'NEW', 
          correo: { not: null }
        },
        take: remainingLimit
      });
      leadsDb = [...leadsDb, ...newLeads];
    }

    const leads = [];
    for (const l of leadsDb) {
      const pendingMessage = await prisma.leadMensaje.findFirst({
        where: { leadId: l.id, estado: 'pending' },
        include: { campana: true }
      });

      let subject, body, mensajeId = null;

      if (pendingMessage && pendingMessage.campana) {
        subject = pendingMessage.campana.asunto;
        body = pendingMessage.campana.cuerpo;
        mensajeId = pendingMessage.id;
      } else {
        subject = config?.templateSubject || 'Propuesta de Valor';
        body = config?.templateHtml || `Hola ${l.nombre || 'Empresa'},\n\nNos gustaría conectar contigo.`;
      }

      body = body.replace(/{{nombre_empresa}}/g, l.nombre || 'Empresa');
      subject = subject.replace(/{{nombre_empresa}}/g, l.nombre || 'Empresa');

      leads.push({
        id: l.id,
        nombre: l.nombre,
        correo: l.correo,
        n8n_subject: subject,
        n8n_body: body,
        mensajeId: mensajeId
      });
    }

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
    
    // AutoPilot config for limits and history
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    
    for (const lead of leads) {
      let contactoEstado = lead.contactoEstado || { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" };
      if (typeof contactoEstado === 'string') {
        try { contactoEstado = JSON.parse(contactoEstado); } catch(e) { contactoEstado = { correo: false, whatsapp: false, llamada: false, estado: "En Proceso" }; }
      }
      
      contactoEstado.correo = true;
      contactoEstado.estado = "Esperando respuesta";

      await prisma.lead.update({
        where: { id: lead.id },
        data: {
          pipelineState: 'SENT',
          contactoEstado: contactoEstado
        }
      });
      
      // Guardar en historial de correos enviado por n8n
      let subject = config?.templateSubject || 'Propuesta de Valor';
      let body = config?.templateHtml || `Hola ${lead.nombre || 'Empresa'},\n\nNos gustaría conectar contigo.`;
      body = body.replace(/{{nombre_empresa}}/g, lead.nombre || 'Empresa');
      subject = subject.replace(/{{nombre_empresa}}/g, lead.nombre || 'Empresa');

      await prisma.emailMessage.create({
        data: {
          leadId: lead.id,
          isIncoming: false,
          subject: subject,
          bodyText: body
        }
      });
    }

    // Incrementar limite diario del AutoPilot
    if (leads.length > 0) {
      await prisma.autoPilotConfig.update({
        where: { id: 1 },
        data: { sentTodayCount: { increment: leads.length } }
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
  
  // Dividir por delimitadores comunes de correo citado
  const delimiters = [
    /^[> \t]*De:\s+/mi,
    /^[> \t]*From:\s+/mi,
    /^[> \t]*Para:\s+/mi,
    /^[> \t]*To:\s+/mi,
    /^[> \t]*Enviado el:\s+/mi,
    /^[> \t]*Sent:\s+/mi,
    /^[> \t]*Date:\s+/mi,
    /^[> \t]*Fecha:\s+/mi,
    /^[> \t]*Subject:\s+/mi,
    /^[> \t]*Asunto:\s+/mi,
    /\bEl\s+.+?escribió:/i,
    /\bOn\s+.+?wrote:/i,
    /---/,
    /___/,
    /^-{3,}/,
    /^_{3,}/
  ];

  for (const delimiter of delimiters) {
    const match = cleaned.match(delimiter);
    if (match) {
      cleaned = cleaned.substring(0, match.index);
    }
  }

  // Quitar líneas que empiecen por '>' (citas de email antiguas)
  cleaned = cleaned
    .split('\n')
    .filter(line => !line.trim().startsWith('>'))
    .join('\n');

  // Limpiar caracteres extraños Quoted-Printable si existieran (=3D, =0A, etc.)
  cleaned = cleaned.replace(/=3D/g, '=').replace(/=0A/g, '\n').replace(/=20/g, ' ');

  // Limpiar caracteres sueltos '=' al final de líneas de codificación de email
  cleaned = cleaned.replace(/=\r?\n/g, '');

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
    } else if (phase3Active) {
      // Si la IA falló por falta de tokens o red, requiere revisión humana
      nextState = 'REQUIRES_HUMAN';
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
    res.status(500).json({ success: false, error: 'Error interno', details: error.message });
  }
});

router.get('/debug-status', async (req, res) => {
  try {
    const contactingCount = await prisma.lead.count({ where: { pipelineState: 'CONTACTING' } });
    const newCount = await prisma.lead.count({ where: { pipelineState: 'NEW' } });
    const sentCount = await prisma.lead.count({ where: { pipelineState: 'SENT' } });

    const julioLeads = await prisma.lead.findMany({
      where: { nombre: { contains: 'Julio', mode: 'insensitive' } },
      select: {
        id: true,
        nombre: true,
        correo: true,
        pipelineState: true,
        status: true
      }
    });

    res.json({
      success: true,
      counts: {
        CONTACTING: contactingCount,
        NEW: newCount,
        SENT: sentCount
      },
      julioLeads
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/debug-simple', async (req, res) => {
  try {
    const totalCount = await prisma.lead.count();
    res.json({ success: true, totalCount });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
