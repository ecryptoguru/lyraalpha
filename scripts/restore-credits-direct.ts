// Direct database credit restore - runs without Next.js
// Usage: npx tsx scripts/restore-credits-direct.ts user_ID

import { directPrisma as prisma } from '../src/lib/prisma';

const userId = process.argv[2];

if (!userId) {
  console.error('Usage: npx tsx scripts/restore-credits-direct.ts user_YOUR_ID');
  process.exit(1);
}

async function restoreCredits() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { 
        id: true, 
        email: true, 
        plan: true, 
        credits: true,
        bonusCreditsBalance: true 
      }
    });

    if (!user) {
      console.error('User not found:', userId);
      process.exit(1);
    }

    console.log(`Found: ${user.email}`);
    console.log(`Plan: ${user.plan}`);
    console.log(`Current credits: ${user.credits}`);

    const amount = user.plan === 'ELITE' || user.plan === 'ENTERPRISE' ? 1500 : 500;
    
    console.log(`\nAdding ${amount} credits...`);

    // Create transaction
    const transaction = await prisma.creditTransaction.create({
      data: {
        userId: user.id,
        amount: amount,
        type: 'ADJUSTMENT',
        description: 'Monthly credit restore - April 2026 (bug fix)',
      }
    });

    // Create credit lot
    await prisma.creditLot.create({
      data: {
        userId: user.id,
        transactionId: transaction.id,
        bucket: 'BONUS',
        originalAmount: amount,
        remainingAmount: amount,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      }
    });

    // Update user
    const newBalance = user.credits + amount;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: newBalance,
        bonusCreditsBalance: user.bonusCreditsBalance + amount,
      }
    });

    console.log('\n✅ SUCCESS!');
    console.log(`Added: ${amount} credits`);
    console.log(`New balance: ${newBalance}`);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCredits();
