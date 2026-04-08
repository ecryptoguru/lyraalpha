/**
 * Global Vitest setup — runs before every test file.
 *
 * Purpose: prevent native Node addons (pg, @prisma/adapter-pg) from loading
 * in fork workers on Node v24, which causes segfaults / OOM crashes.
 * All DB interactions are mocked per-test via vi.mock("@/lib/prisma").
 */
import { vi } from "vitest";

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn().mockImplementation(() => ({})),
}));

vi.mock("pg", () => ({
  default: { Pool: vi.fn() },
  Pool: vi.fn(),
  Client: vi.fn(),
}));
