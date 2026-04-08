/**
 * @vitest-environment node
 *
 * Tests for rate-limit/config.ts — factory-generated rate limiters from config (H4).
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/redis", () => ({
  redis: {
    evalsha: vi.fn(),
    eval: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    incr: vi.fn(),
    script: vi.fn(),
    multi: vi.fn().mockReturnValue({ exec: vi.fn() }),
  },
}));

import {
  chatDailyBurstRateLimiter,
  chatMonthlyCapRateLimiter,
  discoveryRateLimiter,
  marketDataRateLimiter,
  generalRateLimiter,
  RATE_LIMIT_CONFIG,
} from "../config";

const TIERS = ["STARTER", "PRO", "ELITE", "ENTERPRISE"] as const;

describe("Rate Limit Config", () => {
  describe("RATE_LIMIT_CONFIG structure", () => {
    it("has all expected endpoint types", () => {
      expect(Object.keys(RATE_LIMIT_CONFIG)).toEqual(
        expect.arrayContaining([
          "chatDailyBurst",
          "chatMonthlyCap",
          "discovery",
          "marketdata",
          "general",
        ])
      );
    });

    it("has all 4 tiers for each endpoint", () => {
      for (const endpoint of Object.keys(RATE_LIMIT_CONFIG) as (keyof typeof RATE_LIMIT_CONFIG)[]) {
        for (const tier of TIERS) {
          expect(RATE_LIMIT_CONFIG[endpoint][tier]).toBeDefined();
          expect(RATE_LIMIT_CONFIG[endpoint][tier].requests).toBeGreaterThan(0);
          expect(RATE_LIMIT_CONFIG[endpoint][tier].window).toMatch(/^\d+[smhd]$/);
        }
      }
    });

    it("ENTERPRISE windows match ELITE windows", () => {
      for (const endpoint of Object.keys(RATE_LIMIT_CONFIG) as (keyof typeof RATE_LIMIT_CONFIG)[]) {
        expect(RATE_LIMIT_CONFIG[endpoint].ENTERPRISE.window).toBe(
          RATE_LIMIT_CONFIG[endpoint].ELITE.window,
        );
      }
    });

    it("ENTERPRISE request limits are 4x ELITE for endpoints designed for 4x scaling", () => {
      const endpoints4x: Array<keyof typeof RATE_LIMIT_CONFIG> = [
        "chatDailyBurst",
        "discovery",
        "marketdata",
        "general",
      ];

      for (const endpoint of endpoints4x) {
        expect(RATE_LIMIT_CONFIG[endpoint].ENTERPRISE.requests).toBe(
          RATE_LIMIT_CONFIG[endpoint].ELITE.requests * 4,
        );
      }
    });

    it("higher tiers have >= requests than lower tiers", () => {
      for (const endpoint of Object.keys(RATE_LIMIT_CONFIG) as (keyof typeof RATE_LIMIT_CONFIG)[]) {
        expect(RATE_LIMIT_CONFIG[endpoint].PRO.requests).toBeGreaterThanOrEqual(
          RATE_LIMIT_CONFIG[endpoint].STARTER.requests
        );
        expect(RATE_LIMIT_CONFIG[endpoint].ELITE.requests).toBeGreaterThanOrEqual(
          RATE_LIMIT_CONFIG[endpoint].PRO.requests
        );
      }
    });
  });

  describe("Factory-generated rate limiters", () => {
    it("chatDailyBurstRateLimiter has all tiers", () => {
      for (const tier of TIERS) {
        expect(chatDailyBurstRateLimiter[tier]).toBeDefined();
        expect(typeof chatDailyBurstRateLimiter[tier].limit).toBe("function");
      }
    });

    it("chatMonthlyCapRateLimiter has all tiers", () => {
      for (const tier of TIERS) {
        expect(chatMonthlyCapRateLimiter[tier]).toBeDefined();
        expect(typeof chatMonthlyCapRateLimiter[tier].limit).toBe("function");
      }
    });

    it("discoveryRateLimiter has all tiers", () => {
      for (const tier of TIERS) {
        expect(discoveryRateLimiter[tier]).toBeDefined();
        expect(typeof discoveryRateLimiter[tier].limit).toBe("function");
      }
    });

    it("marketDataRateLimiter has all tiers", () => {
      for (const tier of TIERS) {
        expect(marketDataRateLimiter[tier]).toBeDefined();
        expect(typeof marketDataRateLimiter[tier].limit).toBe("function");
      }
    });

    it("generalRateLimiter has all tiers", () => {
      for (const tier of TIERS) {
        expect(generalRateLimiter[tier]).toBeDefined();
        expect(typeof generalRateLimiter[tier].limit).toBe("function");
      }
    });
  });
});
