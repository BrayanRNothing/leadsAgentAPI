const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.autoPilotConfig.update({
    where: { id: 1 },
    data: {
      templateSubject: 'Proteja sus equipos HVAC contra la corrosion costera',
      templateHtml: $html
    }
  });
  console.log('HTML actualizado correctamente en la base de datos');
}
main().catch(console.error);
