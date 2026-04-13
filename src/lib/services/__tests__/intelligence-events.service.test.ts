/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => {
  const events: Array<{ type: string; title: string; assetId: string; date: Date }> = [];
  return {
    prismaMock: {
      institutionalEvent: {
        findMany: vi.fn(async ({ where }: { where: { assetId: string; date: { gte: Date } }; select: { type: boolean; title: boolean } }) => {
          return events
            .filter((e) => e.assetId === where.assetId && e.date >= where.date.gte)
            .map((e) => ({ type: e.type, title: e.title }));
        }),
        create: vi.fn(async ({ data }: { data: { assetId: string; type: string; title: string; description: string; severity: string; date: Date; metadata: unknown } }) => {
          const row = { assetId: data.assetId, type: data.type, title: data.title, date: data.date };
          events.push(row);
          return row;
        }),
        deleteMany: vi.fn(async () => ({ count: 0 })),
      },
      marketRegime: { deleteMany: vi.fn(async () => ({ count: 0 })) },
      trendingQuestion: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    },
    _events: events,
  };
});

vi.mock("@/lib/prisma", () => ({ directPrisma: prismaMock }));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { InputJsonValue: {} } }));
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/logger/utils", () => ({ createTimer: () => ({ endFormatted: () => "0ms" }) }));

import { IntelligenceEventsService } from "../intelligence-events.service";

const BASE_SIGNALS = { trend: { score: 50 }, momentum: { score: 50 }, volatility: { score: 50 }, liquidity: { score: 50 }, sentiment: { score: 50 }, trust: { score: 50 } };
const BASE_PROFILE = { value: 50, growth: 50, quality: 50, momentum: 50, size: 50, volatility: 50, lowVol: 50 };

describe("IntelligenceEventsService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("generateInstitutionalEvents", () => {
    it("creates Momentum Breakout when momentum > 80 and trend > 70", async () => {
      const signals = { ...BASE_SIGNALS, momentum: { score: 85 }, trend: { score: 75 } };
      await IntelligenceEventsService.generateInstitutionalEvents("asset_1", "BTC-USD", signals, BASE_PROFILE, {});
      expect(prismaMock.institutionalEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: "TECHNICAL", title: "Momentum Breakout", severity: "HIGH" }),
      }));
    });

    it("creates Value Mispricing when profile.value > 85", async () => {
      const profile = { ...BASE_PROFILE, value: 90 };
      await IntelligenceEventsService.generateInstitutionalEvents("asset_2", "ETH-USD", BASE_SIGNALS, profile, {});
      expect(prismaMock.institutionalEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: "FUNDAMENTAL", title: "Value Mispricing", severity: "MEDIUM" }),
      }));
    });

    it("creates Benchmark Shift when avg benchmark correlation < 0.3", async () => {
      const correlations = { "BTC-USD": 0.1, "ETH-USD": 0.2 };
      await IntelligenceEventsService.generateInstitutionalEvents("asset_3", "SOL-USD", BASE_SIGNALS, BASE_PROFILE, correlations);
      expect(prismaMock.institutionalEvent.create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ type: "MARKET", title: "Benchmark Shift", severity: "LOW" }),
      }));
    });

    it("deduplicates events by checking existing keys for the day", async () => {
      const signals = { ...BASE_SIGNALS, momentum: { score: 85 }, trend: { score: 75 } };
      await IntelligenceEventsService.generateInstitutionalEvents("asset_4", "BTC-USD", signals, BASE_PROFILE, {});
      expect(prismaMock.institutionalEvent.create).toHaveBeenCalledTimes(1);
      const created = prismaMock.institutionalEvent.create.mock.calls[0][0] as { data: { type: string; title: string } };
      
      prismaMock.institutionalEvent.findMany.mockResolvedValueOnce([{ type: created.data.type, title: created.data.title }]);
      await IntelligenceEventsService.generateInstitutionalEvents("asset_4", "BTC-USD", signals, BASE_PROFILE, {});
      expect(prismaMock.institutionalEvent.create).toHaveBeenCalledTimes(1);
    });

    it("does not create events when thresholds are not met", async () => {
      await IntelligenceEventsService.generateInstitutionalEvents("asset_5", "ADA-USD", BASE_SIGNALS, BASE_PROFILE, {});
      expect(prismaMock.institutionalEvent.create).not.toHaveBeenCalled();
    });

    it("includes bullish metadata for momentum breakout", async () => {
      const signals = { ...BASE_SIGNALS, momentum: { score: 85 }, trend: { score: 75 } };
      await IntelligenceEventsService.generateInstitutionalEvents("asset_6", "BTC-USD", signals, BASE_PROFILE, {});
      const call = prismaMock.institutionalEvent.create.mock.calls[0][0] as { data: { metadata: { sentiment: string; momentum: number; trend: number } } };
      expect(call.data.metadata.sentiment).toBe("bullish");
      expect(call.data.metadata.momentum).toBe(85);
      expect(call.data.metadata.trend).toBe(75);
    });
  });

  describe("pruneStaleData", () => {
    it("deletes NEWS/MARKET/TECHNICAL events older than 48 hours", async () => {
      await IntelligenceEventsService.pruneStaleData();
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "NEWS", date: expect.objectContaining({ lt: expect.any(Date) }) } })
      );
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "MARKET", date: expect.any(Object) } })
      );
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "TECHNICAL", date: expect.any(Object) } })
      );
    });

    it("deletes INSIDER/ANALYST events older than 7 days", async () => {
      await IntelligenceEventsService.pruneStaleData();
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "INSIDER", date: expect.any(Object) } })
      );
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "ANALYST", date: expect.any(Object) } })
      );
    });

    it("deletes PROTOCOL events older than 30 days", async () => {
      await IntelligenceEventsService.pruneStaleData();
      expect(prismaMock.institutionalEvent.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { type: "PROTOCOL", date: expect.any(Object) } })
      );
    });

    it("deletes marketRegime entries older than 90 days", async () => {
      await IntelligenceEventsService.pruneStaleData();
      expect(prismaMock.marketRegime.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { date: expect.any(Object) } })
      );
    });

    it("deletes inactive trending questions", async () => {
      await IntelligenceEventsService.pruneStaleData();
      expect(prismaMock.trendingQuestion.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: false } })
      );
    });

    it("swallows errors without throwing", async () => {
      prismaMock.institutionalEvent.deleteMany.mockRejectedValue(new Error("DB error"));
      await expect(IntelligenceEventsService.pruneStaleData()).resolves.not.toThrow();
    });
  });
});
