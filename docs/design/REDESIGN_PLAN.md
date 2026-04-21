# LyraAlpha UI/UX Redesign — Tracking Doc

## Phase 1 — Design System Foundation ✅

- [x] 1.1 OKLCH token rewrite (reference palette + semantic tokens in globals.css)
- [x] 1.2 Typography — Space Grotesk added to layout.tsx + type scale + font weight tokens
- [x] 1.3 Motion + radius cleanup (fixed --radius duplication, updated xp-pulse/glass-card-hover to use --primary token)
- [x] 1.4 Bug fixes (collapsed 4× duplicate .text-amber-400, 5× contradictory .bg-amber-500/10, remapped to semantic tokens)
- [x] 1.5 Deleted dead lyraiq-brand-tokens.css
- [x] 1.6 Updated hsl(var(--token)) → var(--token) across call sites
- [x] 1.7 Created tracking doc
- [x] 1.8 Verification: lint + typecheck + test + manual smoke

### Key changes
- Color space migrated from HSL to OKLCH across all semantic tokens
- New tokens: `--surface-1/2/3`, `--success/warning/danger/info` (+ foreground + subtle), `--accent-cta`, `--border-strong/subtle`
- Reference palette: `--ref-space-{950,900,800,700}`, `--ref-indigo-500`, `--ref-purple-400`, `--ref-cyan-400`, `--ref-amber-500`, `--ref-emerald-500`, `--ref-rose-500`, `--ref-sky-500`
- Radius scale: `--radius-sm`, `--radius` (0.5rem), `--radius-lg`, `--radius-xl`, `--radius-2xl`, `--radius-full`
- Shadow scale: `--shadow-xs` through `--shadow-xl`, `--shadow-glow-primary`, `--shadow-glow-cta`, `--shadow-inset-focus`
- Type scale: `--text-xs` through `--text-6xl` with line-height + letter-spacing
- Font weights: `--font-weight-{regular,medium,semibold,bold}`
- Light-mode compat shim remapped from hardcoded rgba → semantic tokens (`var(--success)`, `var(--danger)`, etc.)
- Toaster in layout.tsx migrated to semantic token classes

## Phase 2a — Primitives + Component Migration Kickoff ✅

- [x] 2a.1 Semantic Tailwind color utilities (@theme entries for success/warning/danger/info/surface/accent-cta)
- [x] 2a.2 Refactored button + badge + card + input primitives
- [x] 2a.3 Migrated portfolio page + high-traffic reference cards (crypto-card, MarketAssetCard, market-regime-card, signal-strength-card, correlation-stress-card, portfolio page insights)
- [x] 2a.4 Appended color migration map to tracking doc
- [x] 2a.5 Verification: lint + typecheck + test passed

## Phase 2b — Proper sweep ✅

- [x] 2b.1 Migrate `src/components/portfolio/*`
- [x] 2b.2 Migrate `src/components/dashboard/*`
- [x] 2b.3 Migrate `src/components/analytics/*`
- [x] 2b.4 Migrate `src/components/lyra/*`
- [x] 2b.5 Migrate `src/app/dashboard/**/page.tsx`
- [x] 2b.6 Migrate `src/components/landing/*`
- [x] 2b.7 Migrate `src/components/layout/*`
- [x] 2b.8 Migrate remaining UI primitives
- [x] 2b.9 Migrate tools + blog + admin + misc pages
- [x] 2b.10 Retire compat shim rows (all raw semantic color classes migrated; only text-slate-400 shim retained)
- [x] 2b verification: lint + typecheck + test passing

### Migration results
- **0 remaining** raw `text-emerald-*`, `text-rose-*`, `bg-amber-*`, `border-sky-*` etc. across all src/
- **~130 files** migrated via `scripts/migrate-colors.ts`
- **0 remaining** raw `text-red-*`, `bg-red-*`, `text-green-*`, `bg-green-*`, `text-orange-*`, `bg-orange-*`, `text-yellow-*`, `bg-yellow-*` across all src/ (Phase 4)
- Compat shim reduced to single `text-slate-400` rule (globals.css)
- `hsl(var())` pattern: 0 remaining across src/

## Phase 6 — Shadow / Gradient / Foreground Token Migration ✅

