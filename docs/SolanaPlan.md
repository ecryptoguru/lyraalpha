# SolanaPlan.md - LyraAlpha Solana Hackathon Build Plan

## 1. Goal

Rebuild LyraAlpha as a **Solana-native wallet intelligence product** using this repository as the base codebase, while deliberately cutting the parts that dilute the hackathon story.

The hackathon version is not:

- a generic crypto chatbot
- a support agent product
- a pricing and plan system
- a content/SEO/blog machine
- a US/India dual-market platform
- an enterprise finance platform

The hackathon version is:

> **Connect a Solana wallet, compute deterministic portfolio and token intelligence, then let Lyra explain the result in clear language.**

This keeps the strongest LyraAlpha principle intact:

> **The engines compute. The AI interprets.**

## 2. What We Are Cutting

The Solana hackathon build should remove or defer the following from the current repo narrative and product surface:

- Myra public support
- dashboard Myra support as a primary product story
- Blog / AMI pipeline
- pricing ladders
- credits / referrals / rewards as user-facing positioning
- Enterprise language
- compliance / investor-deck language
- US/India expansion narrative
- broad "crypto intelligence platform" framing

These can remain in the repo temporarily if removal is expensive, but they must not be part of the hackathon demo, landing page, pitch, or primary navigation.

## 3. Winning Product Thesis

### 3.1 Product Statement

**LyraAlpha Solana** is a Solana wallet intelligence copilot that turns raw wallet holdings, token exposures, protocol positions, and market regime context into a deterministic portfolio readout and scenario-driven decision support.

### 3.2 Core User

Primary user:

- active Solana retail user
- manages assets across spot tokens, staked SOL, LPs, lending positions, and high-volatility bets
- wants to understand wallet risk, exposure, concentration, and next steps without manually stitching together dashboards

Secondary user:

- hackathon judge who needs to understand the product in under 90 seconds

### 3.3 Core Job To Be Done

"Tell me what is happening inside my Solana wallet, where my risk really is, and how it behaves under stress."

### 3.4 The Sharp Wedge

The wedge is **wallet-connected deterministic intelligence**, not chat.

That means the core product loop is:

1. connect wallet
2. ingest holdings and protocol exposures
3. compute wallet health, fragility, concentration, liquidity exit risk, and regime fit
4. run one or more Solana-native scenarios
5. let Lyra interpret the computed results

If this loop is excellent, the product feels real. If this loop is weak, no amount of AI polish will save it.

## 4. Why This Can Win

### 4.1 What the Colosseum-style corpus implies

Adjacent projects already exist in the corpus:

- `daiko` - AI portfolio management with sell signals
- `stonksbot-ai` - AI token analytics and trading bot
- `bullbot` - AI market monitoring and copy trading
- `stratosfi` - AI sentiment platform

That means "AI for crypto analysis" is already crowded.

Winning patterns from the corpus point in a different direction:

- `unruggable` won by making Solana wallet UX and security feel native and tangible
- `tokamai` won by giving clear visibility into a painful hidden problem
- `cushion.trade` stood out by packaging structured portfolio/risk logic into a concrete product
- `kiwi` showed that wallet-native interaction and distribution surfaces matter

The implication for LyraAlpha Solana:

- lead with **wallet-native intelligence**
- show **real deterministic computation**
- preserve **user control**
- make the product feel like a **workflow**, not a prompt box

### 4.2 Product Principle From Archive Research

The archive signals around agent design point toward two useful constraints:

- preserve user control over final actions
- avoid invisible autonomous behavior

For this hackathon build, Lyra should recommend, explain, compare, and simulate, but not auto-trade.

## 5. Product Definition

## 5.1 One-line Pitch

**LyraAlpha Solana explains any Solana wallet like an institutional analyst: holdings, protocol exposure, risk concentration, liquidity exit risk, and scenario behavior.**

## 5.2 Demo Story

The live demo should answer this question:

**"What does this wallet actually own, what is the hidden risk, and what happens if Solana risk-off conditions hit?"**

The ideal demo flow:

1. open the app
2. connect Phantom or load a seeded demo wallet
3. show a wallet intelligence dashboard
4. surface one non-obvious finding
5. run a scenario
6. show Lyra's memo grounded in the computed output
7. compare the wallet to a benchmark or second wallet

## 5.3 MVP Product Surfaces

The Solana-first product should have these surfaces:

### A. Landing page

Purpose:

