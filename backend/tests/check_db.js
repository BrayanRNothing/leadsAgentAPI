require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('=== CAMPAÑAS Y MENSAJES ===');
    
    const campanas = await prisma.campanaCorreo.findMany({
      include: {
        _count: { select: { mensajes: true } }
      }
    });
    console.log('\nCampañas en base de datos:');
    console.log(campanas);

    const mensajes = await prisma.leadMensaje.findMany({
      include: {
        lead: { select: { nombre: true } },
        campana: { select: { nombre: true } }
      }
    });
    console.log('\nMensajes (LeadMensaje) en base de datos:');
    console.log(mensajes);

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
