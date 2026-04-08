---
title: "Lyra Memory Explained"
description: "How Lyra distills key facts from your conversations to give you better context-aware analysis over time."
category: platform
xpReward: 15
estimatedTime: "1 minute"
badgeContribution: lyra-user
---

## Lyra Memory Explained

Lyra isn't just reactive — she builds a lightweight memory layer from your conversations so that analysis improves as she learns your context.

### What Memory Does

After you have a conversation with Lyra, a background distillation step extracts key facts worth remembering. Examples:

- "User tracks NVDA, AMD, and Bitcoin."
- "User is focused on US tech sector with a risk-off overlay."
- "User asked about Indian midcaps in the context of RBI policy shifts."

These memory notes are injected into future Lyra conversations as context — so she doesn't start from zero every time.

### What Memory Is Not

Memory is not a transcript of your conversations. It's a compact set of facts distilled from them. Lyra doesn't store your full chat history and replay it.

Memory also doesn't override the current question. It enriches the context so that analysis is better grounded in your actual focus areas.

### When Memory Kicks In

Memory retrieval is selective. It activates when the conversation depth warrants it — not on every single query. Short SIMPLE queries (definitions, explanations) typically don't trigger memory injection.

### Privacy Control

Memory is tied to your account and is not shared. Future platform updates will include a Memory Manager where you can view and delete stored memory fragments directly.

## Quick Check

- [ ] Lyra's memory stores a full transcript of every conversation you have. | False — it distills a compact set of key facts, not full transcripts.
- [x] Memory injection can improve analysis quality on MODERATE and COMPLEX queries about your tracked assets. | Correct — Lyra uses memory notes as additional context when relevant.
- [ ] Memory retrieval fires on every single query including basic definitions. | No — memory is selective and typically doesn't activate on short SIMPLE queries.
- [x] Memory is tied to your account and is not shared with other users. | Correct — memory is private and scoped to your account.
