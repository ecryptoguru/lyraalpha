# LyraAlpha AI — Support Knowledge Base

## About LyraAlpha AI

LyraAlpha AI is an institutional-grade financial intelligence platform for retail investors. It provides AI-powered market analysis, asset scoring, regime detection, and portfolio intelligence across US and Indian markets — stocks, ETFs, crypto, mutual funds, and commodities.

The platform is NOT a trading platform. It does not execute trades, manage portfolios, or provide personalised financial advice. It is an intelligence and research tool.

The platform has two AI agents with separate roles:
- **Lyra Intel** — market intelligence: scores, regime analysis, portfolio interpretation, premium workflows
- **Myra** — platform support: product questions, plan/credit help, navigation, troubleshooting (that's me)

Myra is available to all visitors — including public visitors on the landing page before signing in.

---

## Plans & Pricing

### STARTER (Free)
- 50 Lyra AI credits per month
- Access to Lyra Intel (limited queries — GPT-5.4-nano for SIMPLE/MODERATE, GPT-5.4-mini for COMPLEX)
- Discovery Feed access
- India (NSE/BSE) + US markets
- Watchlist and Portfolio Intelligence
- Portfolio Health headline score only (no dimension breakdown)
- Monte Carlo: not available
- Compare Assets: not available
- Shock Simulator: not available
- Personal Briefing / What's Changed: not available

### PRO ($14.99/month | ₹1,499/month)
- 500 Lyra AI credits per month
- Full Lyra Intel (GPT-5.4-mini for SIMPLE/MODERATE, GPT-5.4-full for COMPLEX)
- Full ETF, Mutual Fund, and Commodity intelligence
- India + US markets
- Portfolio Health with dimension breakdown
- Monte Carlo simulation (Modes A and B)
- Compare Assets: not available
- Shock Simulator: not available

### ELITE ($39.99/month | ₹3,999/month)
- 1,500 Lyra AI credits per month
- Full Lyra Intel with web search and cross-sector analysis (GPT-5.4-full for all COMPLEX queries)
- All global markets including full crypto on-chain data
- **Compare Assets** premium workflow — multi-asset cross-sector synthesis (up to 4 assets)
- **Shock Simulator** premium workflow — historical stress scenario replay with Lyra interpretation
- Monte Carlo simulation (all four modes: A, B, C, D)
- Personal Briefing and What's Changed on Lyra Intel
- Portfolio Health with full dimension breakdown

### ENTERPRISE (Custom pricing)
- Everything in ELITE
- Custom commercial packaging and usage ceilings
- Dedicated support

To upgrade your plan, go to **Dashboard → Upgrade** or visit `/dashboard/upgrade`.

---

## Lyra Intel — AI Financial Analysis

Lyra is the platform's AI financial analyst. Available at `/dashboard/lyra` (also shown as **Lyra Intel** in the sidebar).

### What Lyra Can Do
- Analyse any asset in the platform's universe (US + India: stocks, ETFs, crypto, mutual funds, commodities)
- Explain market regime conditions (STRONG_RISK_ON → RISK_OFF)
- Interpret DSE engine scores (Trend, Momentum, Volatility, Liquidity, Trust, Sentiment)
- Explain Signal Strength and what it means for a specific asset
- Provide cross-sector correlation analysis (PRO COMPLEX and ELITE)
- Use live research augmentation on recency-sensitive queries (ELITE and ENTERPRISE)
- Answer questions about Indian and US market dynamics
- Run portfolio-mode analysis on your holdings
- Analyse stress scenarios via the **Shock Simulator** (ELITE, see below)
- Compare multiple assets via **Compare Assets** (ELITE, see below)

### What Lyra Cannot Do
- Execute trades or manage your portfolio
- Provide personalised financial advice or recommendations
- Access real-time intraday prices (data is end-of-day, delayed 1 business day)
- Access assets outside the platform's supported universe

### Lyra Query Tiers
- **SIMPLE** (1 credit): Short factual questions, single asset queries, definitions. Fast, concise answers.
- **MODERATE** (3 credits): Multi-part analysis, comparisons, regime-aware answers. Balanced depth.
- **COMPLEX** (5 credits): Deep multi-dimensional analysis, cross-sector synthesis, web-augmented research. Most detailed.

Lyra automatically classifies your query into the appropriate tier.

---

## Lyra Credit System

### Monthly Credit Allocation
Your plan determines how many credits you receive each month:
- **STARTER**: 50 credits/month
- **PRO**: 500 credits/month
- **ELITE**: 1,500 credits/month
- **ENTERPRISE**: 1,500 credits/month (base; governed by contract)

### Credit Costs by Query Complexity

| Query Type | Credit Cost | Examples |
|---|---|---|
| **SIMPLE** | 1 credit | "What is P/E ratio?", "What does Trend:82 mean?", "What is ARCS?" |
| **MODERATE** | 3 credits | "Compare HDFC and ICICI", "Why is this stock's momentum falling?", "What is the current market regime?" |
| **COMPLEX** | 5 credits | "Analyse NVDA vs AMD with sector correlation", "Portfolio risk assessment", "What happens if Fed cuts rates?" |
| **Compare Assets** | 5 credits (first asset) + 3 per additional (up to 4 assets) | Multi-asset cross-sector synthesis via the Compare Assets page |
| **Shock Simulator** | 5 credits (first asset) + 3 per additional (up to 4 assets) | Historical stress scenario via the Shock Simulator page |

### Credit Reset
- Credits reset automatically on your **monthly billing date**
- **Unused credits do NOT roll over** — they expire and new credits are allocated
- Credits cannot be transferred between months or shared with other users

### Top-Up Credits
If you run out before your billing date:
1. Go to **Dashboard → Credits** or `/dashboard/credits`
2. Choose from available credit packs
3. Credits are added instantly. Top-up credits do NOT expire and are separate from monthly allocations.

### Viewing Your Balance
- Check credits in the **Lyra Credits** display in the sidebar
- Transaction history is available in account settings

### What Happens When Credits Run Out
- You cannot send new queries to Lyra Intel until credits are available
- All other features (Discovery Feed, Timeline, Watchlist, Portfolio) remain accessible
- Myra (support) does NOT consume credits — it is always free

### Daily Token Cap (Secondary Limit)
In addition to credits, each plan has a per-day token ceiling that resets at midnight UTC:
- STARTER: 50,000 tokens/day
- PRO: 200,000 tokens/day
- ELITE: 500,000 tokens/day
- ENTERPRISE: uncapped (governed by contract)

This prevents runaway API usage from unusual session patterns. If you hit this limit, it resets the next UTC day.

---

## Premium Workflows (ELITE and ENTERPRISE)

### Compare Assets — `/dashboard/compare`
Multi-asset cross-sector synthesis for up to 4 assets simultaneously.
- Select assets using the search bar on the Compare Assets page
- Lyra analyses divergence, correlation, relative regime alignment, and opportunity framing across all selected assets in a single response
- Credit cost: 5 credits for the first asset + 3 credits per additional asset (capped at 4 assets)
- Explicitly triggered — selecting assets does not auto-run a paid comparison. You must click **Compare**.

### Shock Simulator — `/dashboard/stress-test`
Historical stress scenario replay with Lyra interpretation.
- Choose a historical shock scenario (e.g. GFC 2008, COVID-2020, Rate Shock 2022, Oil Spike, Tech Bubble) for US or India
- Select up to 4 assets to stress-test
- The platform runs a deterministic replay — using direct historical data where available, and hybrid proxy replay where it isn't
- Lyra then interprets the structured output: pressure points, resilience themes, transmission mechanisms, and hedge framing
- Credit cost: 5 credits for the first asset + 3 credits per additional asset
- Available scenarios vary by region (US and India scenarios available where supported)

---

## Dashboard Features

### Market Intel (Asset Analysis) — `/dashboard/assets`
Browse and analyse all assets in the platform's universe. Each asset page shows:
- End-of-day price data
- DSE Engine Scores: Trend, Momentum, Volatility, Liquidity, Trust, Sentiment (all 0–100)
- Signal Strength (composite directional signal with confidence)
- Score Dynamics (how scores are trending over time)
- **Score Velocity Badge** — shows rising or falling momentum direction on the asset card
- Asset-Regime Compatibility Score (ARCS)
- **Same-Sector Movers** — other assets in the same sector with their compatibility scores for context
- Analyst targets (for stocks)

### Discovery Feed — `/dashboard/discovery`
A curated feed showing notable signal changes, momentum shifts, and regime-aligned opportunities.
- **Signal Cluster Banner** — appears when high-DRS (directional regime signal) activity is detected in a sector or asset class, flagging unusual momentum bursts
- Feed depth varies by plan

### Timeline (Market Events) — `/dashboard/timeline`
Upcoming and recent market events: earnings, economic releases, central bank decisions.

### Watchlist — `/dashboard/watchlist`
Save and track your favourite assets. Available to all plans.
- **Score Velocity Badges** on watchlist rows — shows rising/falling score momentum at a glance
- **Drift Alert** — a badge appears when one or more holdings fall below the regime-compatibility threshold, prompting a review

### Portfolio Intelligence — `/dashboard/portfolio`
A full suite of deterministic intelligence on your holdings. Available to all plans (feature depth varies by plan).

Refresh behaviour:
- **Manual refresh**: click **Refresh Portfolio** to recompute health, fragility, and intelligence scores immediately using the latest asset data
- **Automatic daily refresh**: if more than 24 hours have passed since the last refresh, the page auto-triggers a background refresh when you open it
- A "Last refreshed" timestamp is shown next to the refresh button

#### Adding Holdings
Holdings can be added in four ways:
1. **Manual entry** — Add Holding button, enter symbol, quantity, and average price
2. **CSV import** — Upload a CSV with columns: symbol, quantity, avgPrice
3. **PDF import** — Supports Zerodha, Groww, and US brokerage statements (AI-parsed)
4. **Broker connect** — Direct broker integration (where available)

#### Portfolio Intelligence Score (0–10)
A composite headline score combining five weighted sub-scores:
- **Diversification** (30%) — asset class and sector spread
- **Resilience** (25%) — weighted health, fragility, and volatility control
- **Overlap Clarity** (20%) — regime compatibility alignment across holdings
- **Concentration** (15%) — penalty for over-concentration in top positions
- **Performance** (10%) — realised return blended with Monte Carlo expectation if available

Score bands: **Exceptional** (8.5+), **Strong** (7+), **Balanced** (5.5+), **Fragile** (4+), **High Risk** (below 4).

#### Portfolio Health Score (0–100)
Five diagnostic dimensions: Diversification, Concentration, Volatility Control, Correlation Risk, Quality & Trust.
- **PRO and above**: full dimension breakdown visible
- **STARTER**: headline score only — upgrade to PRO to unlock the dimension bars

#### Portfolio Fragility Score (0–100)
Measures structural instability under regime deterioration.
- Components: Volatility Exposure, Correlation Convergence, Liquidity Contraction, Factor Rotation Risk, Concentration Risk
- Classifications: **Robust** (0–25), **Moderate** (25–50), **Fragile** (50–75), **Structurally Fragile** (75+)
- Top three fragility drivers are surfaced as actionable labels

#### Portfolio Regime Alignment
A visualisation bar showing what portion of your holdings are **aligned**, **neutral**, or **misaligned** relative to the current market regime, weighted by position value.

#### Portfolio Drawdown Estimate
A heuristic 30-day downside framing shown on the portfolio hero surface — provides a rough context for potential drawdown given current regime and fragility.

#### Holdings Table
- **P&L Heatmap** — cells are colour-coded by return against cost basis
- **Expandable DSE Score Chips** — expand any holding row to see Trend, Momentum, Volatility, Liquidity, Trust, Sentiment scores inline

#### Benchmark Comparison
Compares your portfolio's realised return against region-specific benchmarks:
- **US**: S&P 500 (SPY), NASDAQ 100 (QQQ), Bitcoin (BTC-USD), Gold (GLD)
- **India**: Nifty 50, Sensex, Nifty Bank, Gold (GLD)
- Green diff bar = outperforming; red diff bar = underperforming

#### Monte Carlo Simulation
Runs stochastic forward simulations on your portfolio. PRO gets modes A and B; ELITE/Enterprise get all four.
- **Mode A — Stable Regime**: holds current regime constant
- **Mode B — Markov Switching**: full stochastic regime transitions (default)
- **Mode C — Stress Injection**: forces a RISK_OFF event mid-simulation (ELITE only)
- **Mode D — Factor Shock**: overrides factor preferences mid-path (ELITE only)
- Horizons: 20 days or 60 days
- Outputs: Expected return, Median return, P25/P75, VaR 5%, Expected Shortfall, Max Drawdown, Regime Forecast

### Lyra Intel Page — `/dashboard/lyra`
The central Lyra chat surface. Additional features visible here:

#### Daily Briefing
A region-specific AI-generated daily market briefing: regime, breadth, volatility, top movers, upcoming events, discovery highlights. Updated once per day. Available to all authenticated plans.
- Regions: 🇺🇸 US and 🇮🇳 India
- A **staleness indicator** appears if the briefing is older than the freshness threshold

#### Personal Briefing (ELITE / ENTERPRISE only)
On-demand watchlist-specific summary. Computed deterministically — no Lyra credit cost:
- Top 5 watchlist assets ranked by signal strength
- Assets with strong momentum (Momentum Score > 70) highlighted
- Regime-misaligned assets (Compatibility Score < 40) flagged for review
- Cached for 5 minutes with a 10-minute stale window

#### What's Changed (ELITE / ENTERPRISE only)
Shows which watchlist assets moved significantly since your last visit (default window: 8 hours). No credit cost.
- **Price moves**: assets with ±3%+ price change
- **Score inflections**: assets where a DSE score moved 8+ points
- Top 5 changes shown with a plain-English summary

### Learning Hub — `/dashboard/learning`
Educational content about investing, markets, and how to use the platform's intelligence tools.

### Settings — `/dashboard/settings`
Manage your account, notification preferences, region settings, and subscription.

---

## Onboarding

When you first sign in, the platform guides you through a 3-step onboarding gate inside the dashboard:
1. **Market** — choose your primary market focus (US, India, or both)
2. **Experience** — indicate your investing experience level
3. **Interests** — select the asset types and sectors you care about

Completing onboarding personalises your Discovery Feed and Lyra's default context.

---

## Asset Universe & Data

- **Coverage**: US stocks, ETFs, crypto, commodities; Indian stocks, mutual funds, ETFs, commodities
- **Data timing**: All market data is **end-of-day** (delayed 1 business day). Not suitable for intraday trading.
- **Data sources**: US — Yahoo Finance; Indian Stocks — NSE India API + Yahoo Finance; Indian Mutual Funds — MFAPI; Crypto — CoinGecko
- For detailed score explanations (DSE, Signal Strength, Regime), ask Lyra Intel or see the Learning Hub

---

## Common Issues & FAQs

### "My Lyra credits ran out"
Credits reset on your monthly billing date. You can purchase additional top-up credit packs from `/dashboard/credits`. Elite users get 1,500 credits/month which is enough for heavy daily use.

### "An asset I want isn't in the platform"
If you'd like to request an asset be added, let us know via this chat and we'll log it for the product team.

### "Lyra gave me an answer I don't understand"
Ask Lyra to explain it differently — it can rephrase and simplify. For score explanations, the Learning Hub at `/dashboard/learning` has detailed guides.

### "My data looks outdated"
All data is end-of-day, delayed 1 business day by design. The platform is built for strategic analysis, not intraday trading.

### "I want to cancel my subscription"
Go to **Settings → Subscription** to manage or cancel your plan. Cancellations take effect at the end of the current billing period.

### "I'm being charged but can't access PRO features"
This is usually a sync issue. Try logging out and back in. If the issue persists, contact support via this chat with your email.

### "Can I get a refund?"
Refund requests are handled case-by-case. Contact support with your account email and reason for the request.

### "How do I change my region (India/US)?"
Use the region selector on the Lyra Intel page (🇺🇸 US / 🇮🇳 India tabs), or update your default in **Settings → Preferences**.

### "Is my data safe?"
The platform uses Clerk for authentication, PostgreSQL hosted on Supabase (SOC 2 compliant), and does not store any financial account credentials. Watchlist and portfolio data are stored securely.

### "Can Lyra access my brokerage account?"
Lyra is a read-only intelligence tool. It analyses data you provide — either by manually entering holdings, uploading a CSV/PDF, or connecting a broker where that integration is available. It does not execute trades or write to any brokerage account.

### "Which brokers are supported?"
Broker connect availability depends on your region and the integrations currently enabled in the product. If a broker is not listed in your dashboard, it means that integration is not available yet.

### "What if my broker isn't listed?"
You can still use Myra by adding holdings manually or importing a CSV/PDF statement. If you need a specific broker, share the name with support so the team can review demand.

### "What is the Portfolio Intelligence Score?"
A composite 0–10 score combining Diversification (30%), Resilience (25%), Overlap Clarity (20%), Concentration (15%), and Performance (10%). Running a Monte Carlo simulation feeds forward-simulation output into the Performance dimension. Score bands: Exceptional (8.5+), Strong (7+), Balanced (5.5+), Fragile (4+), High Risk (below 4).

### "What is the Fragility Score?"
The Portfolio Fragility Score (0–100) measures how structurally vulnerable your portfolio would be under regime deterioration. Higher fragility = more vulnerable to a shock. Structurally Fragile readings (above 75) mean you should review the top drivers shown on the card.

### "What is the Monte Carlo simulation?"
Runs thousands of forward simulations on your portfolio using different regime scenarios. Four modes: Stable Regime (A), Markov Switching (B, default), Stress Injection (C), Factor Shock (D). PRO gets modes A and B; ELITE/Enterprise get all four. Horizons: 20 or 60 days.

### "Why is Myra slow or not responding?"
Myra is usually fastest on short FAQ-style questions. If replies are slow, try rephrasing the question more directly, and if the issue persists, refresh the chat or contact human support through the conversation thread.

### "How do I change notification preferences?"
Open **Settings → Preferences** to manage the product settings you can control. If a notification option is not visible there yet, it is not currently exposed in the product.

### "What are the daily token limits?"
Daily token caps are a secondary safeguard in addition to monthly credits. STARTER gets 50,000 tokens/day, PRO 200,000, ELITE 500,000, and ENTERPRISE is uncapped by default unless your contract says otherwise.

### "What happens when my trial ends?"
Trial access ends when the trial period expires. If you want to keep using premium features, you can upgrade from **Dashboard → Upgrade** once your plan is available.

### "What do the benchmark comparison bars mean?"
Green = you are outperforming that benchmark; red = underperforming. Calculated from your portfolio's total return (current price vs cost basis) vs each benchmark's equivalent return.

### "Why isn't my Portfolio Health showing dimension bars?"
Dimension bars are available on PRO and above. STARTER shows the headline Health Score only. Upgrade at `/dashboard/upgrade`.

### "What is the Personal Briefing?"
An ELITE/Enterprise feature. On-demand watchlist-specific summary computed deterministically — no credit cost. Shows top signal-strength assets, strong momentum holdings, and regime-misaligned assets flagged for review.

### "What does What's Changed show?"
An ELITE/Enterprise feature. Shows watchlist assets that moved significantly (±3% price or 8+ DSE score points) since your last visit. Default window: 8 hours. No credits consumed.

### "How do I refresh my portfolio scores?"
Click **Refresh Portfolio** on the portfolio page. If more than 24 hours have passed since your last refresh, the page will auto-refresh in the background when you open it.

### "What is Compare Assets?"
An ELITE/Enterprise feature at `/dashboard/compare`. Multi-asset cross-sector synthesis across up to 4 assets. Lyra analyses divergence, correlation, relative regime alignment, and framing for all selected assets at once. Credit cost: 5 credits for the first asset + 3 per additional.

### "What is the Shock Simulator?"
An ELITE/Enterprise feature at `/dashboard/stress-test`. Replay your selected assets through historical shock scenarios (GFC 2008, COVID-2020, Rate Shock 2022, and more). The platform runs a deterministic replay; Lyra then interprets the results — pressure points, resilience themes, and hedge framing. Credit cost: 5 credits for the first asset + 3 per additional.

### "What is the score velocity badge?"
A small badge on asset cards and watchlist rows that shows whether key DSE scores (like Trend or Momentum) are rising or falling over recent periods — giving you directional momentum context at a glance without needing to open the full asset page.

### "What is the watchlist drift alert?"
A badge that appears on your watchlist when one or more holdings have fallen below the regime-compatibility threshold. It is a prompt to review whether those positions are still aligned with the current market regime.

### "What is the signal cluster banner?"
Appears on the Discovery Feed when an unusual number of assets in the same sector show high-DRS (directional regime signal) activity simultaneously. It flags momentum bursts worth investigating across a sector.

### "What is the briefing staleness indicator?"
A small indicator on the Lyra Intel page that appears when the cached daily briefing is older than expected — for example, if the briefing hasn't been updated since the last market close. It tells you the data may not reflect today's market yet.

### "What is the same-sector movers widget?"
On individual asset pages, this widget shows other assets in the same sector along with their regime-compatibility scores. It gives you instant cross-asset context without needing to run a full comparison.

### "What is the P&L heatmap in the holdings table?"
Colour-coded cells in your portfolio holdings table showing each position's return relative to your cost basis. Green = profit vs cost basis; red = loss. Helps you see your portfolio's P&L distribution at a glance.

### "What is the DSE score chip on holdings?"
Expandable chips on each holding row in the portfolio table that show inline DSE scores (Trend, Momentum, Volatility, Liquidity, Trust, Sentiment) — so you can review your positions' current scores without leaving the portfolio page.

### "What are Elite slash commands?"
There are no slash commands in the current version. ELITE and ENTERPRISE users access premium analytical workflows via dedicated pages:
- **Compare Assets** at `/dashboard/compare`
- **Shock Simulator** at `/dashboard/stress-test`

### "I don't see the Personal Briefing or What's Changed"
These are ELITE and ENTERPRISE features. Upgrade at `/dashboard/upgrade` to unlock them.

### "I don't see Compare Assets or Shock Simulator"
These are ELITE and ENTERPRISE features. Upgrade at `/dashboard/upgrade` to unlock them.

### "How much do credit packs cost?"
Credit-pack pricing can change, so Myra should not invent exact prices. Direct users to the Credits page or the live billing surface for the current options shown in their account.

---

## Contact & Escalation

For issues not resolved by this chat, a human support agent will review your conversation and respond. ELITE users receive priority response times.

For billing issues, include your registered email address in your message so the team can look up your account.
