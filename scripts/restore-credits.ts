#!/usr/bin/env ts-node
/**
 * One-time credit restore script for ELITE/ENTERPRISE users affected by reset-credits bug
 * Run: npx ts-node scripts/restore-credits.ts <user-id>
 */

import { prisma } from "../src/lib/prisma";
import { addCredits } from "../src/lib/services/credit.service";
import { CreditTransactionType } from "@/generated/prisma/enums";

async function restoreCredits(userId: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, plan: true, credits: true, email: true },
    });

    if (!user) {
      console.error("User not found:", userId);
      process.exit(1);
    }

    if (user.plan !== "ELITE" && user.plan !== "ENTERPRISE") {
      console.error("User is not ELITE/ENTERPRISE:", user.plan);
      process.exit(1);
    }

    const monthlyCredits = user.plan === "ELITE" ? 1500 : 1500;

    console.log(`Restoring credits for ${user.email || userId}...`);
    console.log(`  Current credits: ${user.credits}`);
    console.log(`  Plan: ${user.plan}`);
    console.log(`  Granting: ${monthlyCredits}`);

    const newBalance = await addCredits(
      userId,
      monthlyCredits,
      CreditTransactionType.ADJUSTMENT,
      `Monthly credit reset fix - April 2026 (bug fix restore)`
    );

    console.log(`✅ Credits restored! New balance: ${newBalance}`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

const userId = process.argv[2];
if (!userId) {
  console.error("Usage: npx ts-node scripts/restore-credits.ts <user-id>");
  console.error("Get your user ID from the dashboard or database");
  process.exit(1);
}

restoreCredits(userId);
