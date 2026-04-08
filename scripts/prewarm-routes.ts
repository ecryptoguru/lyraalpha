const routes = [
  "/dashboard",
  "/dashboard/assets",
  "/dashboard/assets/AAPL",
  "/dashboard/discovery",
  "/dashboard/discovery-stocks",
  "/dashboard/lyra",
  "/api/market/regime-multi-horizon",
  "/api/stocks/movers?region=US",
  "/api/discovery/feed?region=US&limit=20&offset=0&type=all",
  "/api/stocks/AAPL/analytics?region=US",
  "/api/lyra/history",
];

const baseUrl = process.env.WARMUP_ORIGIN || "http://localhost:3000";
const rounds = Number(process.env.WARMUP_ROUNDS || "2");

async function warmRoute(path: string) {
  const startedAt = performance.now();
  const response = await fetch(`${baseUrl}${path}`);
  await response.text();
  const elapsed = Math.round(performance.now() - startedAt);
  return { path, status: response.status, elapsed };
}

async function run() {
  console.log(`Prewarming ${routes.length} routes against ${baseUrl} for ${rounds} round(s)`);

  for (let round = 1; round <= rounds; round++) {
    console.log(`\nRound ${round}`);
    for (const route of routes) {
      try {
        const result = await warmRoute(route);
        console.log(`${result.path} -> ${result.elapsed}ms (status ${result.status})`);
      } catch (error) {
        console.error(`${route} -> failed`, error);
      }
    }
  }
}

run().catch((error) => {
  console.error("Warmup failed", error);
  process.exit(1);
});
