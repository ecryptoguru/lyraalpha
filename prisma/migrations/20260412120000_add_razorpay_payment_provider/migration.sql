-- AlterEnum: Add RAZORPAY value to "PaymentProvider" enum
ALTER TYPE "PaymentProvider" ADD VALUE IF NOT EXISTS 'RAZORPAY';