- explain one workflow
- connect wallet or open demo wallets
- avoid pricing, waitlist, support chat, blog, investor claims

### B. Wallet Intelligence Dashboard

Purpose:

- single source of truth for the connected wallet
- scorecards for health, fragility, liquidity exit risk, concentration, regime fit
- protocol exposure map
- top risk drivers

### C. Scenario Lab

Purpose:

- run deterministic shock simulations against the current wallet
- show expected pressure points and resilience pockets

### D. Compare Mode

Purpose:

- compare wallet vs wallet
- compare wallet vs benchmark archetype
- compare token vs token when needed

### E. Lyra Intel Panel

Purpose:

- explain the computed outputs
- answer portfolio-specific questions
- preserve explainability and user control

## 6. Award-Winning Feature Set

These are the features that should make the hackathon build feel meaningfully better than a generic AI crypto app.

## 6.1 P0 - Must Ship

### 1. Wallet connect plus seeded demo wallets

- Support Phantom first
- Add seeded demo wallets for judges in case wallet connection fails or is slow
- Demo wallets should represent clearly different profiles:
  - conservative SOL + stablecoin wallet
  - active DeFi yield wallet
  - high-volatility memecoin / concentrated wallet

Why this matters:

- instantly demoable
- avoids setup risk
- shows multiple portfolio archetypes

### 2. Deterministic Wallet Health Score

Compute a simple but defensible composite from:

- concentration
- liquidity quality
- stablecoin buffer
- protocol diversification
- drawdown sensitivity
- regime fit

Output:

- 0-100 score
- component breakdown
- what is helping
- what is hurting

### 3. Protocol Exposure Map

Parse the wallet into exposure buckets such as:

- SOL / liquid staking
- stablecoins
- majors
- high beta / memes
- LP positions
- lending / borrow
- perps / leveraged venues
- idle cash

Then map exposures to protocols:

- Jupiter
- Orca
- Raydium
- Meteora
- Marinade
- Kamino
- Drift
- Tensor or NFT exposure if supported

Why this matters:

- this is Solana-native
- it is immediately legible to judges
- it is difficult to fake with generic chat

### 4. Liquidity Exit Risk

For each material token or position, estimate:

- liquidity quality
- slippage sensitivity
- concentration in thin assets
- "how hard is it to de-risk this wallet quickly?"

Surface:

- wallet-level exit risk score
- per-position risk flags

### 5. Whale / Holder Concentration Flags

For held tokens, compute or proxy:

- top holder concentration
- suspicious ownership distribution
- governance or dump risk signals

Surface:

- token-level concentration warning
- wallet-level "hidden fragility" summary

### 6. Solana Scenario Lab

Ship 3-5 deterministic scenarios:

- SOL risk-off drawdown
- memecoin liquidity collapse
- stablecoin rotation into majors
- leverage unwind / forced deleveraging
- protocol-specific stress for lending / LP-heavy wallets

Each scenario should output:

- expected wallet impact range
- most vulnerable positions
- positions likely to cushion downside
- regime interpretation by Lyra

### 7. Lyra Decision Memo

A short memo generated only after the deterministic outputs are ready.

The memo should always answer:

- what the wallet is optimized for
- where the hidden risk is
- what changed under the chosen scenario
- one or two user-controlled next actions

### 8. Shareable Wallet Report

Generate a public share card or screenshot-ready report with:

- wallet archetype
- health score
- fragility score
- top exposures
- scenario result headline

Why this matters:

- demo amplification
- social proof
- easy for judges to remember

## 6.2 P1 - Strong Differentiators

### 9. Benchmark Wallet Comparison

Allow comparison against:

- SOL maximalist benchmark
- yield-focused benchmark
- balanced treasury benchmark
- high-risk degen benchmark

This avoids needing every comparison to be another real wallet.

### 10. Wallet Behavior Timeline

Show:

- major allocation shifts
- new protocol exposure entries
- sharp increases in concentration
- stablecoin depletion

Why this matters:

- turns the product into a narrative, not a static dashboard

### 11. Regime Alignment Bar

Reuse the idea from the current repo, but make it Solana-specific:

- is this wallet positioned for current conditions?
- is it leaning too far into beta, illiquidity, or leverage?

### 12. Watchlist / Alert Seeds

Not full push notifications yet, but at least:

- a drift warning
- a concentration warning
- a scenario sensitivity warning

## 6.3 P2 - Stretch Goals

### 13. Transaction Preview Intelligence

Given a proposed swap or rebalance:

