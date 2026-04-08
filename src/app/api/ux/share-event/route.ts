import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { apiError } from "@/lib/api-response";

export const preferredRegion = "bom1";

const ShareEventSchema = z.object({
  action: z.enum([
    "sheet_open",
    "native_share_attempt",
    "native_share_success",
    "share_x_attempt",
    "share_x_success",
    "share_linkedin_attempt",
    "share_linkedin_success",
    "share_reddit_attempt",
    "share_reddit_success",
    "copy_link_success",
    "copy_post_success",
    "copy_x_success",
    "copy_linkedin_success",
    "copy_reddit_success",
    "download_card_success",
    "invite_toggle_on",
    "invite_toggle_off",
  ]),
  kind: z.string().min(1).max(32),
  mode: z.string().min(1).max(32),
  path: z.string().min(1).max(160),
  ts: z.number().int().optional(),
});

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizePath(path: string): string {
  if (path.startsWith("/admin")) return "/admin";
  if (path.startsWith("/dashboard")) return path.split("?")[0] || "/dashboard";
  return path.split("?")[0] || "/";
}

export async function POST(request: NextRequest) {
  const parsed = ShareEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError("Invalid payload", 400);
  }

  try {
    const { userId } = await auth();
    const now = new Date();
    const path = normalizePath(parsed.data.path);
    const key = `ux:share-events:${dayKey(now)}`;
    const field = [
      parsed.data.action,
      parsed.data.kind,
      parsed.data.mode,
      path,
    ].join(":");

    const pipeline = redis.pipeline();
    pipeline.hincrby(key, field, 1);
    pipeline.expire(key, 60 * 60 * 24 * 31);

    if (userId) {
      const userKey = `ux:share-events:user:${dayKey(now)}`;
      const userField = [
        parsed.data.action,
        parsed.data.kind,
        parsed.data.mode,
        path,
        userId,
      ].join(":");
      pipeline.hset(userKey, { [userField]: "1" });
      pipeline.expire(userKey, 60 * 60 * 24 * 31);
    }

    await pipeline.exec();
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