- [x] 6.1 Migrate `shadow-{emerald|amber|pink|rose|sky|cyan|yellow|orange|indigo}-*` → `shadow-{success|warning|danger|info|primary}/*` (18 replacements across 3 files: learning, rewards, upgrade)
- [x] 6.2 Migrate `from-*/to-*` gradient raw colors → semantic tokens (referral-panel: `from-amber-*` → `from-warning/*`, `from-gray-*` → `from-muted-foreground/*`)
- [x] 6.3 Migrate `text-black` on `bg-primary` → `text-primary-foreground` (15 replacements across 10 files: upgrade, rewards, compare, assets, lyra, error-boundary, module-of-the-day, regime-alert-bell, elite-gate, legal-documents-modal, lyra-insight-sheet)
- [x] 6.4 Migrate `text-white` on semantic `bg-*` → `text-{token}-foreground` (portfolio, timeline, learning/[slug], error-boundary, institutional-timeline, rewards, admin/ai-limits)
- [x] 6.5 Migrate raw `shadow-[0_0_20px_rgba(...)]` → semantic `shadow-{token}/*` (6 replacements: demo-portfolio, rewards, assets/[symbol], assets, StickyWaitlistBar, asset-search-input)
- [x] 6.6 Fix duplicate `dark:text-foreground` in upgrade/page.tsx
- [x] 6 exit: lint + typecheck + test passing

### Phase 6 migration results
- **0 remaining** raw `shadow-*` color utility classes across all src/
- **0 remaining** `text-black` on `bg-primary` across all src/
- **0 remaining** `text-white` on semantic `bg-*` (non-dark-mode) across all src/
- **0 remaining** raw `rgba()` shadow values across all src/
- **0 remaining** raw `from-*/to-*` gradient colors across all src/

## Color Migration Map

```
text-emerald-{300,400,500}  → text-success
text-rose-{300,400,500}     → text-danger
text-amber-{300,400,500}    → text-warning
text-sky-{300,400,500}      → text-info
text-cyan-{300,400,500}     → text-info
bg-emerald-500/N            → bg-success/N
bg-rose-500/N               → bg-danger/N
bg-amber-500/N              → bg-warning/N
bg-sky-500/N                → bg-info/N
bg-cyan-500/N               → bg-info/N
border-emerald-{300,400,500}/N → border-success/N
border-rose-{300,400,500}/N    → border-danger/N
border-amber-{300,400,500}/N   → border-warning/N
border-sky-{300,400,500}/N     → border-info/N
border-cyan-{300,400,500}/N    → border-info/N
shadow-emerald-500/N        → shadow-success/N
shadow-amber-500/N          → shadow-warning/N
shadow-pink-500/N           → shadow-danger/N
shadow-rose-500/N           → shadow-danger/N
shadow-sky-500/N            → shadow-info/N
shadow-cyan-500/N           → shadow-info/N
shadow-yellow-500/N         → shadow-warning/N
shadow-orange-500/N         → shadow-warning/N
shadow-indigo-500/N         → shadow-primary/N
from-amber-*                → from-warning/*
from-gray-*                 → from-muted-foreground/*
bg-primary text-black       → bg-primary text-primary-foreground
bg-{token} text-white       → bg-{token} text-{token}-foreground
shadow-[0_0_20px_rgba(...)] → shadow-{token}/N
```

Patterns also match inside `hover:`, `focus:`, `dark:`, `md:`, `lg:` prefixes.

### Special case: brand gradients
Gradients using raw shades for aesthetic purposes (e.g., WebGL hero, landing reveal backgrounds) are preserved.

## Phase 3 — Marketing Redesign ✅

