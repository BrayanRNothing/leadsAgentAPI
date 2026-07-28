const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const countInegi = await prisma.inegiLead.count();
  const countLead = await prisma.lead.count();
  console.log('InegiLead count:', countInegi);
  console.log('Lead count:', countLead);
  
  const inegiCats = await prisma.inegiLead.groupBy({by: ['categoria'], _count: true});
  console.log('InegiLead categories:', inegiCats);
  
  const inegiDiscarded = await prisma.inegiLead.count({ where: { status: 'discarded' } });
  console.log('InegiLead discarded:', inegiDiscarded);
  
  const leadCats = await prisma.lead.groupBy({by: ['categoria'], _count: true});
  console.log('Lead categories:', leadCats);
  
  const leadTerms = await prisma.lead.groupBy({by: ['terminoBusqueda'], _count: true});
  console.log('Lead terms:', leadTerms);
}

main().catch(console.error).finally(() => prisma.$disconnect());
