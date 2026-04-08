# Universal Portfolio Import Architecture — Production Blueprint

> The portfolio data layer is the primary moat. Competitors fail here due to poor normalization, missing raw-payload retention, and no cross-broker deduplication. This document is the authoritative execution reference.

---

## System overview

```text
User Portfolio Input
 ├── Broker API Connector  (Phase 1 → Phase 2 → Phase 3)
 ├── CAS Statement Import  (PDF / CAMS / KFintech)
 ├── CSV Upload            (ticker, qty, avg price)
 └── Manual Entry          (UI fallback)
         ↓
Portfolio Normalization Engine
 ├── Raw payload retention (reprocess, audit)
 ├── ISIN-first instrument resolution
 ├── Cross-broker deduplication
 └── Confidence scoring
         ↓
Unified Portfolio Schema  (src/lib/types/broker.ts)
         ↓
LyraAlpha Intelligence Engines
 ├── Health engine        (portfolio-health.ts)
 ├── Fragility engine     (portfolio-fragility.ts)
 ├── Monte Carlo engine   (portfolio-monte-carlo.ts)
 └── Intelligence engine  (portfolio-intelligence.ts)
         ↓
AI Insights + Dashboard + Share
```

---

## Ranked Indian Broker Integration Matrix

Ordered by **production leverage**: API maturity × expected retail coverage × onboarding friction.

| Rank | Broker | Phase | Access model | Auth mechanism | Scope | Production notes |
|------|--------|-------|-------------|----------------|-------|-----------------|
| 1 | **Zerodha** | Phase 1 | Public API | Kite Connect login → request_token → session (paid dev subscription) | Holdings, positions, orders, transactions, balances | Highest leverage. Mature docs, strong ecosystem. Build first. |
| 2 | **Upstox** | Phase 1 | Public API | OAuth 2.0 PKCE → access_token + refresh_token | Holdings, positions, orders, transactions, balances | Clean REST v3 surface. Strong second connector for retail coverage. |
| 3 | **Angel One** | Phase 1 | Public API | SmartAPI: TOTP + client code → JWT session | Holdings, positions, orders, transactions, balances | High retail relevance. Good production fit for portfolio-level sync. |
| 4 | **Dhan** | Phase 1 | Public API | DhanHQ v2: long-lived access token from developer portal | Holdings, positions, orders, transactions, balances | Clean API surface with dedicated holdings/positions endpoints. |
| 5 | **FYERS** | Phase 1 | Public API | API Connect: auth code + TOTP → access token (app_id + secret) | Holdings, positions, orders, transactions, balances | Strong trading/portfolio primitives. Good complement to first four. |
| 6 | **Groww** | Phase 2 | Public API | Portfolio/positions API. Verify partner onboarding and access policy. | Holdings, positions, orders, transactions, balances | Highest user-base relevance for MF + stocks. High-value Phase 2 target. |
| 7 | **ICICI Direct** | Phase 2 | Partner API | Breeze Connect / iCICIdirect Open API: API key + session token | Holdings, positions, orders, transactions, balances | Strong brand trust. Expect compliance friction and onboarding lead time. |
| 8 | **Kotak Neo** | Phase 2 | SDK | Neo API / Python SDK: OTP login → session token (consumer key + secret) | Holdings, positions, orders, transactions, balances | Good banking-brand coverage. Add once core adapters are proven. |
| 9 | **5paisa** | Phase 2 | Public API | Xstream / developer API: API key + JWT login | Holdings, positions, orders, transactions, balances | Good retail breadth. Auth + SDK setup needs careful environment testing. |
| 10 | **Motilal Oswal** | Phase 2 | Partner API | MO API portal: partner onboarding approval required | Holdings, positions, orders, transactions, balances | Valuable for coverage breadth. Add after core set is proven. |
| 11 | **Shoonya (Finvasia)** | Phase 3 | Public API | NorenApi: SHA-256 password hash + TOTP | Holdings, positions, orders, transactions, balances | Active developer community. Good long-tail for cost-conscious traders. |
| 12 | **Alice Blue** | Phase 3 | Public API | ANT+ API / OpenAPI: client credentials → session | Holdings, positions, orders, transactions, balances | Niche but active user base. Add as secondary once Phase 1–2 are live. |
| 13 | **HDFC Securities** | Fallback | Partner API | Formal partner agreement required. Limited public docs. | Holdings, positions, orders, transactions, balances | High brand trust, high friction. Defer until partner capacity allows. |
| 14 | **Axis Direct** | Fallback | Partner API | Formal partner approval process required. | Holdings, positions, orders, transactions, balances | Meaningful banking-brokerage segment. Keep as fallback until path clears. |