- estimate change in wallet health
- estimate change in scenario exposure
- estimate liquidity improvement or deterioration

Important:

- this should remain approval-first
- no autonomous execution

### 14. Wallet-to-Wallet Cluster Comparison

Cluster demo wallets by style:

- yield
- beta
- stablecoin reserve
- concentrated conviction

Then tell the user which style they resemble.

### 15. Validator / Staking Quality Layer

For staked SOL:

- validator concentration
- staking distribution
- LST concentration

This can become a strong Solana-native differentiator if time permits.

## 7. Product Scope Guardrails

To keep this award-worthy, we should explicitly avoid:

- broad multi-chain support
- generic chat as the main interaction
- token trading bot behavior
- enterprise dashboards
- internal admin tools as demo material
- referral mechanics
- heavy billing / plan gating flows
- a large content surface

## 8. Technical Strategy

## 8.1 Keep vs Replace

### Keep and reuse from this repo

- Next.js 16 App Router shell
- dashboard layout and UI primitives
- Prisma and Redis infrastructure
- existing AI runtime, guardrails, caching, and streaming
- portfolio engines as starting points for deterministic scoring
- scenario engine patterns
- Lyra prompt pipeline and service structure
- charting and dashboard component patterns
- testing setup with Vitest and Playwright

### Replace or reframe

- region logic
- stock/broker framing
- Myra surfaces
- credits / pricing language
- blog and marketing routes
- public waitlist-style landing structure

## 8.2 Recommended New Dependencies

Add:

- `@solana/web3.js`
- `@solana/wallet-adapter-base`
- `@solana/wallet-adapter-react`
- `@solana/wallet-adapter-react-ui`
- `@solana/wallet-adapter-wallets`
- `bs58`

Optional:

- Helius SDK or plain RPC client wrappers
- Jupiter price / token APIs via fetch wrappers
- Birdeye or DexScreener adapter for liquidity metrics

## 8.3 Solana Data Providers

Primary recommendation:

- **Helius** for wallet holdings, token accounts, transaction history, and account enrichment

Supporting providers:

- **Jupiter** for token metadata / price context
- **Birdeye or DexScreener** for liquidity and volume context
- **DefiLlama or protocol adapters** for protocol TVL and venue context where useful

MVP rule:

- one primary wallet/indexing provider
- one price/liquidity provider
- avoid provider sprawl

## 9. Target Architecture

## 9.1 Identity and Session Model

For hackathon MVP:

- wallet-first guest mode
- no requirement for Clerk-based sign-up in the main flow
- wallet address is the primary user identity
- optionally persist snapshots keyed by wallet address plus session cookie

Practical approach:

- connect wallet client-side
- send wallet address to APIs for read-only intelligence
- add signed message verification only if persistent saved dashboards are needed

This keeps the build fast and the demo clean.

## 9.2 Data Flow

1. user connects wallet or chooses seeded demo wallet
2. `/api/solana/wallet/[address]/snapshot` fetches holdings and exposures
3. normalization layer resolves tokens, protocols, staking, LP, and borrow positions
4. deterministic engines compute wallet scores
5. results are cached
6. Lyra consumes structured context from the computed output
7. scenario lab reuses the same snapshot and runs deterministic stress logic
8. compare mode reuses normalized snapshots from two wallets or wallet plus benchmark

## 9.3 Deterministic Engine Stack

The Solana build should introduce or adapt the following engines:

### Wallet Health Engine

Inputs:

- token weights
- stablecoin share
- protocol spread
- volatility mix
- liquidity profile

Outputs:

- health score
- component weights
- top positives
- top negatives

### Wallet Fragility Engine

Inputs:

- concentration
- exposure to illiquid tokens
- correlated bets
- protocol concentration
- leverage exposure

Outputs:

- fragility score
- hidden concentration flags
- correlated failure risks

### Liquidity Exit Engine

Inputs:

- liquidity depth proxies
- recent volume
- token size relative to likely exit capacity

Outputs:

- exit risk score
- position-level liquidity flags

### Regime Engine

Inputs:

- SOL trend
- market breadth
- majors vs memes rotation
- stablecoin share / risk-on indicators
- volatility conditions

Outputs:

- current regime label
- regime confidence
- wallet regime fit

### Scenario Engine

Inputs:

- normalized wallet exposures
- scenario templates
- regime context

Outputs:

- estimated wallet drawdown band
- most affected positions
- mitigating positions

