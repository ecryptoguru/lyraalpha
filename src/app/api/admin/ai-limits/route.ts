import { requireAdmin } from "@/lib/middleware/admin-guard";
import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { apiError } from "@/lib/api-response";
import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import {
  DAILY_TOKEN_CAPS_DEFAULTS,
  DAILY_TOKEN_CAPS_REDIS_KEY,
} from "@/lib/ai/service";
import { THRESHOLDS } from "@/lib/ai/alerting";

const logger = createLogger({ service: "admin-ai-limits" });

const ALERT_THRESHOLDS_REDIS_KEY = "lyra:admin:alert_thresholds";

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const [capOverrides, thresholdOverrides] = await Promise.all([
      redis.hgetall(DAILY_TOKEN_CAPS_REDIS_KEY).catch(() => null),
      redis.hgetall(ALERT_THRESHOLDS_REDIS_KEY).catch(() => null),
    ]);

    const caps = { ...DAILY_TOKEN_CAPS_DEFAULTS };
    if (capOverrides) {
      for (const [plan, val] of Object.entries(capOverrides)) {
        const n = Number(val);
        if (isFinite(n) && n > 0) caps[plan] = n;
      }
    }

    const alertThresholds = { ...THRESHOLDS };
    if (thresholdOverrides) {
      for (const [key, val] of Object.entries(thresholdOverrides)) {
        const n = Number(val);
        if (isFinite(n) && n > 0) (alertThresholds as Record<string, number>)[key] = n;
      }
    }

    return NextResponse.json({
      caps,
      defaults: DAILY_TOKEN_CAPS_DEFAULTS,
      alertThresholds,
      alertThresholdsDefaults: THRESHOLDS,
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch AI limits");
    return apiError("Failed to fetch AI limits", 500);
  }
}

export async function POST(req: Request) {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const body = await req.json() as {
      type: "caps" | "alertThresholds";
      plan?: string;
      key?: string;
      value: number | null;
    };

    if (body.type === "caps") {
      if (!body.plan || !["STARTER", "PRO", "ELITE"].includes(body.plan)) {
        return apiError("Invalid plan — must be STARTER, PRO, or ELITE", 400);
      }
      if (body.value === null) {
        // Reset to default
        await redis.hdel(DAILY_TOKEN_CAPS_REDIS_KEY, body.plan);
        logger.info({ plan: body.plan }, "Admin reset daily token cap to default");
      } else {
        const cap = Number(body.value);
        if (!isFinite(cap) || cap < 1000) {
          return apiError("Cap must be a finite number >= 1000", 400);
        }
        await redis.hset(DAILY_TOKEN_CAPS_REDIS_KEY, { [body.plan]: cap });
        logger.info({ plan: body.plan, cap }, "Admin updated daily token cap");
      }
    } else if (body.type === "alertThresholds") {
      if (!body.key || !(body.key in THRESHOLDS)) {
        return apiError(`Invalid threshold key: ${body.key}`, 400);
      }
      if (body.value === null) {
        await redis.hdel(ALERT_THRESHOLDS_REDIS_KEY, body.key);
        logger.info({ key: body.key }, "Admin reset alert threshold to default");
      } else {
        const val = Number(body.value);
        if (!isFinite(val) || val <= 0) {
          return apiError("Threshold must be a positive number", 400);
        }
        await redis.hset(ALERT_THRESHOLDS_REDIS_KEY, { [body.key]: val });
        logger.info({ key: body.key, val }, "Admin updated alert threshold");
      }
    } else {
      return apiError("Invalid type — must be 'caps' or 'alertThresholds'", 400);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to update AI limits");
    return apiError("Failed to update AI limits", 500);
  }
}