---

## Connector-by-Connector Implementation Plan

### Phase 1 — Core production adapters

Build these five first. They deliver the best mix of API maturity, documentation quality, and retail coverage.

#### 1. Zerodha connector (`src/lib/connectors/zerodha.ts`)

**Auth flow:**
```
GET /connect/login?api_key=…&v=3          → redirect to Kite login page
GET /callback?request_token=…             → capture request_token
POST /session/token { api_key, request_token, checksum }  → access_token
```

**Fetch sequence:**
1. `GET /portfolio/holdings` → raw holdings array
2. `GET /portfolio/positions` → day + net positions
3. `GET /orders` → order history
4. `GET /margins` → cash balances

**Normalization targets:**
- `tradingsymbol` + `exchange` → `BrokerInstrumentIdentity.symbol` + `exchange`
- `isin` (where present) → `BrokerInstrumentIdentity.isin` (ISIN-first keying)
- `t1_quantity` + `quantity` → `BrokerHolding.quantity`
- `average_price` → `BrokerHolding.averagePrice`
- `last_price` → `BrokerHolding.marketPrice`
- `pnl` → `BrokerHolding.unrealizedPnl`

**Error handling:**
- Token expiry → catch 403, surface `auth_required` to UI
- Market hours edge cases → buffer `t1_quantity` separately in `raw`
- Rate limits → exponential backoff with jitter, max 3 retries

---

#### 2. Upstox connector (`src/lib/connectors/upstox.ts`)

**Auth flow:**
```
GET /v2/login/authorization/dialog?response_type=code&client_id=…&redirect_uri=…
POST /v2/login/authorization/token { code, client_id, client_secret, redirect_uri, grant_type }
→ access_token (1-day TTL) + refresh_token
```

**Fetch sequence:**
1. `GET /v2/portfolio/long-term-holdings` → delivery holdings
2. `GET /v2/portfolio/short-term-positions` → intraday positions
3. `GET /v2/charges/historical-charges/{from}/{to}` → transaction history

**Normalization targets:**
- `instrument_token` → retain in `raw`; resolve symbol via `GET /v2/market-quote/ltp`
- `isin` → `BrokerInstrumentIdentity.isin`
- `quantity` / `t1_quantity` → `BrokerHolding.quantity`
- `average_price` → `BrokerHolding.averagePrice`
- `last_price` → `BrokerHolding.marketPrice`

---

#### 3. Angel One connector (`src/lib/connectors/angel-one.ts`)

**Auth flow:**
```
POST /rest/auth/angelbroking/user/v1/loginByPassword
  { clientcode, password, totp }
→ jwtToken + refreshToken
```

**Fetch sequence:**
1. `GET /rest/secure/angelbroking/portfolio/v1/getHolding` → holdings
2. `GET /rest/secure/angelbroking/order/v1/getPosition` → positions
3. `GET /rest/secure/angelbroking/order/v1/getTradeBook` → trades

**Normalization targets:**
- `symbolname` + `exchange` → instrument identity
- `isin` → ISIN-first keying
- `quantity` / `t1qty` → quantity
- `averagenetprice` → averagePrice
- `ltp` → marketPrice

---

#### 4. Dhan connector (`src/lib/connectors/dhan.ts`)

**Auth flow:**
```
Access token issued from DhanHQ developer portal.
Token is long-lived (user-scoped). Store encrypted; no refresh endpoint.
```

**Fetch sequence:**
1. `GET /v2/portfolio` → holdings + positions
2. `GET /v2/fundlimit` → cash balances
3. `GET /v2/tradebook` → trade history