## 9.4 Lyra AI Layer

Lyra must remain interpretation-first.

Lyra should receive:

- wallet snapshot summary
- score outputs
- scenario result payloads
- token and protocol evidence
- optional recent market context

Lyra should not:

- fabricate token data
- make unsupported price claims
- act like a trading bot
- obscure whether a conclusion came from deterministic output or model inference

## 10. Repo-Aware Implementation Map

## 10.1 Existing Pages To Repurpose

Use these as the starting product shell:

- `src/app/dashboard/page.tsx`
- `src/app/dashboard/portfolio/page.tsx`
- `src/app/dashboard/compare/page.tsx`
- `src/app/dashboard/stress-test/page.tsx`
- `src/app/dashboard/lyra/page.tsx`
- `src/app/dashboard/assets/[symbol]/page.tsx` if retained

Repurpose them to:

- dashboard home -> Solana wallet overview
- portfolio -> wallet intelligence workspace
- compare -> wallet/token compare
- stress-test -> scenario lab
- lyra -> ask Lyra about the connected wallet

## 10.2 Existing Engine Modules To Reuse

Start from:

- `src/lib/engines/portfolio-health.ts`
- `src/lib/engines/portfolio-fragility.ts`
- `src/lib/engines/portfolio-intelligence.ts`
- `src/lib/engines/portfolio-monte-carlo.ts`
- `src/lib/engines/scenario-engine.ts`
- `src/lib/engines/market-regime.ts`
- `src/lib/engines/multi-horizon-regime.ts`
- `src/lib/engines/score-dynamics.ts`
- `src/lib/engines/crypto-intelligence.ts`

These should be adapted to Solana wallet semantics rather than discarded.

## 10.3 Existing Service Modules To Reuse

Useful starting points:

- `src/lib/services/portfolio.service.ts`
- `src/lib/services/asset.service.ts`
- `src/lib/services/dashboard.service.ts`
- `src/lib/services/dashboard-home.service.ts`
- `src/lib/services/intelligence-events.service.ts`
- `src/lib/services/gecko-terminal.service.ts`
- `src/lib/services/defillama.service.ts`
- `src/lib/services/coingecko.service.ts`
- `src/lib/services/lyra.service.ts`

Add new service wrappers for:

- Helius wallet snapshot retrieval
- Jupiter token metadata / prices
- liquidity provider integration
- protocol exposure normalization

## 10.4 Existing AI Modules To Reuse

Keep:

- `src/lib/ai/service.ts`
- `src/lib/ai/context-builder.ts`
- `src/lib/ai/query-classifier.ts`
- `src/lib/ai/rag.ts`
- `src/lib/ai/guardrails.ts`
- `src/lib/ai/prompts/system.ts`
- `src/lib/ai/prompts/modules.ts`
- `src/lib/ai/output-validation.ts`

Change:

- remove support-oriented prompt branches from the core story
- rewrite knowledge modules around Solana wallet analysis
- simplify plan-aware routing for hackathon mode

## 10.5 Existing Components To Reuse

High-value starting points:

- `src/components/portfolio/portfolio-intelligence-hero.tsx`
- `src/components/portfolio/portfolio-health-meter.tsx`
- `src/components/portfolio/portfolio-fragility-card.tsx`
- `src/components/portfolio/portfolio-regime-alignment-bar.tsx`
- `src/components/portfolio/portfolio-drawdown-estimate.tsx`
- `src/components/portfolio/portfolio-decision-memo-card.tsx`
- `src/components/dashboard/market-regime-card.tsx`
- `src/components/dashboard/share-insight-button.tsx`
- `src/components/dashboard/same-sector-movers.tsx`
- `src/components/lyra/*`

Remove or hide from the demo:

- `src/components/landing/public-myra-widget.tsx`
- `src/components/landing/BlogPreview.tsx`
- `src/components/dashboard/live-chat-*` if Myra is not retained
- pricing / trial / referral / rewards components

## 11. New Modules To Add

Recommended new files:

- `src/lib/solana/rpc.ts`
- `src/lib/solana/wallet-snapshot.ts`
- `src/lib/solana/token-metadata.ts`
- `src/lib/solana/protocol-exposure.ts`
- `src/lib/solana/liquidity-risk.ts`
- `src/lib/solana/demo-wallets.ts`
- `src/lib/engines/wallet-health-solana.ts`
- `src/lib/engines/wallet-fragility-solana.ts`
- `src/lib/engines/wallet-regime-fit-solana.ts`
- `src/lib/engines/scenario-engine-solana.ts`
- `src/lib/services/solana-wallet.service.ts`
- `src/lib/services/solana-scenario.service.ts`

