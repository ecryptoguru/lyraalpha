# Administrative Tools

<cite>
**Referenced Files in This Document**
- [layout.tsx](file://src/app/admin/layout.tsx)
- [AdminLayoutClient.tsx](file://src/app/admin/AdminLayoutClient.tsx)
- [page.tsx](file://src/app/admin/page.tsx)
- [overview-chart.tsx](file://src/app/admin/_charts/overview-chart.tsx)
- [engines-charts.tsx](file://src/app/admin/_charts/engines-charts.tsx)
- [usage-charts.tsx](file://src/app/admin/_charts/usage-charts.tsx)
- [users-growth/page.tsx](file://src/app/admin/users-growth/page.tsx)
- [revenue/page.tsx](file://src/app/admin/revenue/page.tsx)
</cite>

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document describes the Administrative Tools suite that powers analytics dashboards, user management, revenue tracking, support administration, and system monitoring. It explains admin analytics charts, user growth metrics, billing analytics, and support ticket management. It also documents administrative workflows, user diagnostics, system health monitoring, and operational reporting. Permissions, audit trails, and system maintenance tools are covered, with examples of administrative tasks, data visualizations, and operational management workflows.

## Project Structure
The Admin Console is a Next.js app router-based area under /admin with:
- A server-side guard that enforces admin-only access
- A client-side layout with navigation groups for Analytics, Operations, and Infrastructure
- Dedicated pages for Overview, Users & Growth, Revenue, Usage, AI Costs, Credits, Billing, Support, Engines & Regime, Crypto Data, AI Limits, and Waitlist
- Shared chart components for plan distribution, engine scores, compatibility, usage, and more

```mermaid
graph TB
subgraph "Admin Console"
L["Server Guard<br/>requireAdmin()"]
C["Client Layout<br/>AdminLayoutClient"]
O["Overview Page"]
UG["Users & Growth Page"]
R["Revenue Page"]
UC["Charts<br/>overview-chart.tsx<br/>engines-charts.tsx<br/>usage-charts.tsx"]
end
L --> C
C --> O
C --> UG
C --> R
O --> UC
```

**Diagram sources**
- [layout.tsx:1-13](file://src/app/admin/layout.tsx#L1-L13)
- [AdminLayoutClient.tsx:1-189](file://src/app/admin/AdminLayoutClient.tsx#L1-L189)
- [page.tsx:1-353](file://src/app/admin/page.tsx#L1-L353)
- [users-growth/page.tsx:1-455](file://src/app/admin/users-growth/page.tsx#L1-L455)
- [revenue/page.tsx:1-383](file://src/app/admin/revenue/page.tsx#L1-L383)
- [overview-chart.tsx:1-37](file://src/app/admin/_charts/overview-chart.tsx#L1-L37)
- [engines-charts.tsx:1-50](file://src/app/admin/_charts/engines-charts.tsx#L1-L50)
- [usage-charts.tsx:1-114](file://src/app/admin/_charts/usage-charts.tsx#L1-L114)

**Section sources**
- [layout.tsx:1-13](file://src/app/admin/layout.tsx#L1-L13)
- [AdminLayoutClient.tsx:27-51](file://src/app/admin/AdminLayoutClient.tsx#L27-L51)

## Core Components
- Admin server guard ensures only authorized administrators can access the console.
- Admin client layout organizes navigation into Analytics and Operations sections with icons and active-state highlighting.
- Overview page aggregates revenue, user, and AI activity KPIs and displays plan distribution visuals.
- Users & Growth page provides user listing, filtering, onboarding funnels, retention proxies, and signup trends.
- Revenue page presents MRR/ARR, ARPU, subscription status, credit activity, churn, refunds, and recent payment events.
- Shared chart components encapsulate reusable visualizations for pie/bar/line charts and tooltips.

**Section sources**
- [layout.tsx:5-12](file://src/app/admin/layout.tsx#L5-L12)
- [AdminLayoutClient.tsx:27-51](file://src/app/admin/AdminLayoutClient.tsx#L27-L51)
- [page.tsx:166-272](file://src/app/admin/page.tsx#L166-L272)
- [users-growth/page.tsx:434-454](file://src/app/admin/users-growth/page.tsx#L434-L454)
- [revenue/page.tsx:57-91](file://src/app/admin/revenue/page.tsx#L57-L91)

## Architecture Overview
The Admin Console follows a client-server split:
- Server guard redirects unauthorized users to the dashboard.
- Client layout renders persistent navigation and active-link highlighting.
- Pages fetch data via hooks and render charts using Recharts.
- Charts are dynamically imported to avoid SSR overhead.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Server as "Admin Server Guard"
participant Layout as "AdminLayoutClient"
participant Page as "Admin Page"
Browser->>Server : "GET /admin"
Server->>Server : "requireAdmin()"
alt Authorized
Server-->>Browser : "200 OK"
Browser->>Layout : "Render layout"
Layout->>Page : "Render active page"
else Unauthorized
Server-->>Browser : "302 Redirect to /dashboard"
end
```

**Diagram sources**
- [layout.tsx:5-12](file://src/app/admin/layout.tsx#L5-L12)
- [AdminLayoutClient.tsx:53-128](file://src/app/admin/AdminLayoutClient.tsx#L53-L128)

## Detailed Component Analysis

### Admin Server Guard
- Enforces admin-only access by checking credentials and redirecting non-admins to the dashboard.
- Ensures that only users with appropriate roles can enter the Admin Console.

**Section sources**
- [layout.tsx:5-12](file://src/app/admin/layout.tsx#L5-L12)

### Admin Client Layout
- Provides two-level navigation groups: Analytics and Operations.
- Highlights active nav items based on current pathname.
- Supports desktop and mobile layouts with a collapsible menu.

```mermaid
flowchart TD
Start(["Load AdminLayoutClient"]) --> GetPath["Read pathname"]
GetPath --> BuildNav["Build NAV_GROUPS"]
BuildNav --> RenderDesktop["Render desktop sidebar"]
BuildNav --> RenderMobile["Render mobile overlay"]
RenderDesktop --> ActiveState["Compute active item"]
RenderMobile --> ActiveState
ActiveState --> End(["Render children"])
```

**Diagram sources**
- [AdminLayoutClient.tsx:53-128](file://src/app/admin/AdminLayoutClient.tsx#L53-L128)

**Section sources**
- [AdminLayoutClient.tsx:27-51](file://src/app/admin/AdminLayoutClient.tsx#L27-L51)
- [AdminLayoutClient.tsx:53-128](file://src/app/admin/AdminLayoutClient.tsx#L53-L128)

### Overview Page
- Displays KPIs for Revenue (MRR, ARR, active subscriptions, conversion rate), Users (total, new signups, AI requests per user), and AI activity (today’s requests, spend, 7-day totals).
- Renders plan distribution as a pie chart and a plan-mix breakdown.
- Shows platform health summary in a compact stats grid.

```mermaid
graph TB
O["Overview Page"]
Hook["useAdminOverview()"]
OpsHook["useAdminAIOps()"]
Chart["PlanDistributionChart"]
O --> Hook
O --> OpsHook
O --> Chart
```

**Diagram sources**
- [page.tsx:94-130](file://src/app/admin/page.tsx#L94-L130)
- [overview-chart.tsx:12-36](file://src/app/admin/_charts/overview-chart.tsx#L12-L36)

**Section sources**
- [page.tsx:166-272](file://src/app/admin/page.tsx#L166-L272)
- [overview-chart.tsx:12-36](file://src/app/admin/_charts/overview-chart.tsx#L12-L36)

### Users & Growth Page
- Tabs:
  - Users: paginated table with filters by plan and search; shows user attributes and counts.
  - Growth: retention proxies (DAU/WAU/MAU), onboarding funnel, viral metrics (referrals, K-factor), and signup trends.
- Uses Recharts for bar/line charts and funnel bars with percentage bars.

```mermaid
sequenceDiagram
participant Admin as "Admin"
participant UsersTab as "Users Tab"
participant GrowthTab as "Growth Tab"
participant Hooks as "useAdminUsers / useAdminGrowthRange"
Admin->>UsersTab : "Switch to Users"
UsersTab->>Hooks : "Fetch users (page, pageSize)"
Hooks-->>UsersTab : "Users + totalCount + planBreakdown"
Admin->>GrowthTab : "Switch to Growth"
GrowthTab->>Hooks : "Fetch growth range (period)"
Hooks-->>GrowthTab : "Funnel, retention, viral, signups"
```

**Diagram sources**
- [users-growth/page.tsx:97-101](file://src/app/admin/users-growth/page.tsx#L97-L101)
- [users-growth/page.tsx:256-258](file://src/app/admin/users-growth/page.tsx#L256-L258)

**Section sources**
- [users-growth/page.tsx:434-454](file://src/app/admin/users-growth/page.tsx#L434-L454)
- [users-growth/page.tsx:256-431](file://src/app/admin/users-growth/page.tsx#L256-L431)

### Revenue Page
- Displays subscription-derived KPIs (MRR, ARR, ARPU, active subscriptions).
- Shows credit activity, churn, past-due subscriptions, and refunds with recent refund table.
- Visualizes plan distribution by subscriptions and revenue, subscription status pie, and user growth by month.
- Includes a plan revenue detail table and recent payment events.

```mermaid
graph TB
RP["Revenue Page"]
RH["useAdminRevenue()"]
CH["useAdminCredits()"]
Charts["Charts<br/>Bar/Pie/Line"]
RP --> RH
RP --> CH
RP --> Charts
```

**Diagram sources**
- [revenue/page.tsx:57-64](file://src/app/admin/revenue/page.tsx#L57-L64)
- [revenue/page.tsx:222-302](file://src/app/admin/revenue/page.tsx#L222-L302)

**Section sources**
- [revenue/page.tsx:57-91](file://src/app/admin/revenue/page.tsx#L57-L91)
- [revenue/page.tsx:222-383](file://src/app/admin/revenue/page.tsx#L222-L383)

### Shared Chart Components
- PlanDistributionChart: pie chart for plan distribution with tooltips and legend.
- EngineScoreChart and CompatibilityChart: bar charts for engine scores and asset compatibility.
- AssetTypeChart, RegionChart, PlanChart, DailyViewsChart, SectionBarChart, MyraUsageChart: reusable Recharts components for usage analytics.

```mermaid
classDiagram
class PlanDistributionChart {
+props data
+render()
}
class EngineScoreChart {
+props data
+render()
}
class CompatibilityChart {
+props data
+render()
}
class AssetTypeChart
class RegionChart
class PlanChart
class DailyViewsChart
class SectionBarChart
class MyraUsageChart
```

**Diagram sources**
- [overview-chart.tsx:12-36](file://src/app/admin/_charts/overview-chart.tsx#L12-L36)
- [engines-charts.tsx:15-49](file://src/app/admin/_charts/engines-charts.tsx#L15-L49)
- [usage-charts.tsx:20-113](file://src/app/admin/_charts/usage-charts.tsx#L20-L113)

**Section sources**
- [overview-chart.tsx:12-36](file://src/app/admin/_charts/overview-chart.tsx#L12-L36)
- [engines-charts.tsx:15-49](file://src/app/admin/_charts/engines-charts.tsx#L15-L49)
- [usage-charts.tsx:20-113](file://src/app/admin/_charts/usage-charts.tsx#L20-L113)

## Dependency Analysis
- AdminLayoutClient depends on Lucide icons and Next.js routing to compute active nav items.
- Overview page depends on useAdminOverview and useAdminAIOps hooks and dynamically imports chart components.
- Users & Growth page depends on useAdminUsers and useAdminGrowthRange hooks and Recharts for visualization.
- Revenue page depends on useAdminRevenue and useAdminCredits hooks and Recharts for charts and tables.

```mermaid
graph LR
AdminLayoutClient["AdminLayoutClient.tsx"] --> Icons["Lucide Icons"]
AdminLayoutClient --> NextRouting["Next Navigation"]
Overview["admin/page.tsx"] --> HooksA["useAdminOverview"]
Overview --> HooksB["useAdminAIOps"]
Overview --> Charts["overview-chart.tsx"]
UsersGrowth["users-growth/page.tsx"] --> HooksUG["useAdminUsers / useAdminGrowthRange"]
UsersGrowth --> Recharts["Recharts"]
Revenue["revenue/page.tsx"] --> HooksRev["useAdminRevenue / useAdminCredits"]
Revenue --> Recharts
```

**Diagram sources**
- [AdminLayoutClient.tsx:7-25](file://src/app/admin/AdminLayoutClient.tsx#L7-L25)
- [page.tsx:4-26](file://src/app/admin/page.tsx#L4-L26)
- [users-growth/page.tsx:4-29](file://src/app/admin/users-growth/page.tsx#L4-L29)
- [revenue/page.tsx:4-19](file://src/app/admin/revenue/page.tsx#L4-L19)

**Section sources**
- [AdminLayoutClient.tsx:53-128](file://src/app/admin/AdminLayoutClient.tsx#L53-L128)
- [page.tsx:94-130](file://src/app/admin/page.tsx#L94-L130)
- [users-growth/page.tsx:97-101](file://src/app/admin/users-growth/page.tsx#L97-L101)
- [revenue/page.tsx:57-64](file://src/app/admin/revenue/page.tsx#L57-L64)

## Performance Considerations
- Dynamic imports of chart components reduce initial bundle size and avoid SSR rendering for heavy visualizations.
- Recharts components are responsive and optimized for small screens; ensure datasets are trimmed for long time-series.
- Pagination in the Users tab reduces payload sizes and improves responsiveness for large user lists.
- Avoid unnecessary re-renders by memoizing computed values (e.g., percentages and color accents) in overview and revenue pages.

## Troubleshooting Guide
- Access denied: If redirected to the dashboard, verify that the user has the required admin role in the identity provider.
- Data loading errors: Pages show explicit error states with actionable messages; check network tab and backend logs for hook failures.
- Empty charts: Ensure datasets are non-empty; many charts render a “no data” message when arrays are empty.
- Mobile navigation: Toggle the mobile menu icon to reveal navigation items on smaller screens.

**Section sources**
- [layout.tsx:7-12](file://src/app/admin/layout.tsx#L7-L12)
- [page.tsx:116-127](file://src/app/admin/page.tsx#L116-L127)
- [users-growth/page.tsx:103-105](file://src/app/admin/users-growth/page.tsx#L103-L105)
- [revenue/page.tsx:61-63](file://src/app/admin/revenue/page.tsx#L61-L63)

## Conclusion
The Administrative Tools provide a comprehensive, permission-protected interface for monitoring platform health, managing users, tracking revenue, and operating systems. The modular layout, reusable charts, and structured pages enable efficient operational workflows, while dynamic imports and pagination keep performance strong. Administrators can rely on clear KPIs, visualizations, and tables to drive decisions and maintain system integrity.