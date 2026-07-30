require('dotenv').config();
const prisma = require('../src/prisma');

async function main() {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: 310301 }
    });
    console.log('=== LEAD 310301 ===');
    console.log(JSON.stringify(lead, null, 2));

    const excludedStates = ['REPLIED', 'INTERESTED', 'FOLLOW_UP', 'NOT_INTERESTED', 'DISCARDED', 'INVALID', 'REQUIRES_HUMAN', 'MEETING_BOOKED'];
    console.log('\n=== RUNNING QUERY WITH EXCLUDED STATES ===');
    const leads = await prisma.lead.findMany({
      where: {
        id: 310301,
        pipelineState: {
          notIn: excludedStates
        }
      }
    });
    console.log(`Leads returned matching ID 310301 and notIn excluded: ${leads.length}`);
    if (leads.length > 0) {
      console.log(JSON.stringify(leads[0], null, 2));
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
