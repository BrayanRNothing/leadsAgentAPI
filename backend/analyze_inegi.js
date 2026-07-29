const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

async function main() {
  const total = await p.inegiLead.count();
  console.log('Total InegiLeads en DB:', total);

  const conCorreo = await p.inegiLead.count({ where: { correo: { not: null } } });
  console.log('Con correo:', conCorreo);

  const muestra = await p.inegiLead.findMany({
    where: { correo: { not: null } },
    take: 5,
    select: { nombre: true, correo: true, categoria: true, ubicacion: true }
  });
  console.log('\nMuestra de 5 leads con correo:');
  muestra.forEach(l => console.log(JSON.stringify(l)));

  const hvacKeywords = ['hotel', 'hospital', 'industria', 'planta', 'fabrica', 'comercial', 'mall', 'plaza'];
  for (const kw of hvacKeywords) {
    const n = await p.inegiLead.count({
      where: {
        status: 'active',
        correo: { not: null },
        OR: [
          { nombre: { contains: kw, mode: 'insensitive' } },
          { categoria: { contains: kw, mode: 'insensitive' } }
        ]
      }
    });
    console.log(`Keyword "${kw}": ${n} leads calificados con correo`);
  }
}

main().catch(console.error).finally(() => p.$disconnect());
