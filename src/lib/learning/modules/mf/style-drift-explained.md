---
title: "Style Drift Explained"
slug: "style-drift-explained"
category: "mf"
xpReward: 15
estimatedTime: "1.5 minutes"
prerequisite: null
badgeContribution: null
isEliteOnly: false
---

## Key Concept

**Style drift** occurs when a mutual fund's actual portfolio doesn't match its declared category. A fund labeled "Large Cap" by SEBI might secretly hold 25% mid-cap stocks. A "Value" fund might be chasing growth momentum. The label tells you what the fund *says* it is — the holdings tell you what it *actually* is.

This matters because you chose a fund for a reason. If you picked a large-cap fund for stability and it's drifting into mid-caps, you're taking on risk you didn't sign up for. Style drift is one of the most common — and least visible — risks in Indian mutual fund investing.

## What It Means

Our MF lookthrough engine detects style drift by comparing a fund's actual holdings against its declared SEBI category:

- **Market Cap Drift** — A Large Cap fund should have 80%+ in large-cap stocks (top 100 by market cap). If we detect significant mid-cap or small-cap exposure, that's market cap drift. This is the most common type.
- **Sector Concentration** — A Flexi Cap fund should be diversified across sectors. If 40% is in a single sector (say banking), that's sector drift — the fund is behaving more like a sectoral fund.
- **Style Drift Score** — We quantify the gap between declared category and actual portfolio composition. Higher drift = bigger mismatch between label and reality.

Style drift isn't always bad. A skilled fund manager might drift into mid-caps because they see better opportunities there. But you should *know* it's happening so you can make informed decisions about your overall portfolio allocation.

## What It Does NOT Mean

- Style drift does **not** mean the fund manager is incompetent. Active management inherently involves some deviation from benchmarks. The question is whether the drift is intentional and disclosed.
- Detecting drift is **not** a recommendation to sell. It's information that helps you understand what you actually own versus what the label says.
- Zero drift is **not** always desirable. Index funds have zero drift by design, but they also can't adapt to changing market conditions. Some drift is the price of active management.
- Style drift analysis applies to **equity funds only**. Debt funds, liquid funds, and hybrid funds use different risk frameworks.

## Quick Check

- [x] Style drift means a fund's actual holdings don't match its declared SEBI category. | Correct — a "Large Cap" fund holding significant mid-cap stocks is exhibiting style drift.
- [ ] Style drift always means the fund manager is doing something wrong. | No — some drift is intentional active management. The issue is when drift is undisclosed or excessive.
- [x] You should check for style drift because it affects your overall portfolio risk allocation. | Yes — if your "large cap" fund is secretly mid-cap heavy, your portfolio has more mid-cap exposure than you planned.
- [ ] A fund with zero style drift is always better than one with some drift. | No — zero drift means index-like behavior. Active funds are expected to deviate somewhat. The key is whether the drift is reasonable and intentional.
