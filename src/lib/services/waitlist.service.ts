import { randomUUID } from "crypto";

import { Prisma } from "@/generated/prisma/client";
import { upsertBrevoContact } from "@/lib/email/brevo";
import { prisma } from "@/lib/prisma";

export interface CreateWaitlistInput {
  email: string;
  firstName?: string;
  lastName?: string;
  source?: string;
  notes?: string;
  couponAccess?: boolean;
}

export interface WaitlistStats {
  total: number;
  couponAccessCount: number;
  recent7d: number;
}

export interface WaitlistUserRecord {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  status: string;
  notes: string | null;
  couponAccess: boolean;
  brevoSyncedAt: Date | null;
  lastEmailedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function sanitizeOptional(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function upsertWaitlistRow(params: {
  email: string;
  firstName: string | null;
  lastName: string | null;
  source: string;
  notes: string | null;
  couponAccess: boolean;
}) {
  const rows = await prisma.$queryRaw<WaitlistUserRecord[]>(Prisma.sql`
    INSERT INTO public."WaitlistUser" (
      "id",
      "email",
      "firstName",
      "lastName",
      "source",
      "notes",
      "couponAccess",
      "updatedAt"
    )
    VALUES (
      ${randomUUID()},
      ${params.email},
      ${params.firstName},
      ${params.lastName},
      ${params.source},
      ${params.notes},
      ${params.couponAccess},
      NOW()
    )
    ON CONFLICT ("email") DO UPDATE SET
      "firstName" = EXCLUDED."firstName",
      "lastName" = EXCLUDED."lastName",
      "source" = EXCLUDED."source",
      "notes" = EXCLUDED."notes",
      "couponAccess" = public."WaitlistUser"."couponAccess" OR EXCLUDED."couponAccess",
      "updatedAt" = NOW()
    RETURNING
      "id",
      "email",
      "firstName",
      "lastName",
      "source",
      "status",
      "notes",
      "couponAccess",
      "brevoSyncedAt",
      "lastEmailedAt",
      "createdAt",
      "updatedAt"
  `);

  return rows[0];
}

export async function createOrUpdateWaitlistUser(input: CreateWaitlistInput) {
  const email = input.email.trim().toLowerCase();
  const firstName = sanitizeOptional(input.firstName);
  const lastName = sanitizeOptional(input.lastName);
  const source = sanitizeOptional(input.source) ?? "landing_page";
  const notes = sanitizeOptional(input.notes);
  const couponAccess = Boolean(input.couponAccess);

  const record = await upsertWaitlistRow({
    email,
    firstName,
    lastName,
    source,
    notes,
    couponAccess,
  });

  const waitlistListId = process.env.BREVO_WAITLIST_LIST_ID;
  const listId = waitlistListId ? Number(waitlistListId) : null;
  const brevoSynced = await upsertBrevoContact({
    email,
    firstName,
    lastName,
    listIds: listId && Number.isFinite(listId) ? [listId] : undefined,
    attributes: {
      SOURCE: source,
      WAITLIST: true,
      COUPONACCESS: couponAccess,
    },
  });

  if (!brevoSynced) {
    return record;
  }

  const syncedRows = await prisma.$queryRaw<WaitlistUserRecord[]>(Prisma.sql`
    UPDATE public."WaitlistUser"
    SET "brevoSyncedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" = ${record.id}
    RETURNING
      "id",
      "email",
      "firstName",
      "lastName",
      "source",
      "status",
      "notes",
      "couponAccess",
      "brevoSyncedAt",
      "lastEmailedAt",
      "createdAt",
      "updatedAt"
  `);

  return syncedRows[0] ?? record;
}

export async function getWaitlistStats(): Promise<WaitlistStats> {
  const rows = await prisma.$queryRaw<Array<{ total: bigint; couponAccessCount: bigint; recent7d: bigint }>>(Prisma.sql`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "couponAccess" = true)::bigint AS "couponAccessCount",
      COUNT(*) FILTER (WHERE "createdAt" >= NOW() - INTERVAL '7 day')::bigint AS "recent7d"
    FROM public."WaitlistUser"
  `);

  const stats = rows[0];

  return {
    total: Number(stats?.total ?? 0),
    couponAccessCount: Number(stats?.couponAccessCount ?? 0),
    recent7d: Number(stats?.recent7d ?? 0),
  };
}

export async function getWaitlistUsers(): Promise<WaitlistUserRecord[]> {
  return prisma.$queryRaw<WaitlistUserRecord[]>(Prisma.sql`
    SELECT
      "id",
      "email",
      "firstName",
      "lastName",
      "source",
      "status",
      "notes",
      "couponAccess",
      "brevoSyncedAt",
      "lastEmailedAt",
      "createdAt",
      "updatedAt"
    FROM public."WaitlistUser"
    ORDER BY "createdAt" DESC
  `);
}

export async function getWaitlistUsersByIds(ids: string[]): Promise<WaitlistUserRecord[]> {
  if (ids.length === 0) return [];

  return prisma.$queryRaw<WaitlistUserRecord[]>(Prisma.sql`
    SELECT
      "id",
      "email",
      "firstName",
      "lastName",
      "source",
      "status",
      "notes",
      "couponAccess",
      "brevoSyncedAt",
      "lastEmailedAt",
      "createdAt",
      "updatedAt"
    FROM public."WaitlistUser"
    WHERE "id" IN (${Prisma.join(ids)})
    ORDER BY "createdAt" DESC
  `);
}

export async function markWaitlistUsersEmailed(ids: string[]) {
  if (ids.length === 0) return;

  await prisma.$executeRaw(Prisma.sql`
    UPDATE public."WaitlistUser"
    SET "lastEmailedAt" = NOW(),
        "updatedAt" = NOW()
    WHERE "id" IN (${Prisma.join(ids)})
  `);
}
