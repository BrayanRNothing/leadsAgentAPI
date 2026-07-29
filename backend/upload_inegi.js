const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } }
});

const BATCH_SIZE = 1000;

const filesToProcess = [
  '../db_inegi/denue_00_72_1_csv/conjunto_de_datos/denue_inegi_72_1.csv',
  '../db_inegi/denue_00_72_2_csv/conjunto_de_datos/denue_inegi_72_2.csv',
  '../db_inegi/servicios_salud_asistencia_social/conjunto_de_datos/denue_inegi_62_.csv'
];

function cleanValue(val) {
  if (!val) return null;
  const clean = val.trim();
  return clean === '' ? null : clean;
}

async function processFile(filePath) {
  console.log(`\nIniciando procesamiento de: ${filePath}`);
  let batch = [];
  let totalProcessed = 0;
  
  const readStream = fs.createReadStream(filePath, { encoding: 'latin1' });
  const parser = readStream.pipe(csv());

  for await (const row of parser) {
    try {
      // Construir dirección
      const tipoVial = cleanValue(row.tipo_vial) || '';
      const nomVial = cleanValue(row.nom_vial) || '';
      const numExt = cleanValue(row.numero_ext) || '';
      let direccion = `${tipoVial} ${nomVial} ${numExt}`.trim();
      if (direccion === '') direccion = null;

      // Construir ubicación
      const entidad = cleanValue(row.entidad) || '';
      const municipio = cleanValue(row.municipio) || '';
      let ubicacion = `${entidad}, ${municipio}`.trim();
      if (ubicacion === ',') ubicacion = null;

      const lat = parseFloat(row.latitud);
      const lng = parseFloat(row.longitud);

      const record = {
        nombre: cleanValue(row.nom_estab) || 'Sin Nombre',
        telefono: cleanValue(row.telefono),
        sitioWeb: cleanValue(row.www),
        correo: cleanValue(row.correoelec),
        direccion: direccion,
        categoria: cleanValue(row.nombre_act),
        terminoBusqueda: cleanValue(row.nombre_act) || 'Desconocido',
        ubicacion: ubicacion,
        lat: isNaN(lat) ? null : lat,
        lng: isNaN(lng) ? null : lng,
      };

      batch.push(record);
      totalProcessed++;

      if (batch.length >= BATCH_SIZE) {
        // Insert batch sequentially
        await prisma.inegiLead.createMany({
          data: batch,
          skipDuplicates: true
        });
        
        console.log(`[${filePath}] Insertados ${totalProcessed} registros...`);
        batch = [];
      }
    } catch (err) {
      console.error('Error processing row:', err);
    }
  }

  // Insert remaining
  if (batch.length > 0) {
    try {
      await prisma.inegiLead.createMany({
        data: batch,
        skipDuplicates: true
      });
      console.log(`[${filePath}] Insertados ${totalProcessed} registros finales.`);
    } catch (err) {
      console.error('Error inserting final batch:', err);
    }
  }
  console.log(`Finalizado: ${filePath}. Total: ${totalProcessed}`);
}

async function run() {
  for (const file of filesToProcess) {
    if (fs.existsSync(file)) {
      await processFile(file);
    } else {
      console.error(`Archivo no encontrado: ${file}`);
    }
  }
  console.log('\n¡Todos los archivos han sido procesados!');
  await prisma.$disconnect();
}

run().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
