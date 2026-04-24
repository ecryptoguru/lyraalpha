# Portfolio Management

<cite>
**Referenced Files in This Document**
- [src/app/api/portfolio/route.ts](file://src/app/api/portfolio/route.ts)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts)
- [src/app/api/stocks/stress-test/route.ts](file://src/app/api/stocks/stress-test/route.ts)
- [src/app/dashboard/portfolio/page.tsx](file://src/app/dashboard/portfolio/page.tsx)
- [src/app/dashboard/stress-test/page.tsx](file://src/app/dashboard/stress-test/page.tsx)
- [src/lib/services/portfolio.service.ts](file://src/lib/services/portfolio.service.ts)
- [src/hooks/use-portfolio.ts](file://src/hooks/use-portfolio.ts)
- [src/hooks/use-portfolio-health.ts](file://src/hooks/use-portfolio-health.ts)
- [src/components/portfolio/portfolio-health-meter.tsx](file://src/components/portfolio/portfolio-health-meter.tsx)
- [src/components/portfolio/portfolio-fragility-card.tsx](file://src/components/portfolio/portfolio-fragility-card.tsx)
- [src/components/portfolio/portfolio-monte-carlo-card.tsx](file://src/components/portfolio/portfolio-monte-carlo-card.tsx)
- [src/components/portfolio/portfolio-holdings-table.tsx](file://src/components/portfolio/portfolio-holdings-table.tsx)
- [src/components/portfolio/portfolio-intelligence-hero.tsx](file://src/components/portfolio/portfolio-intelligence-hero.tsx)
- [src/components/dashboard/correlation-stress-card.tsx](file://src/components/dashboard/correlation-stress-card.tsx)
- [src/lib/engines/portfolio-health.ts](file://src/lib/engines/portfolio-health.ts)
- [src/lib/engines/portfolio-monte-carlo.ts](file://src/lib/engines/portfolio-monte-carlo.ts)
- [src/lib/engines/portfolio-fragility.ts](file://src/lib/engines/portfolio-fragility.ts)
- [src/lib/stress-scenarios/types.ts](file://src/lib/stress-scenarios/types.ts)
- [src/lib/stress-scenarios/index.ts](file://src/lib/stress-scenarios/index.ts)
- [src/lib/stress-scenarios/stress-test-utils.ts](file://src/lib/stress-scenarios/stress-test-utils.ts)
- [src/lib/stress-scenarios/stress-test-utils.test.ts](file://src/lib/stress-scenarios/stress-test-utils.test.ts)
- [src/lib/portfolio-alerts.ts](file://src/lib/portfolio-alerts.ts)
</cite>

## Update Summary
**Changes Made**
- Added comprehensive stress testing functionality with historical scenario analysis
- Enhanced Monte Carlo simulation with stress injection modes
- Improved portfolio fragility analysis with new components and drivers
- Integrated correlation stress monitoring for market-wide risk assessment
- Added 114 lines of new stress testing test coverage validating mathematical properties and edge cases

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
10. [Appendices](#appendices)

## Introduction
This document explains the Portfolio Management capabilities implemented in the codebase. It covers portfolio creation and lifecycle, health monitoring, risk assessment, Monte Carlo simulations, fragility analysis, stress testing, real-time health metrics, alerts, drift detection, benchmark comparisons, performance analytics, optimization workflows, scenario analysis, and risk visualization. The system now includes comprehensive stress testing functionality with historical scenario analysis, enhanced Monte Carlo simulation modes, and improved portfolio fragility analysis with new risk components and drivers.

## Project Structure
Portfolio Management spans API routes, server-side services, client hooks, and UI components:
- API routes expose CRUD operations for portfolios, health snapshots, Monte Carlo simulations, and stress testing.
- Services orchestrate health computation, fragility analysis, intelligence scoring, and stress scenario calculations.
- Hooks manage client-side caching, mutations, and SWR-driven revalidation.
- UI components visualize health, fragility, Monte Carlo results, stress test scenarios, holdings, and intelligence summaries.

```mermaid
graph TB
subgraph "Client"
UI_Dashboard["Dashboard Page<br/>src/app/dashboard/portfolio/page.tsx"]
UI_StressTest["Stress Test Page<br/>src/app/dashboard/stress-test/page.tsx"]
Hooks["use-portfolio.ts<br/>use-portfolio-health.ts"]
Components["UI Components<br/>Health Meter, Fragility, Monte Carlo, Holdings, Intelligence Hero"]
CorrelationCard["Correlation Stress Card<br/>src/components/dashboard/correlation-stress-card.tsx"]
end
subgraph "Server"
API_Portfolios["API Routes<br/>/api/portfolio/*"]
API_StressTest["Stress Test API<br/>/api/stocks/stress-test"]
Service["Portfolio Service<br/>src/lib/services/portfolio.service.ts"]
Engines["Engines<br/>Health, Monte Carlo, Fragility"]
StressScenarios["Stress Scenarios<br/>Historical scenarios & utilities"]
end
subgraph "Data"
DB[("Database")]
Cache[("Redis Cache")]
end
UI_Dashboard --> Hooks
UI_StressTest --> Hooks
Hooks --> API_Portfolios
Hooks --> API_StressTest
API_Portfolios --> Service
API_StressTest --> StressScenarios
Service --> Engines
Service --> DB
API_Portfolios --> Cache
API_StressTest --> Cache
Components --> Hooks
CorrelationCard --> Hooks
```

**Diagram sources**
- [src/app/dashboard/portfolio/page.tsx:564-770](file://src/app/dashboard/portfolio/page.tsx#L564-L770)
- [src/app/dashboard/stress-test/page.tsx:1-800](file://src/app/dashboard/stress-test/page.tsx#L1-L800)
- [src/hooks/use-portfolio.ts:70-99](file://src/hooks/use-portfolio.ts#L70-L99)
- [src/hooks/use-portfolio-health.ts:40-61](file://src/hooks/use-portfolio-health.ts#L40-L61)
- [src/app/api/portfolio/route.ts:17-52](file://src/app/api/portfolio/route.ts#L17-L52)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L17-L75)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L14-L100)
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/lib/engines/portfolio-health.ts:152-200](file://src/lib/engines/portfolio-health.ts#L152-L200)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)
- [src/lib/stress-scenarios/index.ts:1-75](file://src/lib/stress-scenarios/index.ts#L1-L75)

**Section sources**
- [src/app/api/portfolio/route.ts:17-101](file://src/app/api/portfolio/route.ts#L17-L101)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts#L15-L142)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L17-L75)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L14-L100)
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)
- [src/app/dashboard/portfolio/page.tsx:564-770](file://src/app/dashboard/portfolio/page.tsx#L564-L770)
- [src/app/dashboard/stress-test/page.tsx:1-800](file://src/app/dashboard/stress-test/page.tsx#L1-L800)
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/hooks/use-portfolio.ts:70-99](file://src/hooks/use-portfolio.ts#L70-L99)
- [src/hooks/use-portfolio-health.ts:40-61](file://src/hooks/use-portfolio-health.ts#L40-L61)
- [src/lib/engines/portfolio-health.ts:152-200](file://src/lib/engines/portfolio-health.ts#L152-L200)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)
- [src/lib/stress-scenarios/index.ts:1-75](file://src/lib/stress-scenarios/index.ts#L1-L75)

## Core Components
- Portfolio API: Create, list, update, delete portfolios; fetch details with holdings and latest health snapshot.
- Health API: Compute and cache health snapshots; supports forced refresh.
- Monte Carlo API: Run regime-aware simulations with four modes; gated by plan tiers.
- Stress Testing API: Historical scenario analysis with proxy-based replay and confidence scoring.
- Services: Orchestrate health computation, fragility analysis, intelligence scoring, and stress scenario calculations; prune health snapshots.
- Hooks: Manage SWR-backed queries, optimistic mutations, and cache invalidation.
- UI Components: Health meter, fragility card, Monte Carlo card, stress test dashboard, holdings table, and intelligence hero.
- Correlation Stress Monitoring: Market-wide correlation analysis for systemic risk assessment.

**Section sources**
- [src/app/api/portfolio/route.ts:17-101](file://src/app/api/portfolio/route.ts#L17-L101)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts#L15-L142)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L17-L75)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L14-L100)
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/hooks/use-portfolio.ts:141-355](file://src/hooks/use-portfolio.ts#L141-L355)
- [src/hooks/use-portfolio-health.ts:40-81](file://src/hooks/use-portfolio-health.ts#L40-L81)
- [src/components/portfolio/portfolio-health-meter.tsx:163-257](file://src/components/portfolio/portfolio-health-meter.tsx#L163-L257)
- [src/components/portfolio/portfolio-fragility-card.tsx:135-273](file://src/components/portfolio/portfolio-fragility-card.tsx#L135-L273)
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:175-448](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L175-L448)
- [src/components/portfolio/portfolio-holdings-table.tsx:363-510](file://src/components/portfolio/portfolio-holdings-table.tsx#L363-L510)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)
- [src/components/dashboard/correlation-stress-card.tsx:73-171](file://src/components/dashboard/correlation-stress-card.tsx#L73-L171)

## Architecture Overview
The system follows a layered architecture with enhanced stress testing capabilities:
- Presentation: Next.js app pages and client components for portfolio management and stress testing.
- Domain: Hooks and services encapsulate business logic for both portfolio and stress analysis.
- Infrastructure: API routes, engines, stress scenario libraries, and persistence/cache.

```mermaid
sequenceDiagram
participant User as "User"
participant PortfolioUI as "Portfolio Dashboard"
participant StressUI as "Stress Test Dashboard"
participant PortfolioAPI as "Portfolio API"
participant StressAPI as "Stress Test API"
participant Service as "Portfolio Service"
participant Engines as "Engines"
participant StressScenarios as "Stress Scenarios"
participant DB as "Database"
participant Cache as "Redis"
User->>PortfolioUI : Open Portfolio Dashboard
PortfolioUI->>PortfolioAPI : GET /api/portfolio
PortfolioAPI->>DB : Query portfolios
DB-->>PortfolioAPI : Portfolios
PortfolioAPI-->>PortfolioUI : Portfolios
User->>StressUI : Open Stress Test Dashboard
StressUI->>StressAPI : POST /api/stocks/stress-test
StressAPI->>StressScenarios : Load scenario data
StressScenarios-->>StressAPI : Scenario definitions
StressAPI->>DB : Query asset & price history
DB-->>StressAPI : Market data
StressAPI-->>StressUI : Stress test results
PortfolioUI->>PortfolioAPI : GET /api/portfolio/ : id/health?refresh=true
PortfolioAPI->>Service : computeAndStorePortfolioHealth()
Service->>Engines : computePortfolioHealth()
Engines-->>Service : Health result
Service->>Engines : computePortfolioFragility()
Engines-->>Service : Fragility result
Service->>DB : Create health snapshot
Service->>Cache : Invalidate keys
PortfolioAPI-->>PortfolioUI : Latest snapshot
```

**Diagram sources**
- [src/app/dashboard/portfolio/page.tsx:608-638](file://src/app/dashboard/portfolio/page.tsx#L608-L638)
- [src/app/dashboard/stress-test/page.tsx:654-715](file://src/app/dashboard/stress-test/page.tsx#L654-L715)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L38-L53)
- [src/app/api/stocks/stress-test/route.ts:330-486](file://src/app/api/stocks/stress-test/route.ts#L330-L486)
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/lib/engines/portfolio-health.ts:152-200](file://src/lib/engines/portfolio-health.ts#L152-L200)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)

## Detailed Component Analysis

### Portfolio Lifecycle API
- List and create portfolios with region and currency scoping.
- Retrieve detailed portfolio with holdings and latest health snapshot.
- Update and delete portfolios with transactional safety and cache invalidation.

```mermaid
sequenceDiagram
participant Client as "Client"
participant API as "Portfolio API"
participant DB as "Database"
Client->>API : POST /api/portfolio
API->>DB : Create portfolio
DB-->>API : Portfolio
API-->>Client : Portfolio
Client->>API : GET /api/portfolio?id=...
API->>DB : Find portfolios
DB-->>API : Portfolios
API-->>Client : Portfolios
Client->>API : GET /api/portfolio/ : id
API->>DB : Find portfolio with holdings
DB-->>API : Portfolio
API-->>Client : Portfolio
```

**Diagram sources**
- [src/app/api/portfolio/route.ts:17-101](file://src/app/api/portfolio/route.ts#L17-L101)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts#L15-L71)

**Section sources**
- [src/app/api/portfolio/route.ts:17-101](file://src/app/api/portfolio/route.ts#L17-L101)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts#L15-L71)

### Health Monitoring and Real-Time Metrics
- Health computation aggregates five dimensions: diversification, concentration, volatility, correlation, and quality.
- Fragility analysis measures structural instability across volatility, correlation, liquidity, factor rotation, and concentration.
- Snapshots are cached and pruned to a fixed window; refresh supported with forced recomputation.

```mermaid
flowchart TD
Start([Compute Health]) --> Load["Load portfolio holdings"]
Load --> Validate{"Holdings valid?"}
Validate --> |No| Skip["Skip compute"]
Validate --> |Yes| Build["Build holding inputs"]
Build --> Health["computePortfolioHealth()"]
Build --> Frag["computePortfolioFragility()"]
Health --> Merge["Merge results"]
Frag --> Merge
Merge --> Metrics["Build risk metrics"]
Metrics --> Save["Create health snapshot"]
Save --> Prune["Prune old snapshots"]
Prune --> End([Done])
```

**Diagram sources**
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/lib/engines/portfolio-health.ts:152-200](file://src/lib/engines/portfolio-health.ts#L152-L200)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)

**Section sources**
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L17-L75)
- [src/lib/services/portfolio.service.ts:169-318](file://src/lib/services/portfolio.service.ts#L169-L318)
- [src/hooks/use-portfolio-health.ts:40-61](file://src/hooks/use-portfolio-health.ts#L40-L61)
- [src/components/portfolio/portfolio-health-meter.tsx:163-257](file://src/components/portfolio/portfolio-health-meter.tsx#L163-L257)
- [src/components/portfolio/portfolio-fragility-card.tsx:135-273](file://src/components/portfolio/portfolio-fragility-card.tsx#L135-L273)

### Monte Carlo Simulation Engine
- Four modes: Stable Regime (A), Markov Switching (B), Stress Injection (C), Factor Shock (D).
- Regime-switching multivariate geometric Brownian motion with volatility, drift, correlation, and liquidity effects.
- Outputs include expected return, VaR/ES, drawdown statistics, regime forecast, and fragility metrics.

```mermaid
sequenceDiagram
participant UI as "Monte Carlo Card"
participant API as "POST /api/portfolio/ : id/simulate"
participant Svc as "Portfolio Service"
participant Eng as "Monte Carlo Engine"
UI->>API : Request simulation (mode, horizon, paths)
API->>Svc : Validate plan and holdings
Svc->>Eng : runMonteCarloSimulation()
Eng-->>Svc : Simulation result
Svc-->>API : Result
API-->>UI : Render distribution and metrics
```

**Diagram sources**
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:175-230](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L175-L230)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L14-L100)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)

**Section sources**
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L14-L100)
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:175-448](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L175-L448)
- [src/lib/engines/portfolio-monte-carlo.ts:212-336](file://src/lib/engines/portfolio-monte-carlo.ts#L212-L336)

### Comprehensive Stress Testing System
- Historical scenario analysis with 7 predefined stress scenarios: GFC 2008, COVID 2020, Rate Shock 2022, Recession, Interest Rate Shock, Tech Bubble Crash, Oil Spike.
- Proxy-based replay system with beta adjustment for asset-specific characteristics.
- Confidence scoring and narrative generation for each scenario result.
- Multi-asset stress testing with credit pricing and plan gating.

```mermaid
sequenceDiagram
participant User as "User"
participant StressUI as "Stress Test Dashboard"
participant StressAPI as "POST /api/stocks/stress-test"
participant StressScenarios as "Stress Scenarios"
participant DB as "Database"
User->>StressUI : Select scenario & assets
StressUI->>StressAPI : POST stress test request
StressAPI->>StressScenarios : Load scenario definitions
StressScenarios-->>StressAPI : Scenario data
StressAPI->>DB : Query asset & price history
DB-->>StressAPI : Market data
StressAPI->>StressAPI : Calculate proxy paths & beta
StressAPI->>StressAPI : Generate narrative & confidence
StressAPI-->>StressUI : Stress test results
StressUI->>User : Display scenario analysis
```

**Diagram sources**
- [src/app/dashboard/stress-test/page.tsx:654-715](file://src/app/dashboard/stress-test/page.tsx#L654-L715)
- [src/app/api/stocks/stress-test/route.ts:330-486](file://src/app/api/stocks/stress-test/route.ts#L330-L486)
- [src/lib/stress-scenarios/index.ts:10-75](file://src/lib/stress-scenarios/index.ts#L10-L75)

**Section sources**
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)
- [src/app/dashboard/stress-test/page.tsx:1-800](file://src/app/dashboard/stress-test/page.tsx#L1-L800)
- [src/lib/stress-scenarios/types.ts:1-106](file://src/lib/stress-scenarios/types.ts#L1-L106)
- [src/lib/stress-scenarios/index.ts:1-75](file://src/lib/stress-scenarios/index.ts#L1-L75)
- [src/lib/stress-scenarios/stress-test-utils.ts:1-77](file://src/lib/stress-scenarios/stress-test-utils.ts#L1-L77)

### Enhanced Portfolio Fragility Analysis
- New fragility components: volatility percentile, liquidity risk, correlation convergence, negative factor alignment.
- Improved driver identification system for top risk contributors.
- Enhanced explanation generation with scenario-specific insights.
- Factor rotation fragility integration for regime adaptation risk.

```mermaid
flowchart TD
Start([Compute Fragility]) --> Load["Load portfolio holdings"]
Load --> Validate{"Holdings valid?"}
Validate --> |No| Zero["Return zero fragility"]
Validate --> |Yes| Base["Calculate base fragility components"]
Base --> Regime["Apply regime stress multiplier"]
Regime --> Drivers["Identify top drivers"]
Drivers --> Explain["Generate explanation"]
Explain --> Output["Return fragility result"]
```

**Diagram sources**
- [src/lib/engines/portfolio-fragility.ts:79-107](file://src/lib/engines/portfolio-fragility.ts#L79-L107)
- [src/lib/engines/__tests__/portfolio-fragility.test.ts:1-197](file://src/lib/engines/__tests__/portfolio-fragility.test.ts#L1-L197)

**Section sources**
- [src/lib/engines/portfolio-fragility.ts:79-107](file://src/lib/engines/portfolio-fragility.ts#L79-L107)
- [src/lib/engines/__tests__/portfolio-fragility.test.ts:1-197](file://src/lib/engines/__tests__/portfolio-fragility.test.ts#L1-L197)
- [src/components/portfolio/portfolio-fragility-card.tsx:135-273](file://src/components/portfolio/portfolio-fragility-card.tsx#L135-L273)

### Portfolio Composition Tracking and Analytics
- Holdings table displays quantities, prices, values, P&L, weights, and DSE scores; supports inline edit and expandable details.
- Portfolio Intelligence Hero summarizes score, band, signals, and next action.
- Allocation visualization shows sector/type exposure.

```mermaid
classDiagram
class PortfolioHoldingsTable {
+holdings : PortfolioHolding[]
+currencySymbol : string
+locale : string
+onRemove(id)
+onEdit(id, body)
}
class PortfolioIntelligenceHero {
+intelligence : PortfolioIntelligenceResult
+supportNote : string?
+marketLabel : string?
}
PortfolioHoldingsTable --> PortfolioHolding : "renders"
PortfolioIntelligenceHero --> PortfolioIntelligenceResult : "consumes"
```

**Diagram sources**
- [src/components/portfolio/portfolio-holdings-table.tsx:363-510](file://src/components/portfolio/portfolio-holdings-table.tsx#L363-L510)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)

**Section sources**
- [src/components/portfolio/portfolio-holdings-table.tsx:363-510](file://src/components/portfolio/portfolio-holdings-table.tsx#L363-L510)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)
- [src/app/dashboard/portfolio/page.tsx:218-298](file://src/app/dashboard/portfolio/page.tsx#L218-L298)

### Alerts, Drift Detection, and Benchmark Comparisons
- Portfolio alerts derive headline/body and priority from health snapshots and risk metrics.
- Drift detection leverages DSE scores and compatibility labels to surface potential misalignment.
- Benchmark comparison card integrates with market regimes and sector alignment.

```mermaid
flowchart TD
Snapshot["Health Snapshot"] --> Parse["Parse risk metrics"]
Parse --> Band["Compute health band"]
Band --> Alert["Build alert summary"]
Alert --> Publish["Publish alert and share text"]
```

**Diagram sources**
- [src/lib/portfolio-alerts.ts:1-41](file://src/lib/portfolio-alerts.ts#L1-L41)
- [src/app/dashboard/portfolio/page.tsx:690-704](file://src/app/dashboard/portfolio/page.tsx#L690-L704)

**Section sources**
- [src/lib/portfolio-alerts.ts:1-41](file://src/lib/portfolio-alerts.ts#L1-L41)
- [src/app/dashboard/portfolio/page.tsx:690-704](file://src/app/dashboard/portfolio/page.tsx#L690-L704)

### Scenario Analysis and Risk Visualization Tools
- Monte Carlo visualization includes return distribution, VaR/ES, median, regime forecast, and fragility mean.
- Health meter and fragility card provide dimension-level insights and structural risk profiles.
- Regime alignment bar helps assess compatibility with current market backdrop.
- Stress test dashboard visualizes historical scenario impacts across multiple assets.
- Correlation stress card monitors systemic risk through market-wide correlation analysis.

```mermaid
graph LR
MC["Monte Carlo Card"] --> Dist["Return Distribution"]
MC --> Stats["Key Metrics"]
MC --> Regime["Regime Forecast"]
Health["Health Meter"] --> Dim["Dimension Bars"]
Frag["Fragility Card"] --> Comp["Fragility Components"]
Frag --> Top["Top Drivers"]
Stress["Stress Test Dashboard"] --> Scenarios["Historical Scenarios"]
Stress --> Assets["Multi-Asset Comparison"]
Corr["Correlation Stress Card"] --> Systemic["Systemic Risk Monitor"]
```

**Diagram sources**
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:61-173](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L61-L173)
- [src/components/portfolio/portfolio-health-meter.tsx:204-246](file://src/components/portfolio/portfolio-health-meter.tsx#L204-L246)
- [src/components/portfolio/portfolio-fragility-card.tsx:207-270](file://src/components/portfolio/portfolio-fragility-card.tsx#L207-L270)
- [src/app/dashboard/stress-test/page.tsx:1-800](file://src/app/dashboard/stress-test/page.tsx#L1-L800)
- [src/components/dashboard/correlation-stress-card.tsx:73-171](file://src/components/dashboard/correlation-stress-card.tsx#L73-L171)

**Section sources**
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:61-173](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L61-L173)
- [src/components/portfolio/portfolio-health-meter.tsx:204-246](file://src/components/portfolio/portfolio-health-meter.tsx#L204-L246)
- [src/components/portfolio/portfolio-fragility-card.tsx:207-270](file://src/components/portfolio/portfolio-fragility-card.tsx#L207-L270)
- [src/app/dashboard/stress-test/page.tsx:1-800](file://src/app/dashboard/stress-test/page.tsx#L1-L800)
- [src/components/dashboard/correlation-stress-card.tsx:73-171](file://src/components/dashboard/correlation-stress-card.tsx#L73-L171)

### Optimization Workflows and Decision Support
- Intelligence hero highlights signals and next action derived from health and fragility.
- Monte Carlo results integrate into portfolio score when selected, enabling scenario-driven decisions.
- Stress test results inform portfolio construction and rebalancing decisions.
- Broker import and CSV/PDF import dialogs streamline onboarding and optimization.

```mermaid
sequenceDiagram
participant User as "User"
participant Dashboard as "Dashboard"
participant Intelligence as "Intelligence Hero"
participant MC as "Monte Carlo Card"
participant Stress as "Stress Test Dashboard"
User->>Dashboard : Analyze portfolio risks
Dashboard->>MC : Execute scenario analysis
MC-->>Dashboard : Return Monte Carlo metrics
Dashboard->>Stress : Run stress test
Stress-->>Dashboard : Return scenario impacts
Dashboard->>Intelligence : Combine insights
Intelligence-->>User : Updated signals and next action
```

**Diagram sources**
- [src/app/dashboard/portfolio/page.tsx:708-737](file://src/app/dashboard/portfolio/page.tsx#L708-L737)
- [src/app/dashboard/stress-test/page.tsx:654-715](file://src/app/dashboard/stress-test/page.tsx#L654-L715)
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:175-230](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L175-L230)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)

**Section sources**
- [src/app/dashboard/portfolio/page.tsx:708-737](file://src/app/dashboard/portfolio/page.tsx#L708-L737)
- [src/app/dashboard/stress-test/page.tsx:654-715](file://src/app/dashboard/stress-test/page.tsx#L654-L715)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)

## Dependency Analysis
- API routes depend on services and engines for computation and persistence.
- Stress test API depends on stress scenario libraries and market data.
- Services depend on engines for health and fragility computations.
- Hooks depend on API routes for data and mutations.
- UI components depend on hooks and services for rendering and interactivity.

```mermaid
graph TB
API["API Routes"] --> Service["Portfolio Service"]
Service --> HealthEngine["Health Engine"]
Service --> FragEngine["Fragility Engine"]
Service --> MC["Monte Carlo Engine"]
StressAPI["Stress Test API"] --> StressScenarios["Stress Scenarios"]
StressAPI --> DB["Database"]
Hooks["Hooks"] --> API
Hooks --> StressAPI
UI["UI Components"] --> Hooks
```

**Diagram sources**
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L7-L7)
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)
- [src/lib/services/portfolio.service.ts:11-14](file://src/lib/services/portfolio.service.ts#L11-L14)
- [src/hooks/use-portfolio.ts:70-99](file://src/hooks/use-portfolio.ts#L70-L99)
- [src/components/portfolio/portfolio-health-meter.tsx:1-15](file://src/components/portfolio/portfolio-health-meter.tsx#L1-L15)

**Section sources**
- [src/lib/services/portfolio.service.ts:11-14](file://src/lib/services/portfolio.service.ts#L11-L14)
- [src/lib/engines/portfolio-health.ts:1-6](file://src/lib/engines/portfolio-health.ts#L1-L6)
- [src/lib/engines/portfolio-monte-carlo.ts:1-5](file://src/lib/engines/portfolio-monte-carlo.ts#L1-L5)
- [src/app/api/stocks/stress-test/route.ts:238-486](file://src/app/api/stocks/stress-test/route.ts#L238-L486)

## Performance Considerations
- Batch processing: Health recomputation batches portfolios with concurrency control to avoid overload.
- Caching: Health and analytics are cached with TTL and invalidated on changes.
- Lazy engine loading: Monte Carlo engine is imported on demand to reduce cold start overhead.
- Auto-refresh: Client-side auto-refresh attempts once per day with local storage persistence.
- Credit pricing: Stress testing uses progressive credit costs ($5 for first asset, $3 each additional).
- Plan gating: Elite/Enterprise required for advanced stress testing features.

**Section sources**
- [src/lib/services/portfolio.service.ts:324-363](file://src/lib/services/portfolio.service.ts#L324-L363)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L15-L15)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L91-L91)
- [src/app/dashboard/portfolio/page.tsx:640-671](file://src/app/dashboard/portfolio/page.tsx#L640-L671)
- [src/app/api/stocks/stress-test/route.ts:299-307](file://src/app/api/stocks/stress-test/route.ts#L299-L307)

## Troubleshooting Guide
- Unauthorized access: API routes return 401 if unauthenticated.
- Validation errors: Invalid query/body returns 400 with error details.
- Portfolio limit reached: Creation returns 403 with plan limit details.
- Not found: Portfolio not found returns 404.
- Health recomputation failures: Non-fatal warnings logged; snapshot pruning runs fire-and-forget.
- Simulation gating: STARTER tier restricted; Elite required for advanced modes and higher path counts.
- Stress test errors: 402 for insufficient credits, 403 for plan gating, 400 for invalid input.
- Scenario loading: Missing scenario metadata handled gracefully with fallback UI.

**Section sources**
- [src/app/api/portfolio/route.ts:17-101](file://src/app/api/portfolio/route.ts#L17-L101)
- [src/app/api/portfolio/[id]/route.ts](file://src/app/api/portfolio/[id]/route.ts#L73-L141)
- [src/app/api/portfolio/[id]/health/route.ts](file://src/app/api/portfolio/[id]/health/route.ts#L38-L53)
- [src/lib/services/portfolio.service.ts:283-291](file://src/lib/services/portfolio.service.ts#L283-L291)
- [src/app/api/portfolio/[id]/simulate/route.ts](file://src/app/api/portfolio/[id]/simulate/route.ts#L27-L49)
- [src/app/api/stocks/stress-test/route.ts:244-246](file://src/app/api/stocks/stress-test/route.ts#L244-L246)
- [src/app/dashboard/stress-test/page.tsx:679-714](file://src/app/dashboard/stress-test/page.tsx#L679-L714)

## Conclusion
The Portfolio Management system provides a robust foundation for portfolio creation, health monitoring, risk assessment, scenario analysis, and decision support. The enhanced system now includes comprehensive stress testing capabilities with historical scenario analysis, improved Monte Carlo simulation modes, and advanced fragility analysis with new risk components. Its modular design separates concerns across API routes, services, engines, stress scenario libraries, hooks, and UI components, enabling scalability, maintainability, and a rich user experience with sophisticated risk management tools.

## Appendices

### Practical Examples
- Setup a portfolio: Use the create dialog to define name, description, currency, and region; confirm with cache invalidation.
- Monitor health: Use the health meter and fragility card to review dimension-level scores and structural risks.
- Run Monte Carlo: Select mode and horizon, then execute simulation; integrate results into intelligence scoring.
- Stress test scenarios: Select historical scenarios and assets to analyze potential downside impacts under different market conditions.
- Track holdings: Add, edit, and remove holdings via the holdings table; expand rows to inspect DSE scores and compatibility.
- Decision support: Review intelligence hero signals and next action; leverage alerts, drift detection, and stress test insights.

**Section sources**
- [src/app/dashboard/portfolio/page.tsx:585-638](file://src/app/dashboard/portfolio/page.tsx#L585-L638)
- [src/app/dashboard/stress-test/page.tsx:654-715](file://src/app/dashboard/stress-test/page.tsx#L654-L715)
- [src/components/portfolio/portfolio-monte-carlo-card.tsx:175-230](file://src/components/portfolio/portfolio-monte-carlo-card.tsx#L175-L230)
- [src/components/portfolio/portfolio-holdings-table.tsx:363-510](file://src/components/portfolio/portfolio-holdings-table.tsx#L363-L510)
- [src/components/portfolio/portfolio-intelligence-hero.tsx:105-221](file://src/components/portfolio/portfolio-intelligence-hero.tsx#L105-L221)