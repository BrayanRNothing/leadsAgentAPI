const { PrismaClient } = require('@prisma/client'); const prisma = new PrismaClient(); prisma.lead.deleteMany({}).then(() => console.log('Cleared Lead table')).finally(() => prisma.$disconnect());