**Normalization targets:**
- `tradingSymbol` + `exchangeSegment` → instrument identity
- `isin` → ISIN-first keying
- `totalQty` / `drQty` → quantity (split delivery vs. T+1)
- `avgCostPrice` → averagePrice
- `lastTradedPrice` → marketPrice

---

#### 5. FYERS connector (`src/lib/connectors/fyers.ts`)

**Auth flow:**
```
GET /api/v3/generate-authcode?client_id=…&redirect_uri=…&response_type=code&state=…
POST /api/v3/validate-authcode { grant_type, appIdHash, code }
→ access_token (1-day TTL)
```

**Fetch sequence:**
1. `GET /api/v3/holdings` → long-term holdings
2. `GET /api/v3/positions` → intraday positions
3. `GET /api/v3/tradebook` → trade book

**Normalization targets:**
- `symbol` (format: `NSE:INFY-EQ`) → split to exchange + symbol
- `isin` → ISIN-first keying
- `quantity` / `remainingQuantity` → quantity
- `costPrice` / `buyAvg` → averagePrice
- `ltp` → marketPrice

---

### Phase 2 — Coverage expansion

Add after all Phase 1 connectors are in production and passing integration tests.

#### 6. Groww connector (`src/lib/connectors/groww.ts`)
- Groww API portal provides portfolio and positions endpoints
- Verify partner onboarding requirements before writing auth flow
- Expected surface: `GET /v1/portfolio/holdings`, `GET /v1/portfolio/positions`
- High priority: largest MF + stock retail user base

#### 7. ICICI Direct / Breeze connector (`src/lib/connectors/icici-direct.ts`)
- Breeze Connect API: API key + session token via `POST /session`
- Expect formal partner agreement and compliance review
- Surface: holdings, positions, orders, transaction history
- High brand-trust value once onboarding friction is cleared

#### 8. Kotak Neo connector (`src/lib/connectors/kotak-neo.ts`)
- Neo API Python SDK: consumer key + secret → OTP login → session token
- Wrap SDK in a Node.js subprocess or use REST endpoints directly
- Surface: holdings, positions, orders

#### 9. 5paisa connector (`src/lib/connectors/five-paisa.ts`)
- Xstream API: API key + client code + TOTP → JWT
- Verify SDK version and environment compatibility before production
- Surface: holdings, positions, orders, feeds

#### 10. Motilal Oswal connector (`src/lib/connectors/motilal-oswal.ts`)
- MO API portal: partner onboarding required
- Token-based session once approved
- Surface: holdings, positions, orders, market data

---

### Phase 3 — Long-tail connectors

#### 11. Shoonya (Finvasia) (`src/lib/connectors/shoonya.ts`)
- NorenApi: SHA-256(password + TOTP) login → session token
- Python/JS client libraries available; wrap in adapter
- Zero brokerage, active developer community

#### 12. Alice Blue (`src/lib/connectors/alice-blue.ts`)
- ANT+ API / OpenAPI: client credentials → session token
- Developer registration required
- Add as secondary source post Phase 2

---

### Fallback connectors

#### 13. HDFC Securities — deferred
- Formal partner agreement required; no public API docs
- Keep as fallback; revisit when compliance capacity allows

#### 14. Axis Direct — deferred
- Partner-gated access; approval process required
- Meaningful segment; unblock via business development path

---

### Non-API intake (always available)

These must exist from day one as the universal fallback:

- **CAS statement import** — CAMS / KFintech PDF via hybrid regex + LLM parser (`updates/parsing.md`)
- **CSV upload** — `Ticker,Quantity,AvgPrice` with auto column mapping
- **Contract note / broker statement PDF** — OCR + structured extraction
- **Manual entry** — UI form with symbol search and lot entry

---

## Normalized Broker Payload Contract

Every connector must produce a `BrokerNormalizationResult` before the intelligence layer sees any data. Raw payloads must never leak beyond the adapter boundary.

### Canonical entities (all defined in `src/lib/types/broker.ts`)

