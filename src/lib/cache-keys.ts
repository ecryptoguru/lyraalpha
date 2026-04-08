export function personalBriefingCacheKey(userId: string): string {
  return `lyra:personal-briefing:${userId}`;
}

export function dashboardHomeCacheKey(userId: string, region: string, plan: string): string {
  return `dashboard:home:${userId}:${region}:${plan}`;
}

export function dashboardHomeShellCacheKey(userId: string, region: string, plan: string): string {
  return `dashboard:home:shell:${userId}:${region}:${plan}`;
}

export function dashboardHomeCachePrefix(userId: string): string {
  return `dashboard:home:${userId}:`;
}

export function portfolioHealthCacheKey(portfolioId: string): string {
  return `portfolio:health:${portfolioId}`;
}

export function portfolioAnalyticsCacheKey(portfolioId: string): string {
  return `portfolio:analytics:${portfolioId}`;
}

export function macroResearchCacheKey(region: string): string {
  return `macro:research:${region}`;
}

export function macroResearchSectorCacheKey(region: string): string {
  return `macro:research:sectors:${region}`;
}

export function macroResearchCachePrefix(): string {
  return `macro:research:`;
}
