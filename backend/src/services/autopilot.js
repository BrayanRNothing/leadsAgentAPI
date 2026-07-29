const { PrismaClient } = require("@prisma/client");
const { Resend } = require("resend");
const prisma = new PrismaClient();
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

    let pendingLeads = await prisma.lead.findMany({
      where: { pipelineState: "NEW", correo: { not: null } },
      take: batchSize
    });

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

    console.log(`[Auto-Piloto] Fase 2 activa: Hay ${pendingLeads.length} leads en cola esperando que n8n los extraiga. (Límite enviado hoy: ${config.sentTodayCount}/${config.dailyLimit})`);
    
    // N8n poll takes care of sending emails. We just wait.
    if (isRunning) {
      currentTimeout = setTimeout(loop, 30 * 1000); // Check again in 30 seconds
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
