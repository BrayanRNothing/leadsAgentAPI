const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Archivos a procesar
// Actualmente configurado para correr desde el directorio "backend"
const CSV_FILES = [
  path.join(__dirname, '../../db_inegi/denue_00_72_1_csv/conjunto_de_datos/denue_inegi_72_1.csv'),
  path.join(__dirname, '../../db_inegi/denue_00_72_2_csv/conjunto_de_datos/denue_inegi_72_2.csv'),
  path.join(__dirname, '../../db_inegi/servicios_salud_asistencia_social/conjunto_de_datos/denue_inegi_62_.csv')
];

// BATCH SIZE para insertar a la base de datos de 500 en 500 para mayor rendimiento
const BATCH_SIZE = 500;

// Códigos SCIAN objetivo para HVAC
const TARGET_SCIAN = {
  hoteles: /^721/,       // Servicios de alojamiento temporal
  centros_salud: /^62/,  // Hospitales, clínicas, centros de salud y asistencia social
  centros_comerciales: /^531121|^452/, // Alquiler locales, tiendas departamentales
  fabricas: /^31|^32|^33/ // Manufactura (alimentos, farmacéutica, equipos)
};

async function processCSVFile(filePath) {
  console.log(`\n📂 Procesando archivo: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`❌ El archivo CSV no existe en la ruta especificada: ${filePath}`);
    return { processed: 0, inserted: 0, skipped: 0 };
  }

  let batch = [];
  let totalProcessed = 0;
  let totalInserted = 0;
  let totalSkipped = 0;

  const parser = fs.createReadStream(filePath, { encoding: 'latin1' }).pipe(csv());

  for await (const row of parser) {
    totalProcessed++;

    // Validar si la fila pertenece a un código SCIAN de interés
    const codigo = row.codigo_act || '';
    const isHotel = TARGET_SCIAN.hoteles.test(codigo);
    const isSalud = TARGET_SCIAN.centros_salud.test(codigo);
    const isCentro = TARGET_SCIAN.centros_comerciales.test(codigo);
    const isFabrica = TARGET_SCIAN.fabricas.test(codigo);

    // Si no es ninguno de nuestros objetivos, lo saltamos
    if (!isHotel && !isSalud && !isCentro && !isFabrica) {
      totalSkipped++;
      continue;
    }

    // Determinar categoría legible
    let categoria = 'Desconocida';
    if (isHotel) categoria = 'Hotel/Alojamiento';
    else if (isSalud) categoria = 'Centro de Salud/Hospital';
    else if (isCentro) categoria = 'Centro Comercial/Departamental';
    else if (isFabrica) categoria = 'Fábrica/Manufactura';

    // Mapear columnas del DENUE a nuestro modelo Lead
    const direccionParts = [
      row.tipo_vial, row.nom_vial,
      row.numero_ext ? `No. ${row.numero_ext}` : '',
      row.numero_int ? `Int. ${row.numero_int}` : '',
      row.tipo_asent, row.nomb_asent,
      row.cod_postal ? `C.P. ${row.cod_postal}` : ''
    ].filter(Boolean).join(' ');

    const ubicacion = `${row.entidad}, ${row.municipio}`;

    const newLead = {
      nombre: row.nom_estab || row.raz_social || 'Desconocido',
      telefono: row.telefono || null,
      sitioWeb: row.www || null,
      correo: row.correoelec || null,
      direccion: direccionParts || null,
      categoria: `${categoria} (${row.nombre_act})`,
      terminoBusqueda: `INEGI DENUE ${codigo}`,
      ubicacion: ubicacion,
      lat: parseFloat(row.latitud) || null,
      lng: parseFloat(row.longitud) || null,
      fuente: 'inegi',
      pipelineState: 'NEW'
    };

    batch.push(newLead);

    // Si el lote llegó a su tamaño máximo, insertamos a la BD
    if (batch.length >= BATCH_SIZE) {
      try {
        await prisma.lead.createMany({
          data: batch,
          skipDuplicates: true
        });
        totalInserted += batch.length;
        process.stdout.write(`\r📊 Progreso: ${totalProcessed} leídos | ✅ Insertados: ${totalInserted} | ⏭️ Omitidos: ${totalSkipped}`);
      } catch (err) {
        console.error('\n❌ Error al insertar el lote:', err.message);
      }
      batch = []; // Limpiamos después de la inserción exitosa o fallida
    }
  }

  // Insertar los restantes al final
  if (batch.length > 0) {
    try {
      await prisma.lead.createMany({
        data: batch,
        skipDuplicates: true
      });
      totalInserted += batch.length;
    } catch (err) {
      console.error('\n❌ Error al insertar el lote final:', err.message);
    }
  }

  console.log(`\n✅ Archivo completado: ${path.basename(filePath)}`);
  console.log(`Filas procesadas: ${totalProcessed} | Insertados: ${totalInserted} | Omitidos: ${totalSkipped}`);

  return { processed: totalProcessed, inserted: totalInserted, skipped: totalSkipped };
}

async function importInegiData() {
  console.log(`🚀 Iniciando importación masiva del INEGI...`);

  try {
    console.log('🧹 Limpiando base de datos de registros INEGI anteriores...');
    // Se elimina de la tabla principal los que vienen del inegi
    await prisma.lead.deleteMany({
      where: { fuente: 'inegi' }
    });
    console.log('✅ Base de datos limpia. Comenzando importación...');
  } catch (e) {
    console.error('Error al limpiar BD:', e);
  }

  let globalProcessed = 0;
  let globalInserted = 0;
  let globalSkipped = 0;

  for (const file of CSV_FILES) {
    try {
      const stats = await processCSVFile(file);
      globalProcessed += stats.processed;
      globalInserted += stats.inserted;
      globalSkipped += stats.skipped;
    } catch (e) {
      console.error(`Error procesando archivo ${file}:`, e);
    }
  }

  console.log(`\n\n🎉 ¡Importación Global Completada!`);
  console.log(`-----------------------------------`);
  console.log(`Total filas procesadas: ${globalProcessed}`);
  console.log(`Total leads guardados: ${globalInserted}`);
  console.log(`Total omitidos: ${globalSkipped}`);
  
  await prisma.$disconnect();
}

importInegiData().catch(console.error);
