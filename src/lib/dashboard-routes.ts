export type DashboardRouteSection = "Main" | "Settings";

export type DashboardRouteKey =
  | "dashboard"
  | "macro"
  | "lyra"
  | "portfolio"
  | "discovery"
  | "narratives"
  | "compare"
  | "timeline"
  | "watchlist"
  | "learning"
  | "settings"
  | "assets"
  | "stress-test"
  | "rewards"
  | "admin"
  | "upgrade";

export interface DashboardRouteMeta {
  key: DashboardRouteKey;
  title: string;
  url: string;
  section: DashboardRouteSection;
  /** Show in sidebar navigation */
  navOnly?: boolean;
  eliteOnly?: boolean;
  adminOnly?: boolean;
  detailSegmentFormatter?: (segment: string) => string;
}

const formatTitleWords = (segment: string) =>
  decodeURIComponent(segment)
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const formatUppercase = (segment: string) => decodeURIComponent(segment).toUpperCase();

export const DASHBOARD_ROUTES: DashboardRouteMeta[] = [
  // ── Main nav (flat, ordered by usage frequency) ──────────────────────────
  { key: "dashboard",  title: "Home",             url: "/dashboard",             section: "Main",     navOnly: true },
  { key: "lyra",       title: "Ask Lyra",          url: "/dashboard/lyra",        section: "Main",     navOnly: true },
  { key: "macro",      title: "Research",          url: "/dashboard/macro",       section: "Main",     navOnly: true },
  { key: "assets",     title: "Asset Intel",      url: "/dashboard/assets",      section: "Main",     navOnly: true, detailSegmentFormatter: formatUppercase },
  { key: "portfolio",  title: "Portfolio Intel",   url: "/dashboard/portfolio",   section: "Main",     navOnly: true },
  { key: "discovery",  title: "Multibagger Radar", url: "/dashboard/discovery",   section: "Main",     navOnly: true, detailSegmentFormatter: formatTitleWords },
  { key: "compare",    title: "Compare Assets",    url: "/dashboard/compare",     section: "Main",     navOnly: true, eliteOnly: true },
  { key: "timeline",   title: "Market Events",     url: "/dashboard/timeline",    section: "Main",     navOnly: true },
  { key: "watchlist",  title: "Watchlist",         url: "/dashboard/watchlist",   section: "Main",     navOnly: true },
  // ── Settings (divider in sidebar) ────────────────────────────────────────
  { key: "settings",   title: "Settings",          url: "/dashboard/settings",    section: "Settings", navOnly: true },
  { key: "learning",   title: "Learning Hub",      url: "/dashboard/learning",    section: "Settings", navOnly: true, detailSegmentFormatter: formatTitleWords },

  // ── Not in main nav (breadcrumb/redirect pages only) ─────────────────────
  { key: "stress-test",      title: "Shock Test",   url: "/dashboard/stress-test",      section: "Main",     eliteOnly: true },
  { key: "rewards",          title: "Credits & XP", url: "/dashboard/rewards",          section: "Settings" },
  { key: "admin",            title: "Admin",        url: "/admin",                      section: "Settings", adminOnly: true },
];

export function getSidebarSections() {
  return DASHBOARD_ROUTES.filter((route) => route.navOnly).reduce<
    Array<{ label: DashboardRouteSection; items: DashboardRouteMeta[] }>
  >((sections, route) => {
    const existingSection = sections.find((section) => section.label === route.section);
    if (existingSection) {
      existingSection.items.push(route);
      return sections;
    }
    sections.push({ label: route.section, items: [route] });
    return sections;
  }, []);
}

export function getDashboardBreadcrumbSegments(pathname: string) {
  const route = DASHBOARD_ROUTES.find((item) => item.url === "/dashboard"
    ? pathname === item.url
    : pathname === item.url || pathname.startsWith(`${item.url}/`));

  if (!route || route.url === "/dashboard") return [];

  const segments = [{ label: route.title, href: route.url }];
  const parts = pathname.split("/");
  if (parts.length > 3 && parts[3] && route.detailSegmentFormatter) {
    segments.push({ label: route.detailSegmentFormatter(parts[3]), href: pathname });
  }

  return segments;
}
