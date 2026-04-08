/**
 * Immediate Credit Restore - Run this to add 1500 credits to your account
 * 
 * Usage:
 * 1. Get your Clerk User ID from the browser console:
 *    - Open DevTools (F12)
 *    - Go to Console tab
 *    - Run: `await window.Clerk.user.id`
 *    - Copy the ID (looks like: user_abc123xyz)
 * 
 * 2. Run this script:
 *    npx ts-node scripts/restore-my-credits.ts user_YOUR_ID_HERE
 */

import { prisma } from "../src/lib/prisma";
import { addCredits } from "../src/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";

const userId = process.argv[2];

if (!userId || !userId.startsWith("user_")) {
  console.error("❌ Please provide your Clerk User ID");
  console.error("   Example: npx ts-node scripts/restore-my-credits.ts user_abc123");
  process.exit(1);
}

async function restoreCredits() {
  try {
    console.log(`🔍 Looking up user: ${userId}...`);
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, plan: true, credits: true }
    });

    if (!user) {
      console.error("❌ User not found in database");
      console.log("   Your user ID may be different. Check Clerk dashboard.");
      process.exit(1);
    }

    console.log(`✅ Found user: ${user.email}`);
    console.log(`   Current plan: ${user.plan}`);
    console.log(`   Current credits: ${user.credits}`);
    
    const amount = user.plan === "ELITE" || user.plan === "ENTERPRISE" ? 1500 : 500;
    
    console.log(`\n💰 Adding ${amount} credits...`);
    
    const newBalance = await addCredits(
      userId,
      amount,
      CreditTransactionType.ADJUSTMENT,
      "Monthly credit restore - April 2026 (bug fix)"
    );
    
    console.log(`\n✅ SUCCESS! Credits restored.`);
    console.log(`   Previous: ${user.credits}`);
    console.log(`   Added: ${amount}`);
    console.log(`   New balance: ${newBalance}`);
    
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

restoreCredits();
