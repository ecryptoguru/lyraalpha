// Update user plan - runs without Next.js
// Usage: npx tsx scripts/update-user-plan.ts email@example.com PLAN

import { directPrisma as prisma } from '../src/lib/prisma';

const email = process.argv[2];
const newPlan = process.argv[3];

if (!email || !newPlan) {
  console.error('Usage: npx tsx scripts/update-user-plan.ts email@example.com PLAN');
  console.error('Valid plans: STARTER, PRO, ELITE, ENTERPRISE');
  process.exit(1);
}

const validPlans = ['STARTER', 'PRO', 'ELITE', 'ENTERPRISE'];
if (!validPlans.includes(newPlan)) {
  console.error('Invalid plan. Valid plans: STARTER, PRO, ELITE, ENTERPRISE');
  process.exit(1);
}

async function updateUserPlan() {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { 
        id: true, 
        email: true, 
        plan: true,
        credits: true,
      }
    });

    if (!user) {
      console.error('User not found:', email);
      process.exit(1);
    }

    console.log(`Found: ${user.email}`);
    console.log(`Current plan: ${user.plan}`);
    console.log(`Current credits: ${user.credits}`);
    
    console.log(`\nUpdating plan to ${newPlan}...`);

    await prisma.user.update({
      where: { id: user.id },
      data: { plan: newPlan as 'STARTER' | 'PRO' | 'ELITE' | 'ENTERPRISE' }
    });

    console.log('\n✅ SUCCESS!');
    console.log(`Updated plan from ${user.plan} to ${newPlan}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateUserPlan();
