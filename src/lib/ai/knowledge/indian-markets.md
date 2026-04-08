# Indian Market Intelligence Reference

This document provides India-specific market structure, regulatory context, and sector dynamics for the 191 Indian stocks, 105 Indian mutual funds, 6 Indian ETFs, and 2 Indian commodities in the LyraAlpha AI universe (304 IN assets total). Use this to deliver India-aware analysis instead of generic global frameworks.

---

## Market Structure

### NSE/BSE Basics
- **Trading hours**: 9:15 AM – 3:30 PM IST (pre-open 9:00–9:15). No after-hours trading.
- **Settlement**: T+1 (since Jan 2023). Faster than most global markets.
- **Circuit breakers**: Index-level (10%, 15%, 20% from previous close) and stock-level (5%, 10%, 20% based on category). Circuit limits can trap positions — low Liquidity score + circuit hit = unable to exit.
- **F&O expiry**: Weekly (Thursday) for index options, monthly for stock options. Expiry weeks often see elevated volatility — Volatility score spikes near expiry are structural, not necessarily bearish.

### FII/DII Flow Dynamics
- **FII (Foreign Institutional Investors)**: Largest marginal price-setters in Indian large-caps. FII selling creates outsized downward pressure because domestic retail/DII cannot always absorb the volume.
- **DII (Domestic Institutional Investors)**: Includes mutual funds, insurance companies, pension funds. DII buying during FII selling = "domestic support" — historically limits drawdowns to 10-15% in large-caps.
- **Flow interpretation**: FII buying + DII buying = strong conviction rally. FII selling + DII buying = orderly correction (usually recoverable). FII selling + DII selling = genuine risk-off (rare but severe).
- **Currency link**: FII flows are USD-denominated. When USD/INR rises (rupee weakens), FII selling accelerates due to currency losses on top of equity losses. This creates a negative feedback loop.

---

## RBI Monetary Policy

### Key Rates
- **Repo rate**: The primary policy rate. Currently the benchmark for all lending rates via the External Benchmark Lending Rate (EBLR) system.
- **CRR (Cash Reserve Ratio)**: Cash banks must hold with RBI. CRR cuts inject liquidity → positive for banks and rate-sensitive sectors.
- **SLR (Statutory Liquidity Ratio)**: Government securities banks must hold. Affects bank profitability and lending capacity.

### Transmission to Markets
- **Rate cuts**: Directly benefit banking (NIM expansion), real estate (EMI reduction drives demand), auto (loan-dependent purchases), and NBFCs.
- **Rate hikes**: Hurt rate-sensitive sectors first. Banks initially benefit (asset repricing faster than liability repricing) but eventually face credit quality deterioration.
- **Liquidity operations**: RBI uses OMOs (Open Market Operations) and VRR/VRRR auctions to manage system liquidity. Tight liquidity = NBFC stress, wider credit spreads.

### RBI vs Fed
- RBI often follows Fed direction but with a lag and smaller magnitude. When Fed cuts aggressively but RBI holds, the interest rate differential narrows → FII debt outflows → rupee pressure → equity FII sentiment weakens.

---

## Indian Sector Dynamics

### IT Services (TCS, INFOSYS, WIPRO, HCL)
- **USD earners**: Revenue in USD, costs in INR. Weak rupee = margin tailwind. Strong rupee = headwind.
- **Demand proxy**: US/EU enterprise IT spending. US recession fears directly hit Indian IT sentiment.
- **Seasonality**: Q3 (Oct-Dec) typically weak due to furloughs. Q4 (Jan-Mar) strong due to budget flush.
- **Valuation anchor**: P/E 25-30 is fair for large-cap IT. Above 30 = pricing in acceleration. Below 25 = pricing in deceleration.

### Banking & Financials (HDFC, ICICI, SBI, KOTAK, BAJFINANCE)
- **NIM-driven**: Net Interest Margin is the key profitability metric. Rising rates initially help (asset repricing), but prolonged high rates hurt (credit quality deterioration).
- **Asset quality cycle**: GNPA (Gross Non-Performing Assets) and NNPA ratios are critical. Declining NPAs = re-rating catalyst. Rising NPAs = de-rating trigger.
- **Credit growth**: 15%+ credit growth = expansionary cycle (bullish for banks). Below 10% = cautious cycle.
- **PSU vs Private**: Private banks trade at 2-4x P/B, PSU banks at 0.8-1.5x P/B. The gap reflects governance and asset quality differences.

