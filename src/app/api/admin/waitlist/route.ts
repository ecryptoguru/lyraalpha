import { NextResponse } from "next/server";

import { createLogger } from "@/lib/logger";
import { sanitizeError } from "@/lib/logger/utils";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getWaitlistStats, getWaitlistUsers, type WaitlistUserRecord } from "@/lib/services/waitlist.service";
import { apiError } from "@/lib/api-response";

const logger = createLogger({ service: "admin-waitlist" });

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes('"')) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export async function GET() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const [stats, users] = await Promise.all([getWaitlistStats(), getWaitlistUsers()]);

    return NextResponse.json({ stats, users });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to fetch waitlist users");
    return apiError("Failed to fetch waitlist users", 500);
  }
}

export async function POST() {
  const check = await requireAdmin();
  if (!check.authorized) return check.response;

  try {
    const users = await getWaitlistUsers();
    const csvRows = [
      ["email", "firstName", "lastName", "source", "status", "couponAccess", "createdAt", "lastEmailedAt"],
      ...users.map((user: WaitlistUserRecord) => [
        user.email,
        user.firstName ?? "",
        user.lastName ?? "",
        user.source,
        user.status,
        user.couponAccess ? "true" : "false",
        user.createdAt.toISOString(),
        user.lastEmailedAt?.toISOString() ?? "",
      ]),
    ];

    const csv = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="waitlist-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    logger.error({ err: sanitizeError(error) }, "Failed to export waitlist CSV");
    return apiError("Failed to export waitlist CSV", 500);
  }
}