- [x] 3.1 Hero rework — HeroWebGL 3D scene migrated from amber/teal to Electric Indigo (#818CF8) / Signal Cyan (#22D3EE) / Neural Purple (#C4B5FD)
- [x] 3.1.2 Scrollytelling — all panels migrated to indigo/cyan brand colors; framer-motion not needed (existing rAF+ResizeObserver is clean)
- [x] 3.1.3 Other landing components — Trust, HowItWorks, Features, BlogPreview, WaitlistSection, StickyWaitlistBar, public-myra-widget/panel all migrated
- [x] 3.2 Navigation + Footer — Navbar surface gradient, Footer decorative gradients, social hover states, legal links all migrated to indigo
- [x] 3.3 Secondary marketing pages — Contact page migrated; About, Pricing, Careers, Methodology, Privacy, Terms, Legal already clean
- [x] 3.4 Blog — index, [slug], category, section pages migrated; BlogSidebar migrated
- [x] 3.5 Tools — tools index, demo-portfolio, public-tool-page migrated
- [x] 3 exit: Dropped `gsap` + `@types/gsap` from package.json (0 imports in src/)

### Phase 3 migration results
- **0 remaining** `teal-*`, `rgba(20,184,166,...)`, `#14B8A6` across all src/
- Light-mode `amber-*` classes → `indigo-*` where decorative (CTA amber preserved per brand direction)
- CTA buttons retain amber (`bg-warning`) glow per Decision 1
- `gsap` + `@types/gsap` removed from dependencies

## Phase 4 — Remaining Raw Color Migration ✅

- [x] 4.1 Migrate `red-*` → `danger` semantic token (260 replacements across 52 files)
- [x] 4.2 Migrate `green-*` → `success` semantic token (64 replacements across 23 files)
- [x] 4.3 Migrate `orange-*` / `yellow-*` → `warning` semantic token (77 replacements across 25 files)
- [x] 4.4 Migrate remaining `emerald-*` / `rose-*` / `sky-*` / `cyan-*` / `amber-*` light-mode shades (42 replacements across 18 files)
- [x] 4.5 Retire compat shim in globals.css (removed 110 lines of dead CSS rules; only `text-slate-400` shim retained)
- [x] 4 exit: lint + typecheck + test passing

### Phase 4 migration results
- **0 remaining** raw `red-*`, `green-*`, `orange-*`, `yellow-*` color utility classes across all src/
- **0 remaining** raw `emerald-*`, `rose-*`, `sky-*`, `cyan-*` light-mode shades
- Light-mode `amber-*` shades → `indigo-*` (brand color for decorative elements)
- Compat shim reduced from ~110 lines to 3 lines (single `text-slate-400` rule)
- `slate-*` classes remain (178 occurrences across 41 files) — context-dependent neutral palette, not semantic

## Phase 5 — Final Color Token Migration + Code Quality ✅

- [x] 5.1 Migrate `gray-*` → `muted-foreground`/`muted` tokens (4 files)
- [x] 5.2 Migrate `indigo-*` → `primary` semantic tokens (28 files, 99 replacements)
- [x] 5.3 Migrate `slate-*` → `foreground`/`muted`/`border` semantic tokens (42 files, 179 replacements)
- [x] 5.4 Retire last `text-slate-400` compat shim in globals.css
- [x] 5.5 Migrate remaining `zinc-*`/`blue-*`/`purple-*`/`pink-*`/`neutral-*` → semantic tokens (12 files)
- [x] 5.6 Stress-test page deep code review — 16 fixes (bugs, perf, UX, code quality)
- [x] 5.7 Extract pure functions to testable utility file + 49 new unit tests
- [x] 5.8 Stress-test page additional fixes — React 18 bailout, 15 integration tests
- [x] 5 exit: lint + typecheck + test passing

### Phase 5 migration results
- **0 remaining** raw `gray-*`, `indigo-*`, `slate-*`, `zinc-*`, `blue-*`, `purple-*`, `pink-*`, `neutral-*` color utility classes across all src/
- **0 remaining** compat shim rules in globals.css (all retired)
- Stress-test page: `StressResult` extracted to shared types, pure functions to `stress-test-utils.ts`
- Stress-test page: `addSymbol` React 18 bailout fixed (`queueMicrotask`), `addSymbolOutcomeRef` removed
- Stress-test page: 15 integration tests in `page.test.tsx` covering rendering, A11y, UX, error handling
- 3 migration scripts: `migrate-indigo.ts`, `migrate-slate.ts`, `migrate-remaining.ts`

### Stress-test page fixes (16 items)
| # | Category | Fix |
|---|---|---|
| 1 | Bug | `addSymbol` outcome mutation — ref pattern for Strict Mode |
| 2 | Bug | Stale `symbols` closure in `runStressTest` — `symbolsRef` |
| 3 | Bug | Guard `validResults[0]` in `ScenarioNarrativeCard` |
| 4 | Bug | `SCENARIO_COLORS` brand-aligned palette |
| 5 | Perf | `AssetBreakdownRow` extracted with `React.memo` |
| 6 | Perf | IIFE → `useMemo` for Lyra analysis parsing |
| 7+8 | Perf | Combined 4 reduce passes → single `for...of` loop |
| 9 | UX | Min-width on drawdown bar for near-zero values |
| 10 | UX | Loading skeleton for results section |
| 11 | UX | Empty state copy + EliteGate child fix |
| 12 | Quality | Invalid Date guard in `formatScenarioPeriod` |
| 13 | Quality | `aria-label` on removeSymbol button |
| 14 | Quality | StatChip variants already semantic — no change needed |
| 15 | Quality | Recession scenario differentiated from covid/tech-bubble |
| 16 | Quality | `StressResult` extracted to shared types file |

## Decisions Log

| # | Decision | Value |
|---|---|---|
| 1 | Brand direction | Cool LYRAIQ (Electric Indigo primary, amber as CTA accent) |
| 2 | Color space | OKLCH native |
| 3 | Typography | Space Grotesk (headings) + Inter (body) |
| 4 | Theme strategy | Dashboard forced dark; marketing hero pages forced dark; blog/pricing/legal/tools respect prefers-color-scheme |
| 5 | Accessibility | WCAG AA + APCA 60+ |
| 6 | Migration strategy (Phase 2b) | Scripted TS-based mechanical replacement, folder-by-folder, verified after each batch |
| 7 | Phase 3 brand migration | teal → info (indigo/cyan); decorative amber → indigo; CTA amber preserved |
