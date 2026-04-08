# US Broker Integration — Production Blueprint

> The US layer is the global expansion path. The right strategy is not broker-by-broker chaos — it is an aggregation-first architecture with one direct broker path for power users.

---

## Core strategy

```text
US Portfolio Input
 ├── Plaid (aggregation layer)  ← broad coverage, read-only, OAuth consent
 ├── Alpaca (direct brokerage)   ← real-time state, trading, webhooks
 ├── CSV / statements            ← fallback intake
         ↓
Unified Portfolio Normalization Engine
         ↓
InsightAlpha Intelligence Layer
```

### Why this split works

- **Plaid** gives the widest coverage across US retail institutions.
- **Alpaca** gives a real-time direct brokerage path for power users and active traders.
- Both collapse into the same internal broker schema defined in `src/lib/types/broker.ts`.
- The portfolio intelligence engines never care where the data came from — only that it is normalized, deduped, and validated.

---

## Ranked US integration matrix

| Rank | Provider | Phase | Access model | Primary value | Production notes |
|------|----------|-------|--------------|---------------|-----------------|
| 1 | **Plaid** | Phase 1 | OAuth / aggregation | Broad read-only coverage | Best first US connector. Covers major retail brokers via consented aggregation. Sync every 6–12 hours. |
| 2 | **Alpaca** | Phase 1 | API key / direct brokerage | Real-time direct portfolio state | Best direct brokerage layer for active users, webhooks, and trading-enabled features. |

### Plaid coverage note
Plaid is the **coverage layer**, not the execution layer. It is the fastest way to unlock user portfolio import because it consolidates positions and transactions from institutions like Robinhood, Fidelity, Schwab, E*TRADE, and TD Ameritrade when supported by the connected institution.

### Alpaca coverage note
Alpaca is the **power-user layer**. It should be treated as the canonical direct brokerage path for users who want real-time updates, open positions, and trading-aware portfolio state.

---

## Connector-by-connector implementation plan

### Phase 1 — production core

#### 1. Plaid connector

**Goal:** retrieve holdings, positions, balances, and transactions with the least friction.

**Auth flow:**
```text
1. Backend creates Link token
2. Frontend opens Plaid Link
3. User consents to broker aggregation
4. Backend exchanges public token for access token
5. Sync investments and transaction data
```

**Implementation steps:**
- Create Link token with `products: ["investments"]`
- Exchange the public token server-side only
- Store access token encrypted in the vault / secrets store
- Fetch holdings and investments transactions on a background sync schedule
- Normalize holdings into `BrokerHolding`
- Normalize accounts into `BrokerAccount`
- Store raw Plaid responses in `sourcePayloads`

**Normalization rules:**
- Prefer security identifiers when available
- Map instrument names and symbols into the canonical `BrokerInstrumentIdentity`
- Use the connected institution’s security metadata to resolve ISIN / CUSIP / ticker equivalents where possible
- Retain unsupported fields in `raw` so future normalizers can reprocess them

**Operational characteristics:**
- Read-only
- Consent-based
- Delayed, not real-time
- Best for broad coverage and onboarding conversion

---

#### 2. Alpaca connector

**Goal:** provide a direct brokerage integration for real-time portfolio state.

**Auth flow:**
```text
1. User connects Alpaca account
2. Backend stores API key / secret securely
3. Fetch positions, account balances, and trades
4. Subscribe to webhooks / streaming events
```

**Implementation steps:**
- Build a brokerage auth wrapper around API key / secret or OAuth-style partner auth if required
- Fetch positions and account details on initial sync
- Support webhooks for trade events and account changes
- Use Alpaca as the direct source of truth for real-time holdings when connected
- Fall back to polling for environments without webhook support

**Normalization rules:**
- `symbol` → `BrokerInstrumentIdentity.symbol`
- `asset_class` → `BrokerAssetClass`
- `exchange` / venue fields → `BrokerInstrumentIdentity.exchange`
- `qty`, `avg_entry_price`, `market_value` → canonical quantity / averagePrice / marketValue

