const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.inegiLead.count().then(console.log).finally(() => prisma.$disconnect());
