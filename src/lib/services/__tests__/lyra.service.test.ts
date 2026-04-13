/**
 * @vitest-environment node
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, openaiMock, configMock } = vi.hoisted(() => ({
  prismaMock: { assetSector: { findUnique: vi.fn() } },
  openaiMock: { chat: { completions: { create: vi.fn() } } },
  configMock: { getAzureOpenAIApiKey: vi.fn(() => "test-key"), getAzureOpenAIBaseURL: vi.fn(() => "https://test.openai.azure.com"), getGpt54Deployment: vi.fn(() => "gpt-4") },
}));

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/ai/config", () => configMock);
vi.mock("@/lib/logger", () => ({ createLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }) }));
vi.mock("@/lib/logger/utils", () => ({ sanitizeError: (e: unknown) => String(e) }));
vi.mock("openai", () => ({ default: vi.fn(() => openaiMock) }));

import { LyraService } from "../lyra.service";

const mockMapping = {
  assetId: "asset_1", sectorId: "sector_1", relevanceScore: 85, freshnessScore: 90, strengthScore: 80, densityScore: 75, behaviorScore: 88,
  inclusionReason: "Strong technical signals",
  asset: { id: "asset_1", name: "Bitcoin", symbol: "BTC-USD", scores: [{ type: "TREND", value: 85 }, { type: "MOMENTUM", value: 90 }] },
  sector: { id: "sector_1", name: "Digital Assets" },
};

describe("LyraService", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe("explainInclusion", () => {
    it("generates explanation successfully", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue(mockMapping);
      openaiMock.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Bitcoin is included due to strong technical momentum and sector alignment." } }],
      });

      const result = await LyraService.explainInclusion("asset_1", "sector_1");

      expect(result).toContain("strong technical");
      expect(prismaMock.assetSector.findUnique).toHaveBeenCalledWith(expect.objectContaining({
        where: { assetId_sectorId: { assetId: "asset_1", sectorId: "sector_1" } },
      }));
    });

    it("returns fallback message on API error", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue(mockMapping);
      openaiMock.chat.completions.create.mockRejectedValue(new Error("API error"));

      const result = await LyraService.explainInclusion("asset_1", "sector_1");

      expect(result).toBe("An explanation is currently unavailable for this inclusion.");
    });

    it("returns fallback message when mapping not found", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue(null);

      const result = await LyraService.explainInclusion("unknown", "sector_1");
      expect(result).toBe("An explanation is currently unavailable for this inclusion.");
    });

    it("aggregates institutional signals from scores", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue({
        ...mockMapping,
        asset: { ...mockMapping.asset, scores: [{ type: "TREND", value: 75 }, { type: "MOMENTUM", value: 80 }, { type: "SENTIMENT", value: 70 }] },
      });
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "Explanation" } }] });

      await LyraService.explainInclusion("asset_1", "sector_1");

      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
        messages: expect.arrayContaining([expect.objectContaining({ role: "user" })]),
      }));
    });

    it("uses correct prompt and system message", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue(mockMapping);
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "Explanation" } }] });

      await LyraService.explainInclusion("asset_1", "sector_1");

      expect(openaiMock.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
        model: "gpt-4", max_tokens: 600,
        messages: [
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ],
      }));
    });

    it("handles missing scores gracefully", async () => {
      prismaMock.assetSector.findUnique.mockResolvedValue({ ...mockMapping, asset: { ...mockMapping.asset, scores: [] } });
      openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: "Explanation" } }] });

      const result = await LyraService.explainInclusion("asset_1", "sector_1");

      expect(result).toBe("Explanation");
    });
  });
});
