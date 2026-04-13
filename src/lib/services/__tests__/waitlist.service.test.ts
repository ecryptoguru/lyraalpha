/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, brevoMock } = vi.hoisted(() => ({
  prismaMock: { $queryRaw: vi.fn(), $executeRaw: vi.fn() },
  brevoMock: { upsertBrevoContact: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/email/brevo", () => ({ upsertBrevoContact: brevoMock.upsertBrevoContact }));
vi.stubEnv("BREVO_WAITLIST_LIST_ID", "123");

import {
  createOrUpdateWaitlistUser, getWaitlistStats, getWaitlistUsers, getWaitlistUsersByIds, markWaitlistUsersEmailed,
  CreateWaitlistInput,
} from "../waitlist.service";

const mockUser = {
  id: "wl_1", email: "test@example.com", firstName: "John", lastName: "Doe",
  source: "landing_page", status: "PENDING", notes: null, brevoSyncedAt: null, lastEmailedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe("createOrUpdateWaitlistUser", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("creates new waitlist user with brevo sync", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([mockUser]);
    brevoMock.upsertBrevoContact.mockResolvedValue(true);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...mockUser, brevoSyncedAt: new Date() }]);

    const input: CreateWaitlistInput = { email: "test@example.com", firstName: "John", lastName: "Doe", source: "referral" };
    const result = await createOrUpdateWaitlistUser(input);

    expect(result.email).toBe("test@example.com");
    expect(brevoMock.upsertBrevoContact).toHaveBeenCalledWith(expect.objectContaining({
      email: "test@example.com", attributes: expect.objectContaining({ SOURCE: "referral", WAITLIST: true }),
    }));
  });

  it("handles brevo sync failure gracefully", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([mockUser]);
    brevoMock.upsertBrevoContact.mockResolvedValue(false);

    const input: CreateWaitlistInput = { email: "test@example.com" };
    const result = await createOrUpdateWaitlistUser(input);

    expect(result.email).toBe("test@example.com");
    expect(result.brevoSyncedAt).toBeNull();
  });

  it("updates existing user on conflict", async () => {
    const updatedUser = { ...mockUser, firstName: "Jane", updatedAt: new Date() };
    prismaMock.$queryRaw.mockResolvedValueOnce([updatedUser]);
    brevoMock.upsertBrevoContact.mockResolvedValue(true);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...updatedUser, brevoSyncedAt: new Date() }]);

    const input: CreateWaitlistInput = { email: "test@example.com", firstName: "Jane" };
    const result = await createOrUpdateWaitlistUser(input);

    expect(result.firstName).toBe("Jane");
  });

  it("sanitizes input fields", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([mockUser]);
    brevoMock.upsertBrevoContact.mockResolvedValue(true);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...mockUser, brevoSyncedAt: new Date() }]);

    const input: CreateWaitlistInput = { email: "  Test@Example.COM  ", firstName: "  John  ", source: "  REFERRAL  " };
    await createOrUpdateWaitlistUser(input);

    expect(brevoMock.upsertBrevoContact).toHaveBeenCalledWith(expect.objectContaining({
      email: "test@example.com", attributes: expect.objectContaining({ SOURCE: "REFERRAL" }),
    }));
  });

  it("uses default source when not provided", async () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([mockUser]);
    brevoMock.upsertBrevoContact.mockResolvedValue(true);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...mockUser, brevoSyncedAt: new Date() }]);

    const input: CreateWaitlistInput = { email: "test@example.com" };
    await createOrUpdateWaitlistUser(input);

    expect(brevoMock.upsertBrevoContact).toHaveBeenCalledWith(expect.objectContaining({
      attributes: expect.objectContaining({ SOURCE: "landing_page" }),
    }));
  });

  it("handles null optional fields", async () => {
    const userWithNullNames = { ...mockUser, firstName: null, lastName: null };
    prismaMock.$queryRaw.mockResolvedValueOnce([userWithNullNames]);
    brevoMock.upsertBrevoContact.mockResolvedValue(true);
    prismaMock.$queryRaw.mockResolvedValueOnce([{ ...userWithNullNames, brevoSyncedAt: new Date() }]);

    const input: CreateWaitlistInput = { email: "test@example.com", firstName: "   ", lastName: "   " };
    const result = await createOrUpdateWaitlistUser(input);

    expect(result.firstName).toBeNull();
    expect(brevoMock.upsertBrevoContact).toHaveBeenCalledWith(expect.objectContaining({
      firstName: null, lastName: null,
    }));
  });
});

describe("getWaitlistStats", () => {
  it("returns total and recent7d counts", async () => {
    prismaMock.$queryRaw.mockResolvedValue([{ total: BigInt(100), recent7d: BigInt(15) }]);
    const result = await getWaitlistStats();
    expect(result.total).toBe(100);
    expect(result.recent7d).toBe(15);
  });

  it("handles empty result", async () => {
    prismaMock.$queryRaw.mockResolvedValue([]);
    const result = await getWaitlistStats();
    expect(result.total).toBe(0);
    expect(result.recent7d).toBe(0);
  });
});

describe("getWaitlistUsers", () => {
  it("returns all waitlist users ordered by createdAt", async () => {
    const users = [mockUser, { ...mockUser, id: "wl_2", email: "test2@example.com" }];
    prismaMock.$queryRaw.mockResolvedValue(users);
    const result = await getWaitlistUsers();
    expect(result).toHaveLength(2);
    expect(result[0].email).toBe("test@example.com");
  });
});

describe("getWaitlistUsersByIds", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("returns users matching provided IDs", async () => {
    const users = [{ ...mockUser, id: "wl_1" }];
    prismaMock.$queryRaw.mockResolvedValue(users);
    const result = await getWaitlistUsersByIds(["wl_1", "wl_2"]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("wl_1");
  });

  it("returns empty array for empty input", async () => {
    const result = await getWaitlistUsersByIds([]);
    expect(result).toEqual([]);
    expect(prismaMock.$queryRaw).not.toHaveBeenCalled();
  });
});

describe("markWaitlistUsersEmailed", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("updates lastEmailedAt for provided IDs", async () => {
    prismaMock.$executeRaw.mockResolvedValue(undefined);
    await markWaitlistUsersEmailed(["wl_1", "wl_2"]);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });

  it("does nothing for empty input", async () => {
    await markWaitlistUsersEmailed([]);
    expect(prismaMock.$executeRaw).not.toHaveBeenCalled();
  });
});