Recommended new routes:

- `src/app/api/solana/wallet/[address]/snapshot/route.ts`
- `src/app/api/solana/wallet/[address]/intelligence/route.ts`
- `src/app/api/solana/wallet/[address]/scenario/route.ts`
- `src/app/api/solana/compare/route.ts`
- `src/app/api/solana/demo-wallets/route.ts`

Recommended new UI:

- `src/components/solana/wallet-connect-button.tsx`
- `src/components/solana/wallet-overview-card.tsx`
- `src/components/solana/protocol-exposure-map.tsx`
- `src/components/solana/liquidity-exit-risk-card.tsx`
- `src/components/solana/holder-concentration-card.tsx`
- `src/components/solana/scenario-results-card.tsx`
- `src/components/solana/demo-wallet-picker.tsx`

## 12. Data Model Changes

Add or adapt Prisma models for:

### `SolanaWallet`

- `address`
- `label`
- `source`
- `lastSyncedAt`

### `WalletSnapshot`

- `walletId`
- `nativeSolBalance`
- `stablecoinValueUsd`
- `totalValueUsd`
- `snapshotJson`

### `WalletHolding`

- `walletSnapshotId`
- `mint`
- `symbol`
- `amount`
- `priceUsd`
- `valueUsd`
- `bucket`
- `liquidityScore`
- `holderConcentrationScore`

### `ProtocolExposure`

- `walletSnapshotId`
- `protocol`
- `category`
- `valueUsd`
- `riskFlags`

### `WalletScenarioResult`

- `walletSnapshotId`
- `scenarioKey`
- `expectedImpact`
- `resultJson`

For the hackathon, these can be sparse and JSON-heavy. Favor speed over overly normalized schema design.

## 13. Build Phases

## Phase 0 - Product carve-out

Objective:

- strip the current app to a Solana-first story

Tasks:

- remove Myra public support from the landing page
- hide blog, pricing, rewards, upgrade, referrals, waitlist-first messaging
- remove region toggle from primary UX
- reduce main nav to:
  - Dashboard
  - Wallet
  - Compare
  - Scenario Lab
  - Lyra

Deliverable:

- clean product shell that already looks like a focused Solana app

## Phase 1 - Wallet ingestion

Objective:

- get real or seeded Solana wallet data into the app

Tasks:

- add wallet connection UI
- create demo wallet picker
- implement wallet snapshot service using Helius
- normalize SPL holdings
- identify core protocol exposures
- cache snapshot responses

Deliverable:

- dashboard can load a wallet and render real structured data

## Phase 2 - Deterministic intelligence layer

Objective:

- compute meaningful wallet scores

Tasks:

- build wallet health engine
- build fragility engine
- build liquidity exit engine
- build regime fit engine
- build token concentration flags
- define benchmark archetypes

Deliverable:

- wallet dashboard shows defensible scores and explanations before Lyra is involved

## Phase 3 - Scenario Lab

Objective:

- make the product feel premium and interactive

Tasks:

- define 3-5 Solana-native scenario templates
- implement deterministic scenario engine
- compute wallet impact and top risk drivers
- render scenario results visually

Deliverable:

- Scenario Lab becomes the demo centerpiece

## Phase 4 - Lyra adaptation

Objective:

- make Lyra explain computed outputs, not improvise

Tasks:

- rewrite prompt modules around wallet intelligence
- add Solana-specific context builder inputs
- reduce or remove plan-tier logic for hackathon mode
- feed scenario outputs into the decision memo generator
- ensure output contract is short, sharp, and evidence-based

Deliverable:

- Lyra generates high-signal wallet memos and answers follow-ups

## Phase 5 - Compare and shareability

Objective:

- make the product memorable and easy to judge

Tasks:

- add wallet vs wallet compare
- add wallet vs benchmark compare
- add shareable report / screenshot flow
- add archetype labeling

Deliverable:

- judges can compare two wallets and immediately understand the differentiation

## Phase 6 - Polish, speed, and demo hardening

Objective:

- remove demo risk

Tasks:

- cache wallet snapshots and scenario results
- add empty/loading/error states
- seed demo wallets in the repo
- add Playwright smoke path for demo flow
- test on mobile width and desktop
- make the landing page and dashboard visually sharp but restrained

