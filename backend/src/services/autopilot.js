const prisma = require("../prisma");
const { Resend } = require("resend");
const resend = new Resend(process.env.RESEND_API_KEY || "re_dummy");

let isRunning = false;
let currentTimeout = null;

function getTodayMX() {
  const d = new Date(Date.now() - 6 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

async function refreshDailyCounter(config) {
  const today = getTodayMX();
  if (config.sentTodayDate !== today) {
    const updated = await prisma.autoPilotConfig.update({
      where: { id: 1 },
      data: { sentTodayCount: 0, sentTodayDate: today }
    });
    console.log("[Auto-Piloto] Nuevo dia - contador diario reseteado");
    return updated;
  }
  return config;
}

function getMsUntilMidnightMX() {
  const now = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow - now;
}

async function startAutoPilot() {
  if (isRunning) return;
  isRunning = true;
  console.log("[Auto-Piloto] Iniciando...");
  await prisma.autoPilotConfig.upsert({
    where: { id: 1 },
    update: { phase2Active: true },
    create: { id: 1, phase2Active: true }
  });
  loop();
}

async function stopAutoPilot() {
  isRunning = false;
  if (currentTimeout) clearTimeout(currentTimeout);
  console.log("[Auto-Piloto] Detenido.");
  await prisma.autoPilotConfig.update({
    where: { id: 1 },
    data: { phase2Active: false }
  });
}

async function sendEmailToLead(lead, config) {
  // Obtener asunto y cuerpo del template de config o de un LeadMensaje pendiente
  const pendingMessage = await prisma.leadMensaje.findFirst({
    where: { leadId: lead.id, estado: 'pending' },
    include: { campana: true }
  });

  let subject, body, mensajeId = null;

  if (pendingMessage && pendingMessage.campana) {
    subject = pendingMessage.campana.asunto;
    body = pendingMessage.campana.cuerpo;
    mensajeId = pendingMessage.id;
  } else {
    subject = config?.templateSubject || 'Propuesta de Valor';
    body = config?.templateHtml || `Hola ${lead.nombre || 'Empresa'},\n\nNos gustaría conectar contigo.`;
  }

  body = body.replace(/{{nombre_empresa}}/g, lead.nombre || 'Empresa');
  body = body.replace(/{{nombre}}/g, lead.nombre || 'Empresa');
  subject = subject.replace(/{{nombre_empresa}}/g, lead.nombre || 'Empresa');
  subject = subject.replace(/{{nombre}}/g, lead.nombre || 'Empresa');

  // Extract Calendly link from availability or use a fallback
  let calendlyUrl = 'https://calendly.com';
  if (config?.availability) {
    const urlMatch = config.availability.match(/https?:\/\/[^\s"']+/);
    if (urlMatch) {
      calendlyUrl = urlMatch[0];
    }
  }
  body = body.replace(/\[LINK_CALENDLY\]/g, calendlyUrl);
  subject = subject.replace(/\[LINK_CALENDLY\]/g, calendlyUrl);

  // Enviar con Resend
  const fromEmail = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
  
  const result = await resend.emails.send({
    from: fromEmail,
    to: lead.correo,
    subject: subject,
    html: body
  });

  console.log(`[Auto-Piloto] ✅ Correo enviado a ${lead.nombre} (${lead.correo}) - ID: ${result.data?.id || 'ok'}`);

  // Actualizar lead a SENT
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

  // Guardar en historial de correos
  await prisma.emailMessage.create({
    data: {
      leadId: lead.id,
      isIncoming: false,
      subject: subject,
      bodyText: body
    }
  });

  // Si habia un LeadMensaje pendiente, marcarlo como enviado
  if (mensajeId) {
    await prisma.leadMensaje.update({
      where: { id: mensajeId },
      data: { estado: 'sent', enviadoEn: new Date() }
    });
  }

  return true;
}

async function loop() {
  if (!isRunning) return;

  try {
    let config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    if (!config || !config.phase2Active || !config.globalActive) {
      console.log("[Auto-Piloto] Bot detenido (global o fase 2 inactiva).");
      isRunning = false;
      return;
    }

    config = await refreshDailyCounter(config);

    if (config.sentTodayCount >= config.dailyLimit) {
      const ms = getMsUntilMidnightMX();
      console.log(`[Auto-Piloto] Limite diario alcanzado (${config.sentTodayCount}/${config.dailyLimit}). Esperando hasta manana...`);
      currentTimeout = setTimeout(loop, ms);
      return;
    }

    const remaining = config.dailyLimit - config.sentTodayCount;
    const batchSize = Math.min(config.batchSize, remaining);

    // Primero tomar leads en CONTACTING (campañas manuales)
    let pendingLeads = await prisma.lead.findMany({
      where: { pipelineState: 'CONTACTING', correo: { not: null } },
      take: batchSize
    });

    // Si no hay CONTACTING, tomar NEW
    if (pendingLeads.length < batchSize) {
      const remainingSlots = batchSize - pendingLeads.length;
      const newLeads = await prisma.lead.findMany({
        where: { pipelineState: "NEW", correo: { not: null } },
        take: remainingSlots
      });
      pendingLeads = [...pendingLeads, ...newLeads];
    }

    // Si no hay leads disponibles y fase 1 activa, traer de INEGI
    if (pendingLeads.length === 0 && config.phase1Active) {
      const keywords = [
        "hotel","resort","motel","hospedaje","posada",
        "hospital","clinica","sanatorio","medico","salud",
        "comercial","plaza","supermercado","mall","corporativo","departamental",
        "industria","fabrica","planta","manufactura"
      ];
      const orConditions = keywords.flatMap(kw => [
        { nombre: { contains: kw, mode: "insensitive" } },
        { categoria: { contains: kw, mode: "insensitive" } }
      ]);

      console.log("[Auto-Piloto] Fase 1: Buscando leads calificados en INEGI...");
      const rawLeads = await prisma.inegiLead.findMany({
        where: { correo: { not: null }, status: "active", OR: orConditions },
        take: batchSize
      });

      if (rawLeads.length > 0) {
        const leadsToInsert = rawLeads.map(raw => ({
          nombre: raw.nombre, telefono: raw.telefono, sitioWeb: raw.sitioWeb,
          correo: raw.correo, direccion: raw.direccion, categoria: raw.categoria,
          terminoBusqueda: raw.terminoBusqueda || "INEGI Automatico",
          ubicacion: raw.ubicacion, lat: raw.lat, lng: raw.lng,
          fuente: "inegi_autopilot", pipelineState: "NEW"
        }));
        await prisma.lead.createMany({ data: leadsToInsert, skipDuplicates: true });
        await prisma.inegiLead.updateMany({
          where: { id: { in: rawLeads.map(l => l.id) } },
          data: { status: "processed_autopilot" }
        });
        pendingLeads = await prisma.lead.findMany({
          where: { pipelineState: "NEW", fuente: "inegi_autopilot" },
          take: batchSize
        });
      }
    }

    if (pendingLeads.length === 0) {
      console.log("[Auto-Piloto] Sin leads disponibles para enviar. Reintentando en 5 min...");
      currentTimeout = setTimeout(loop, 5 * 60 * 1000);
      return;
    }

    console.log(`[Auto-Piloto] Fase 2: Enviando correos a ${pendingLeads.length} leads con Resend...`);

    let sentCount = 0;
    const delaySeconds = config.delaySeconds || 30;

    for (const lead of pendingLeads) {
      if (!isRunning) break;
      
      try {
        // Marcar como CONTACTING mientras se envía
        await prisma.lead.update({
          where: { id: lead.id },
          data: { pipelineState: 'CONTACTING' }
        });

        await sendEmailToLead(lead, config);
        sentCount++;

        // Incrementar contador diario
        await prisma.autoPilotConfig.update({
          where: { id: 1 },
          data: { sentTodayCount: { increment: 1 } }
        });

        // Esperar entre correos para no saturar
        if (sentCount < pendingLeads.length) {
          console.log(`[Auto-Piloto] Esperando ${delaySeconds}s antes del siguiente correo...`);
          await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        }
      } catch (emailErr) {
        console.error(`[Auto-Piloto] ❌ Error enviando a ${lead.nombre} (${lead.correo}):`, emailErr.message);
        
        // Marcar como INVALID si falló el envío
        await prisma.lead.update({
          where: { id: lead.id },
          data: { pipelineState: 'INVALID' }
        }).catch(() => {});
      }
    }

    console.log(`[Auto-Piloto] Lote completado: ${sentCount}/${pendingLeads.length} correos enviados.`);

    // Esperar el cooldown entre lotes antes de buscar más
    const cooldownMs = (config.batchCooldownHours || 4) * 60 * 60 * 1000;
    console.log(`[Auto-Piloto] Esperando ${config.batchCooldownHours || 4}h antes del siguiente lote...`);
    
    if (isRunning) {
      currentTimeout = setTimeout(loop, cooldownMs);
    }

  } catch (err) {
    console.error("[Auto-Piloto] Error en el bucle:", err);
    if (isRunning) currentTimeout = setTimeout(loop, 60 * 1000);
  }
}

async function resumeIfActive() {
  const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
  if (config && config.phase2Active && config.globalActive) {
    console.log("[Auto-Piloto] Reanudando tarea pendiente...");
    isRunning = true;
    loop();
  }
}

function getIsRunning() { return isRunning; }

module.exports = { startAutoPilot, stopAutoPilot, resumeIfActive, getIsRunning };