### Pharma & Healthcare (SUNPHARMA, DRREDDY, CIPLA, DIVISLAB)
- **US FDA dependency**: ANDA approvals and FDA inspection outcomes are binary catalysts. Warning letters = 10-20% drawdown. Clearance = re-rating.
- **Generic vs specialty**: Generic-heavy companies face pricing pressure in US market. Specialty/CDMO companies command premium valuations.
- **Domestic formulations**: Growing 10-12% annually. Less volatile than export business. Provides earnings floor.

### Auto (MARUTI, TATAMOTORS, M&M, BAJAJ-AUTO)
- **Volume-driven**: Monthly sales data is a leading indicator. 3 consecutive months of declining volumes = sector headwind.
- **EV transition**: Two-wheeler EV adoption faster than four-wheeler. OLA Electric, Ather creating disruption risk for BAJAJ-AUTO, HEROMOTOCO.
- **Rural vs urban**: Two-wheelers and tractors (M&M) are rural demand proxies. Monsoon quality directly affects rural auto demand.

### Consumer (HINDUNILVR, ITC, NESTLEIND, TITAN)
- **Staples vs discretionary**: HINDUNILVR/ITC = staples (defensive, low beta). TITAN = discretionary (high beta, wedding season driven).
- **Input cost sensitivity**: Palm oil, crude oil prices directly impact FMCG margins. Rising crude = HINDUNILVR margin pressure.
- **Rural recovery**: Volume growth in staples is a rural recovery indicator. Flat volumes = rural stress.

---

## Mutual Fund Context (India-Specific)

### SEBI Categorization (Oct 2017)
- Each AMC can have only ONE scheme per category. This prevents category proliferation.
- **Large Cap**: Must invest ≥80% in top 100 stocks by market cap.
- **Mid Cap**: Must invest ≥65% in stocks ranked 101-250.
- **Small Cap**: Must invest ≥65% in stocks ranked 251+.
- **Flexi Cap**: No restrictions — can shift across caps. Watch for style drift.
- **ELSS**: 3-year lock-in, tax benefit under Section 80C. Forced long-term holding = less redemption pressure on fund.

### Key Metrics for Indian MFs
- **Rolling returns** (3Y, 5Y) are more meaningful than point-to-point returns. They smooth out timing luck.
- **Expense ratio**: Direct plans save 0.5-1.5% annually vs Regular plans. On ₹10L over 10 years at 12% CAGR, this difference = ₹1.5-3L.
- **AUM impact**: Funds above ₹30,000 Cr face deployment challenges in mid/small-cap space. Large AUM in small-cap fund = potential alpha erosion.
- **Exit load**: Most equity MFs charge 1% for redemption within 1 year. Factor this into short-term analysis.

### Tax Context (as of FY 2024-25)
- **Equity LTCG**: Gains above ₹1.25L taxed at 12.5% (holding >1 year).
- **Equity STCG**: Taxed at 20% (holding <1 year).
- **Debt MF**: Taxed at slab rate regardless of holding period (post April 2023 change). This removed the indexation benefit that made debt MFs attractive.

---

## India-Specific Risk Factors

### Currency Risk (USD/INR)
- Rupee depreciation of 3-5% annually is structural (inflation differential with US). Factor this into USD-denominated return comparisons.
- Sharp rupee moves (>2% in a week) often trigger FII selling cascades.

### Regulatory Risk
- SEBI can change rules with limited notice (e.g., F&O margin changes, MF categorization). Regulatory surprises create short-term volatility but usually improve long-term market structure.
- Government policy changes (GST rates, PLI schemes, import duties) can be sector-specific catalysts.

### Monsoon & Agriculture
- Monsoon quality affects rural demand (40%+ of India's economy). Deficient monsoon = headwind for auto, FMCG, fertilizer sectors.
- Food inflation from poor monsoon can force RBI to hold rates higher, hurting rate-sensitive sectors.