```
BrokerSourceReference     — provider, region, accountId, fetchedAt, rawRef
BrokerInstrumentIdentity  — symbol, name, isin, exchange, currency, assetClass
BrokerHolding             — quantity, averagePrice, marketPrice, unrealizedPnl, confidence
BrokerPosition            — side, overnight qty, leverage, margin, day change
BrokerTransaction         — type, qty, price, amount, tradeDate, settlementDate, fees
BrokerCashBalance         — available, settled, marginUsed, blocked, asOf
BrokerAccount             — displayName, type, currency, portfolioValue, buyingPower
BrokerPortfolioSnapshot   — aggregates all of the above + sourcePayloads + warnings
BrokerNormalizationResult — snapshot + metadata (counts, connectorVersion, warnings)
```

### Normalization invariants

1. **ISIN-first** — use ISIN as the primary instrument key when available; fall back to `symbol + exchange`
2. **Raw payload retained** — store the original broker response in `snapshot.sourcePayloads` for reprocessing and audit
3. **Confidence scores** — attach `0.0–1.0` confidence to every holding and position based on data completeness
4. **One asset class vocabulary** — map all broker-specific type strings to `BrokerAssetClass` before the intelligence layer
5. **No null quantities** — treat missing quantities as 0 and emit a `warning`; never silently drop holdings
6. **Currency explicit** — always populate `currency: "INR" | "USD"`; never infer from context

### Zod runtime validation (all in `src/lib/schemas.ts`)

```typescript
BrokerHoldingSchema              // validate individual holdings
BrokerPositionSchema             // validate positions
BrokerTransactionSchema          // validate transactions
BrokerPortfolioSnapshotSchema    // validate full snapshot before persistence
BrokerNormalizationResultSchema  // validate the final result from every connector
BrokerAuthHandleSchema           // validate stored auth handles
BrokerDeduplicationResultSchema  // validate cross-broker merge output
BrokerNormalizerConfigSchema     // validate declarative field maps
```

---

## Broker Adapter Architecture

Each connector is an isolated adapter implementing `BrokerConnector` (`src/lib/types/broker.ts`):

```typescript
interface BrokerConnector {
  readonly provider: BrokerProvider;
  readonly region: BrokerRegion;
  readonly version: string;
  readonly supportedScopes: BrokerSyncScope[];

  authenticate(credentials: BrokerCredentials): Promise<BrokerAuthHandle>;
  fetchAndNormalize(auth: BrokerAuthHandle, scope?: BrokerSyncScope[]): Promise<BrokerNormalizationResult>;
  refreshAuth?(auth: BrokerAuthHandle): Promise<BrokerAuthHandle>;
}
```

**Adapter lifecycle per sync:**

```text
1. authenticate()              ← broker-specific auth, isolated inside adapter
2. fetchAndNormalize()
   ├── Fetch raw payloads      ← raw provider JSON
   ├── Retain raw              ← snapshot.sourcePayloads[i]
   ├── Map fields              ← BrokerNormalizerConfig.holdingFieldMap
   ├── Resolve ISIN            ← instrument identity, ISIN-first
   ├── Attach confidence       ← based on field completeness
   └── Return BrokerNormalizationResult
3. Validate with Zod           ← BrokerNormalizationResultSchema.parse()
4. Persist raw snapshot        ← database (raw_broker_payloads table)
5. Deduplication pass          ← cross-broker ISIN-first merge
6. Persist normalized snapshot ← portfolioHealthSnapshot
7. Feed intelligence engines   ← health, fragility, Monte Carlo
```

**Adapter rules:**

- Broker-specific auth logic must never leave the adapter file
- Raw provider payloads must never leak into the intelligence layer
- All holdings and positions must be normalized before aggregation
- Fail gracefully when partial data is available — emit warnings, never throw silently
- All adapters must pass `BrokerNormalizationResultSchema.parse()` before returning

---

## Cross-Broker Deduplication Logic

When a user connects multiple brokers, holdings in the same instrument must be merged:

