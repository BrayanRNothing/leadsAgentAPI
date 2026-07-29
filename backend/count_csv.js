const fs = require('fs');
const csv = require('csv-parser');

const files = [
  '../db_inegi/denue_00_72_1_csv/conjunto_de_datos/denue_inegi_72_1.csv',
  '../db_inegi/denue_00_72_2_csv/conjunto_de_datos/denue_inegi_72_2.csv',
  '../db_inegi/servicios_salud_asistencia_social/conjunto_de_datos/denue_inegi_62_.csv'
];

async function countFile(filePath) {
  return new Promise((resolve) => {
    let total = 0, withEmail = 0;
    const stream = fs.createReadStream(filePath, { encoding: 'latin1' }).pipe(csv());
    stream.on('data', (row) => {
      total++;
      const email = row.correoelec || row.correoelec || '';
      if (email.trim() !== '') withEmail++;
    });
    stream.on('end', () => resolve({ total, withEmail }));
    stream.on('error', (e) => resolve({ total: -1, withEmail: -1, error: e.message }));
  });
}

async function main() {
  for (const f of files) {
    console.log(`\nAnalizando: ${f}`);
    if (!fs.existsSync(f)) { console.log('  No existe.'); continue; }
    const { total, withEmail, error } = await countFile(f);
    if (error) { console.log('  Error:', error); continue; }
    console.log(`  Total filas: ${total}`);
    console.log(`  Con correo:  ${withEmail}`);
    console.log(`  Sin correo:  ${total - withEmail}`);
  }
}

main();
