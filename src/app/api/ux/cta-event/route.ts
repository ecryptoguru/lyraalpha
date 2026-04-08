import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { apiError } from "@/lib/api-response";

export const preferredRegion = "bom1";

const CtaEventSchema = z.object({
  source: z.string().min(1).max(64),
  eventType: z.enum(["impression", "click"]),
  actionCount: z.number().int().min(0).max(20),
  actionBucket: z.enum(["0", "1", "2_plus"]),
  variant: z.enum(["control", "treatment"]),
  ts: z.number().int().optional(),
});

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function POST(request: NextRequest) {
  const parsed = CtaEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Invalid payload", 400);
  }

  try {
    const { userId } = await auth();
    const now = new Date();
    const key = `ux:cta-events:${dayKey(now)}`;
    const field = [
      parsed.data.source,
      parsed.data.eventType,
      parsed.data.actionBucket,
      parsed.data.variant,
    ].join(":");

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, field, 1);
    pipeline.expire(key, 60 * 60 * 24 * 16);

    if (userId) {
      const userKey = `ux:cta-events:user:${dayKey(now)}`;
      const userField = [
        parsed.data.source,
        parsed.data.eventType,
        parsed.data.actionBucket,
        parsed.data.variant,
        userId,
      ].join(":");
      pipeline.hset(userKey, { [userField]: "1" });
      pipeline.expire(userKey, 60 * 60 * 24 * 16);
    }

    await pipeline.exec();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