```text
Input: [ZerodhaHolding(INFY), UpstoxHolding(INFY), DhanHolding(RELIANCE)]

Step 1: Build instrument key
  ISIN present → key = { isin: "INE009A01021", symbol: "INFY", exchange: "NSE" }
  ISIN absent  → key = { isin: null, symbol: "RELIANCE", exchange: "NSE" }

Step 2: Group holdings by key
  Group A: [ZerodhaHolding(INFY), UpstoxHolding(INFY)]
  Group B: [DhanHolding(RELIANCE)]

Step 3: Merge each group
  totalQuantity         = sum(quantity across contributions)
  weightedAveragePrice  = sum(qty × avgPrice) / totalQuantity
  totalMarketValue      = sum(marketValue where non-null)
  totalCostBasis        = sum(costBasis where non-null)
  totalUnrealizedPnl    = sum(unrealizedPnl where non-null)
  confidence            = min(confidence across contributions)
  sources               = [BrokerSourceReference, ...]

Output: BrokerDeduplicationResult
  mergedHoldings:       [MergedHolding(INFY, qty=X), MergedHolding(RELIANCE, qty=Y)]
  duplicatesRemoved:    1
  totalHoldingsBefore:  3
  totalHoldingsAfter:   2
```

---

## Execution Order

```text
1.  Zerodha connector          (Phase 1 — highest leverage)
2.  Upstox connector           (Phase 1)
3.  Angel One connector        (Phase 1)
4.  Dhan connector             (Phase 1)
5.  FYERS connector            (Phase 1)
6.  Non-API intake layer       (CAS, CSV, manual — always-on fallback)
7.  Groww connector            (Phase 2)
8.  ICICI Direct connector     (Phase 2)
9.  Kotak Neo connector        (Phase 2)
10. 5paisa connector           (Phase 2)
11. Motilal Oswal connector    (Phase 2)
12. Shoonya connector          (Phase 3)
13. Alice Blue connector       (Phase 3)
14. HDFC Securities connector  (Fallback — business path required)
15. Axis Direct connector      (Fallback — business path required)
```

---

## Implementation Files

| Path | Purpose |
|------|---------|
| `src/lib/types/broker.ts` | All TypeScript types: entities, connector interface, dedup types, normalizer config |
| `src/lib/schemas.ts` | Zod runtime validation schemas for all broker entities |
| `src/lib/connectors/zerodha.ts` | Zerodha adapter (Phase 1) |
| `src/lib/connectors/upstox.ts` | Upstox adapter (Phase 1) |
| `src/lib/connectors/angel-one.ts` | Angel One adapter (Phase 1) |
| `src/lib/connectors/dhan.ts` | Dhan adapter (Phase 1) |
| `src/lib/connectors/fyers.ts` | FYERS adapter (Phase 1) |
| `src/lib/connectors/groww.ts` | Groww adapter (Phase 2) |
| `src/lib/connectors/icici-direct.ts` | ICICI Direct adapter (Phase 2) |
| `src/lib/connectors/kotak-neo.ts` | Kotak Neo adapter (Phase 2) |
| `src/lib/connectors/five-paisa.ts` | 5paisa adapter (Phase 2) |
| `src/lib/connectors/motilal-oswal.ts` | Motilal Oswal adapter (Phase 2) |
| `src/lib/connectors/shoonya.ts` | Shoonya adapter (Phase 3) |
| `src/lib/connectors/alice-blue.ts` | Alice Blue adapter (Phase 3) |
| Planned broker dedup layer | Cross-broker deduplication engine |
| Planned broker sync orchestrator | Orchestration: auth → fetch → dedup → persist → invalidate cache |

---

## Why the data layer is the moat

The moat is not the API connection itself. It is the combination of:

1. **Reliable normalization** — every broker maps to the same `BrokerPortfolioSnapshot`
2. **Raw payload retention** — every original response is stored for reprocessing and audit
3. **ISIN-first deduplication** — cross-broker holdings are merged cleanly with weighted averages
4. **One shared intelligence layer** — health, fragility, Monte Carlo, and unified score work on the same normalized data regardless of source
5. **Confidence scoring** — derived mappings carry explicit quality signals that the intelligence engines can use

Competitors who connect APIs without building this normalization and deduplication layer cannot do portfolio-level analysis reliably. That is the actual moat.
