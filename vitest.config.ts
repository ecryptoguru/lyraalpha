import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Intercept heavy native packages before module graph resolution.
      // This prevents Prisma WASM/native binary from loading in test workers.
      // Tests that need real Prisma behavior use vi.mock("@/lib/prisma") per-file.
      {
        find: /^@prisma\/adapter-pg$/,
        replacement: path.resolve(__dirname, "src/__mocks__/prisma-adapter-pg.ts"),
      },
      {
        find: /^@\/generated\/prisma\/client$/,
        replacement: path.resolve(__dirname, "src/__mocks__/prisma-client-pkg.ts"),
      },
      {
        find: /^ioredis$/,
        replacement: path.resolve(__dirname, "src/__mocks__/ioredis.ts"),
      },
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  test: {
    // Use node by default — faster, no jsdom OOM on large suites.
    // Tests that need browser APIs declare: /** @vitest-environment jsdom */
    environment: "node",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    include: ["src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["e2e/**/*", "node_modules/**/*"],
    pool: "forks",
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
      },
    },
    testTimeout: 30000,
  },
});
