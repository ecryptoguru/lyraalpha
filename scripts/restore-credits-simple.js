import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const userId = process.argv[2];

if (!userId || !userId.startsWith('user_')) {
  console.error('Usage: node scripts/restore-credits-simple.js user_YOUR_ID');
  process.exit(1);
}

async function restoreCredits() {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true, credits: true }
    });

    if (!user) {
      console.error('User not found:', userId);
      process.exit(1);
    }

    console.log('Found:', user.email, '| Plan:', user.plan, '| Current credits:', user.credits);

    const amount = user.plan === 'ELITE' || user.plan === 'ENTERPRISE' ? 1500 : 500;

    // Create credit transaction
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
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      }
    });

    // Update user balances
    const newBalance = user.credits + amount;
    await prisma.user.update({
      where: { id: user.id },
      data: {
        credits: newBalance,
        bonusCreditsBalance: { increment: amount },
        totalCreditsEarned: { increment: amount }
      }
    });

    console.log('✅ SUCCESS! Added', amount, 'credits');
    console.log('   Transaction ID:', transaction.id);
    console.log('   New balance:', newBalance);

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCredits();