Deliverable:

- stable, rehearsable demo

## 14. Suggested 72-Hour Hackathon Schedule

### Day 1

- carve out the product shell
- add wallet connect and seeded demo wallets
- implement snapshot normalization

### Day 2

- build deterministic wallet engines
- render dashboard cards
- implement scenario templates

### Day 3

- adapt Lyra prompts and memo flow
- add compare mode
- add shareable report
- rehearse demo and trim everything non-essential

## 15. UX Direction

The design should feel:

- Solana-native
- analytical
- fast
- intentional
- premium without looking like a finance SaaS template

Visual direction:

- dark, high-contrast dashboard is acceptable if done well
- use emerald, electric cyan, and warm amber sparingly for status and risk cues
- large typography for the wallet thesis and scenario outcomes
- avoid cluttered tables as the primary hero
- favor exposure maps, score blocks, and high-signal cards

The first screen after wallet connection should answer:

- total wallet value
- what the wallet is actually optimized for
- biggest hidden risk
- current regime fit

## 16. Demo Script

The final demo should be rehearsed around this exact sequence:

1. "This is not a chat bot. It is a Solana wallet intelligence engine."
2. connect wallet or open demo wallet
3. show deterministic wallet breakdown
4. highlight one hidden risk the user would not easily see elsewhere
5. open Scenario Lab and run a stress case
6. show how the wallet outcome changes
7. open Lyra memo and explain the result
8. compare against a safer or riskier benchmark
9. end on a shareable report card

Target demo length:

- 2.5 to 4 minutes

## 17. Judging Strategy

Target categories:

- Consumer
- AI
- DeFi if the portfolio/simulation layer is strong enough

Primary judging message:

- real Solana user problem
- real wallet-native data
- deterministic intelligence, not chat theater
- clear workflow and clear differentiation

What judges should remember:

- "This is what Nansen, portfolio analytics, and an AI copilot look like when rebuilt around one Solana wallet workflow."

## 18. Success Criteria

The hackathon build is successful if:

- a wallet can be connected or loaded instantly
- the app computes deterministic scores from wallet data
- the app surfaces at least one non-obvious insight
- the scenario lab produces believable output
- Lyra explains results using computed context
- the product can be demoed end to end without mentioning pricing, support, blog, or enterprise

## 19. Definition of Done

The Solana hackathon version is done when all of the following are true:

- landing page is Solana-first
- public Myra support is gone from the story
- blog / AMI surfaces are hidden from the demo path
- region and pricing language are out of the primary UX
- wallet dashboard works with live or demo data
- scenario lab works
- compare mode works
- Lyra memo works
- seeded demo wallets exist
- one-click demo path is stable

## 20. Final Recommendation

Do not ship "all of LyraAlpha."

Ship the smallest version that makes this claim undeniably true:

> **LyraAlpha Solana can inspect a Solana wallet, compute its hidden risk, and explain how it behaves under stress better than a generic AI crypto tool.**

That is a credible hackathon wedge, a strong demo, and a build that this repo can support without fighting its existing architecture.

## 21. Research Anchors

These references informed the scope and feature choices above.

### Adjacent AI overlap to avoid

- `daiko` - Breakout - April 14, 2025 - 4th Place in AI
- `stonksbot-ai` - Renaissance - March 4, 2024 - Honorable Mention in DeFi & Payments
- `bullbot` - Renaissance - March 4, 2024 - Honorable Mention in DeFi & Payments
- `stratosfi` - Breakout - April 14, 2025 - adjacent sentiment/intelligence pattern

Takeaway:

- "AI crypto copilot" on its own is not enough

### Winning patterns to emulate

- `unruggable` - Breakout - April 14, 2025 - 3rd Place in Infrastructure
- `unruggable` - Cypherpunk - September 25, 2025 - Grand Prize
- `tokamai` - Radar - September 2, 2024 - 2nd Place in Infrastructure
- `cushion.trade` - Breakout - April 14, 2025 - Honorable Mention in DeFi
- `kiwi` - Radar - September 2, 2024 - Honorable Mention in DeFi

Takeaway:

- wallet-native UX
- risk visibility
- structured portfolio logic
- clear workflow over broad platform sprawl

### Archive principles

- `Agency by design: Preserving user control in a post-interface world` - a16z crypto - December 9, 2025
- `Request For Products` - Colosseum Blog - September 22, 2025

Takeaway:

- user control matters
- approval-first product behavior is stronger than invisible autonomy
