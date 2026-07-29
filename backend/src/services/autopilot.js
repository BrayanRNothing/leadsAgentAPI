const { PrismaClient } = require('@prisma/client');
const { Resend } = require('resend');
const prisma = new PrismaClient();
const resend = new Resend(process.env.RESEND_API_KEY || 're_dummy'); // Ensure they have RESEND_API_KEY

let isRunning = false;
let currentTimeout = null;

async function startAutoPilot() {
  if (isRunning) return;
  isRunning = true;
  console.log('[Auto-Piloto] Iniciando...');
  
  // Set config to active
  await prisma.autoPilotConfig.upsert({
    where: { id: 1 },
    update: { isActive: true },
    create: { id: 1, isActive: true }
  });

  loop();
}

async function stopAutoPilot() {
  isRunning = false;
  if (currentTimeout) clearTimeout(currentTimeout);
  console.log('[Auto-Piloto] Detenido.');
  
  await prisma.autoPilotConfig.update({
    where: { id: 1 },
    data: { isActive: false }
  });
}

async function loop() {
  if (!isRunning) return;

  try {
    const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
    if (!config || !config.isActive) {
      isRunning = false;
      return;
    }

    // 1. Check if we have leads in 'NEW' state in CRM waiting to be contacted
    let pendingLeads = await prisma.lead.findMany({
      where: { pipelineState: 'NEW', correo: { not: null } },
      take: config.batchSize
    });

    // 2. If no leads in CRM, pull from InegiLead
    if (pendingLeads.length === 0) {
      // Palabras clave estratégicas para filtrar leads "peces gordos"
      const keywords = [
        'hotel', 'resort', 'motel', 'hospedaje', 'posada',
        'hospital', 'clinica', 'sanatorio', 'medico', 'salud',
        'comercial', 'plaza', 'supermercado', 'mall', 'corporativo', 'departamental',
        'industria', 'fabrica', 'planta', 'manufactura'
      ];
      
      const orConditions = keywords.flatMap(kw => [
        { nombre: { contains: kw, mode: 'insensitive' } },
        { categoria: { contains: kw, mode: 'insensitive' } }
      ]);

      console.log('[Auto-Piloto] Buscando nuevos leads calificados en INEGI...');
      const rawLeads = await prisma.inegiLead.findMany({
        where: { 
          correo: { not: null, not: '' },
          status: 'active',
          OR: orConditions
        },
        take: config.batchSize
      });

      if (rawLeads.length > 0) {
        // Move them to CRM
        const leadsToInsert = rawLeads.map(raw => ({
          nombre: raw.nombre,
          telefono: raw.telefono,
          sitioWeb: raw.sitioWeb,
          correo: raw.correo,
          direccion: raw.direccion,
          categoria: raw.categoria,
          terminoBusqueda: raw.terminoBusqueda || 'INEGI Automático',
          ubicacion: raw.ubicacion,
          lat: raw.lat,
          lng: raw.lng,
          fuente: 'inegi_autopilot',
          pipelineState: 'NEW'
        }));

        await prisma.lead.createMany({
          data: leadsToInsert,
          skipDuplicates: true
        });

        // Mark them as processed in InegiLead (by changing status or deleting)
        const ids = rawLeads.map(l => l.id);
        await prisma.inegiLead.updateMany({
          where: { id: { in: ids } },
          data: { status: 'processed_autopilot' }
        });

        // Re-fetch the pending leads
        pendingLeads = await prisma.lead.findMany({
          where: { pipelineState: 'NEW', fuente: 'inegi_autopilot' },
          take: config.batchSize
        });
      }
    }

    if (pendingLeads.length === 0) {
      console.log('[Auto-Piloto] No se encontraron más leads con correo. Reintentando en 1 minuto...');
      currentTimeout = setTimeout(loop, 60000);
      return;
    }

    console.log(`[Auto-Piloto] Procesando lote de ${pendingLeads.length} leads...`);

    // Process sequentially with delay
    for (const lead of pendingLeads) {
      if (!isRunning) break; // Check if stopped mid-batch

      console.log(`[Auto-Piloto] Enviando correo a ${lead.nombre} (${lead.correo})...`);
      
      // Personalize template
      const htmlBody = config.templateHtml.replace(/\{\{nombre_empresa\}\}/g, lead.nombre || 'Empresa');
      
      try {
        // Send email
        const { data, error } = await resend.emails.send({
          from: 'Acme <onboarding@resend.dev>', // Configured default for Resend test
          to: [lead.correo],
          subject: config.templateSubject,
          html: htmlBody
        });

        if (error) {
          console.error(`[Auto-Piloto] Error de Resend para ${lead.correo}:`, error);
        } else {
          // Mark as SENT
          await prisma.lead.update({
            where: { id: lead.id },
            data: { pipelineState: 'SENT' }
          });
          console.log(`[Auto-Piloto] Éxito. Lead ${lead.id} actualizado a SENT.`);
        }
      } catch (err) {
        console.error(`[Auto-Piloto] Error general enviando a ${lead.correo}:`, err.message);
      }

      // Delay between emails
      if (isRunning) {
        console.log(`[Auto-Piloto] Esperando ${config.delaySeconds} segundos...`);
        await new Promise(resolve => setTimeout(resolve, config.delaySeconds * 1000));
      }
    }

    // Call next iteration
    if (isRunning) {
      currentTimeout = setTimeout(loop, 2000); // Small pause before next batch
    }

  } catch (err) {
    console.error('[Auto-Piloto] Error en el bucle:', err);
    if (isRunning) {
      currentTimeout = setTimeout(loop, 10000); // Retry after 10s if error
    }
  }
}

// Function to resume on server start
async function resumeIfActive() {
  const config = await prisma.autoPilotConfig.findUnique({ where: { id: 1 } });
  if (config && config.isActive) {
    console.log('[Auto-Piloto] Reanudando tarea pendiente...');
    isRunning = true;
    loop();
  }
}

module.exports = {
  startAutoPilot,
  stopAutoPilot,
  resumeIfActive
};