**Operational characteristics:**
- Real-time capable
- Trading-enabled
- Best for high-intent and active users

---

## Unified normalization layer

US and India must share the same canonical output shape.

### Canonical output
- `BrokerSourceReference`
- `BrokerInstrumentIdentity`
- `BrokerHolding`
- `BrokerPosition`
- `BrokerTransaction`
- `BrokerCashBalance`
- `BrokerAccount`
- `BrokerPortfolioSnapshot`
- `BrokerNormalizationResult`

### Key mapping rules

#### Plaid
- `security_id` / security metadata → instrument identity
- `quantity` → holding quantity
- `cost_basis` / `price` → average price when available
- `institution_price` / current price → market price
- transaction history → canonical transactions

#### Alpaca
- `symbol` → symbol
- `asset_class` / `asset_class` equivalent → asset class
- `exchange` → exchange
- `qty` → quantity
- `avg_entry_price` → average price
- `market_value` → market value
- `unrealized_pl` → unrealized P&L

### Deduplication rule

When both Plaid and Alpaca report the same instrument:
- Prefer the **direct broker** as the active source of truth for quantity and price if Alpaca is live
- Keep Plaid as the breadth layer for missing transactions, balances, or institution coverage
- Merge by ISIN first, then by `symbol + exchange`
- Use weighted average cost basis and summed quantities
- Keep all source references for auditability

---

## Security architecture

This is non-negotiable for US connectivity.

### Required controls
- Encrypt access tokens at rest
- Store secrets in a vault or cloud secret manager
- Never expose API keys or refresh tokens to the frontend
- Use short-lived access tokens where possible
- Rotate secrets on schedule
- Log only metadata, never raw secrets

### Plaid-specific controls
- Public token exchange must happen only on the backend
- Link tokens should be single-use and short-lived
- Any re-authentication should be initiated from the backend state machine

### Alpaca-specific controls
- Never store key/secret in localStorage
- Treat streaming and webhook signatures as untrusted until verified
- Separate paper and live accounts by environment

---

## Data sync strategy

| Source | Sync pattern | Suggested interval |
|--------|--------------|--------------------|
| Plaid | Periodic polling | 6–12 hours |
| Alpaca | Webhook / streaming first, polling fallback | Near real-time |
| CSV / manual | User-triggered | On demand |

### Sync lifecycle
```text
Connect
↓
Authenticate
↓
Fetch raw payloads
↓
Normalize
↓
Validate with Zod
↓
Dedup across providers
↓
Persist snapshot
↓
Invalidate portfolio caches
↓
Feed intelligence engines
```

---

## API contract to the rest of the app

Once normalized, US portfolio data should feed the same internal surfaces as India:

- portfolio health snapshot
- fragility diagnostics
- Monte Carlo simulation
- unified portfolio score
- dashboard preview cards
- share sheets and alert summaries

That means the dashboard and intelligence layer only ever see a single canonical schema, regardless of whether the user connected Plaid, Alpaca, or uploaded a CSV.

---

## Execution order

1. **Plaid connector** — unlock coverage fast
2. **Normalization engine** — reuse the India contract, no branching
3. **Alpaca connector** — enable direct real-time brokerage
4. **Webhook / polling orchestration** — keep state fresh
5. **CSV / manual fallback** — ensure 100% onboarding coverage

---

## Implementation files

| Path | Purpose |
|------|---------|
| `src/lib/types/broker.ts` | Shared broker types, US provider entries, connector interface, dedup types |
| `src/lib/schemas.ts` | Zod validation for broker payloads and normalization results |
| `src/lib/connectors/plaid.ts` | Plaid aggregation adapter |
| `src/lib/connectors/alpaca.ts` | Alpaca direct brokerage adapter |
| Planned broker sync orchestrator | Sync orchestration, persistence, cache invalidation |
| Planned broker dedup layer | Cross-provider merge and deduplication |

---

## The rule for US expansion

Do **not** build broker-by-broker custom business logic in the UI or intelligence layer.

Everything must flow through the same canonical broker normalization contract so the product behaves as one system, not two separate India/US codepaths.
