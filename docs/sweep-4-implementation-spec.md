# Sweep 4 — Implementation-Ready Spec

> **Status:** Approved spec. Ready for build.
> **Scope:** Content and routing discipline pass. No new pages, no route changes, no architecture rewrite.
> **Ground truth:** All decisions in this document are derived from the Sweep 3 brief and the live repo state as of the grounding pass.

---

## 1. Executive Implementation Summary

Sweep 4 is a content and routing discipline pass. The visual system, shell, and data architecture do not change. Every page already has its major structural redesign from prior sweeps. Sweep 4 removes duplication, tightens conditional logic, migrates one deprecated tool, and enforces the one-question-per-page rule by cutting content that belongs elsewhere.

### The five implementation decisions that must not drift

**1. No new pages, no route changes.**
`WhatIfCard` moves inside Decisions as Tab 4. It does not become a new page. The Insights route stays in the router but its nav entries and all internal links to it are removed.

**2. Home's MetricRow is replaced by a 2-cell signal strip.**
The current MetricRow shows accounts count and snapshot count. Both are removed. The two replacement cells are: freshness signal (last snapshot date) and milestone proximity (amount to next target). If neither cell has content, the strip is hidden entirely.

**3. Plan has exactly one stat grid.**
The `summaryLine` paragraph below the stat strip and any duplicate stat grid are removed. The stat grid in Section 2c (Wealth / Gap / Return / Monthly) is the only stat grid on the page. `PlanSentence` in Section 1 does the interpretation job; `summaryLine` is redundant.

**4. ToolWorkbench wraps all four Decisions tabs.**
The inline `LabField` / `LabResult` / `LabInterpretation` components in Strategy.jsx are kept but reorganised under `ToolWorkbench` wrappers. ToolWorkbench already handles the pro-lock overlay, collapsible state, and interpretation slot. No rebuilding.

**5. Accounts stat grid reduces to three cells and the DonutChart is removed.**
Monthly pace and accounts count are cut. The three cells are: Total assets / Liabilities (conditional) / Last recorded. The donut chart is replaced with a text-only inline legend below the Snapshots section.

### Additional non-negotiable decisions

**6.** `InsightRail` on Home: `onSeeAll` is removed (pass `undefined`). The "All →" link inside `InsightRail` only renders when `onSeeAll` is defined — passing nothing is sufficient. All insight `onClick` handlers route to their natural page, not to Insights.

**7.** `PlanStrategyPreviewCard` (currently unused dead code in `components/outlook/`) is deleted. `DecisionsHandoff` inline in Outlook.jsx is the canonical Decisions handoff.

---

## 2. Per-Page Implementation Spec

---

### Page 1 — Home (`pages/Home.jsx`)

**Core question:** Where do I stand right now, what changed, and is there anything I need to act on?

---

#### Section 1 — Net worth hero (full-bleed dark stage)

**Keep as-is:** full-bleed `-mx-4 sm:-mx-6 lg:-mx-8` dark gradient div with atmospheric glows. This is not `HeroStage` (which is a contained rounded card). The full-bleed pattern is correct and stays.

**Keep:** `hero-number` CSS class, `fmtCurrency(total, baseCurrency)`, `animate-delta`.

**Keep:** `GoldDelta` (surfaces) showing delta currency amount + percentage label.

**Keep:** grounding anchor line ("vs snapshot [date]").
**Modify opacity:** raise from current `rgba(255,255,255,0.22)` to minimum `rgba(255,255,255,0.38)`. This is part of the core change signal, not ambient flavour.

**Remove from this zone:**
- Inline `MiniSparkline` SVG — move to Section 5 (PlanPreview block)
- Milestone badge or ring decorations in the hero number zone — milestone content moves to Section 2
- Trial alert `<button>` inside the hero div — move to Section 9 position (above the dark stage)

---

#### Section 2 — Milestone progress (inside dark stage, below hero number)

**Keep:** `MilestoneProgress` sub-component. No logic change.

**Confirm position:** immediately after the hero number and GoldDelta, before any other content inside the dark stage.

**Keep:** inline editing (`milestoneInput`, `saveMilestone`, `setEditingMilestone`), `reachAge` calculation and display.

---

#### Section 3 — Signal strip (2-cell, replaces MetricRow)

**Remove:** current `MetricRow` with accounts count and snapshot count cells.

**Add:** 2-cell strip using `MetricRow` from surfaces as the container. Pass new data:

| Cell | label | value | sub | trend | onClick |
|---|---|---|---|---|---|
| 1 | `"Last recorded"` | `lastSnapshotDate ?? "Not yet recorded"` | `daysSinceSnapshot > 30 ? "Position may be stale" : undefined` | `daysSinceSnapshot > 30 ? "down" : undefined` | `() => setPage('accounts')` |
| 2 | `milestoneRemaining > 0 ? "[amount] to next target" : "Set a target"` | `milestoneRemaining > 0 ? fmtCurrencyCompact(milestoneRemaining, ccy) : "—"` | — | — | scroll to MilestoneProgress or `() => setPage('outlook')` (Plan page opens EditPlanModal via `openEdit`) |

**Amber treatment for stale cell:** when `daysSinceSnapshot > 30`, the sub-label renders with amber colour. MetricRow's `trend: "down"` triggers rose colouring by default — override with amber (`text-amber-400`) using an inline style or className override on the sub label. Keep the amber token consistent with the global freshness treatment: `text-amber-400 / bg-amber-500/10 / border-amber-500/20`.

**Visibility rule:** if `lastSnapshotDate === null` AND `activeMilestoneTarget === null`, render nothing. The strip takes no space. No skeleton, no empty placeholder.

**New derived state needed:**
- `lastSnapshotDate`: last entry in `snaps` array (already loaded for snapshot section) — `snaps[snaps.length - 1]?.created_at ?? null`
- `daysSinceSnapshot`: `Math.floor((Date.now() - new Date(lastSnapshotDate).getTime()) / 86400000)`
- `milestoneRemaining`: already computed — `activeMilestoneTarget - total`

---

#### Section 4 — Attention / urgency strip (conditional)

**Add new inline block:** `UrgencyStrip`. Defined inline in Home.jsx (no new file needed if under ~60 lines).

Priority evaluation — strictly ordered, only first match renders:

```
1. isaUrgent
   Condition: isaRemaining > 500 AND daysUntilTaxYearEnd() <= 90
   Copy: "[isaRemaining formatted] of tax-free ISA room before [taxYearEnd].
          Directing new money into wrappers first is the clearest next move."
   CTA label: "Decide →"
   CTA route: setPage('strategy')

2. planGap (only when !isaUrgent)
   Condition: forecast?.status === 'adjust'
   Copy: "Your current plan leaves a gap of [absGap]. Review your pace."
   CTA label: "Review plan →"
   CTA route: setPage('outlook')

3. highConcentration
   Condition: any single account balance / total >= 0.60
   Copy: "One account holds [X]% of your tracked wealth.
          Consider reviewing your allocation."
   CTA route: setPage('accounts')

4. largeCash
   Condition: cashTotal / total >= 0.50 AND total >= 5000
   Copy: "A large share of your wealth is in bank accounts.
          Consider whether it should work harder."
   CTA route: setPage('strategy')
```

**Visibility:** if none match, render `null`. No placeholder, no generic advice.

**Visual treatment:** amber strip — `bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400`. Same as existing amber banners in Outlook and Strategy.

**New derived state needed (requires accounts array):**
- `isaRemaining`: use `data?.isa_remaining` from the dashboard API response only. If the field is absent or null, set `isaRemaining = null` and suppress all ISA urgency signals — do not infer or estimate from tracked account contributions. ISA urgency must not fire on uncertain data.
- `cashTotal`: `accounts.filter(a => a.type === 'bank').reduce((s, a) => s + Number(a.balance || 0), 0)`
- `highConcentration`: `accounts.some(a => Number(a.balance) / total >= 0.60)`

**New state in Home:** `const [accounts, setAccounts] = useState([])` + `useEffect(() => { api('/accounts').then(setAccounts).catch(() => {}) }, [])`. This call is lightweight and already happens for `loadAccountsCount` — consolidate if possible. This array also powers Section 6.

---

#### Section 5 — Plan preview (`PlanPreview` sub-component)

**Keep:** `PlanPreview` sub-component. Existing elements are largely correct.

**Modify:**
- Add `MiniSparkline` moved from Section 1 — position to the right of the projected outcome number
- Add Pro: freedom year inline (`forecast.freedom.hit_year`) — already implemented, confirm it renders
- Add Free: quiet PRO label below the projection number when `!isPro`:
  `"Freedom timeline and contribution modelling"` with a small `PRO` pill

**Keep:** status pill, goal name, projected outcome number, "Projected by age X · Y% of target" context line, progress bar with status-colour, CTA footer ("Review plan →" / "Open your plan →").

**State:** `forecast` object passed as prop from Home state. No change.

---

#### Section 6 — Primary action entry (conditional)

**Add new inline conditional block.** Evaluates from `accounts` array. Show maximum 1 prompt:

```
1. hasMortgage: accounts.some(a => a.type === 'mortgage')
   → "You have a mortgage. Model overpayment savings →"
   → setPage('strategy')   [Decisions will default to mortgage tab]

2. missingContributions (only if !hasMortgage):
   accounts.filter(a => ['isa','investment'].includes(a.type)
     && !Number(a.monthly_contribution))
   → "Some investment accounts have no contribution set.
      Add one to improve your forecast →"
   → setPage('accounts')
```

**Visibility:** if no condition matches, render `null`.

**Visual:** single-line inline prompt with `ArrowRight` icon, gold/muted treatment consistent with other in-page action prompts.

---

#### Section 7 — Insights ("Worth noting") — `InsightRail`

**Keep:** `InsightRail` from surfaces. Already wired in Home.

**Remove:** `onSeeAll` prop — pass nothing (or `undefined`). The "All →" chevron inside `InsightRail` only renders when `onSeeAll` is defined.

**Modify:** audit all `insight.onClick` handlers in the `insights` array. Replace any `setPage('insights')` with:
- Plan-gap insights → `() => setPage('outlook')`
- Contribution insights → `() => setPage('accounts')`
- Snapshot nudges → inline action

**Loading / empty:** `InsightRail` already returns `null` when `insights.length === 0`. No change.

---

#### Section 8 — Onboarding (conditional)

**Simplify `OnboardingPanel`:** Replace the multi-step card (Step sub-components, progress bar, done toast, dismiss logic) with a single conditional line.

**New behaviour:**
- Condition: `onboarding.needsGoal || onboarding.needsAccounts`
- Render: `"Add accounts and a goal to unlock your plan →"` as a clickable prompt
- Route: `setPage('accounts')` if `needsAccounts`, else `setPage('outlook')` (Plan page; `EditPlanModal` is the correct entry point for goal creation/editing for signed-in users — do not use GoalSetup as a navigation destination)
- When both conditions false: render `null`

**Flatten:** reduce `OnboardingPanel` to ~10 lines inline. Remove the card structure, Step sub-component, progress percentage, and done toast.

---

#### Section 9 — Trial expiry badge (conditional)

**Move:** the trial badge `<button>` currently renders inside the dark hero stage. Move it to render immediately **above** the `-mx-4` dark stage wrapper, at the top of the Home return after the milestone receipt.

**Keep:** `trialDaysLeft <= 14` condition, copy format, `setPage('upgrade')` routing.

---

#### State summary (Home)

| State | Source | Used by |
|---|---|---|
| `accounts` | `api('/accounts')` on mount | Sections 4, 6 |
| `lastSnapshotDate` | derived from `snaps` | Section 3 |
| `daysSinceSnapshot` | derived | Section 3 amber treatment |
| `milestoneRemaining` | derived | Section 3 cell 2 |
| `isaRemaining` | from data or derived | Section 4 |
| `cashTotal` | derived from accounts | Section 4 |

#### Loading / error degradation

- Signal strip: degrades silently to hidden if snapshot data unavailable
- Urgency strip: degrades silently to hidden if accounts load fails
- Section 6: degrades silently to hidden if accounts load fails
- None of these failures throw or show error states — they simply omit the section

#### Free vs Pro

| Section | Free | Pro |
|---|---|---|
| Section 5 PlanPreview | Sparkline, projected number, PRO label | + Freedom year |
| Section 7 InsightRail | Standard insights | Richer insight data from backend |
| Section 4 Urgency strip | All signals shown | Same |

#### Anti-duplication guardrails

- Delta appears once: hero stage only. Signal strip does not show 90-day delta.
- Accounts count: removed from MetricRow. Not shown anywhere on Home.
- Snapshot count: removed from MetricRow. Not shown anywhere on Home.
- Plan trajectory chart: not present on Home.
- No multiple equal-weight CTAs competing on the same page.

#### Acceptance criteria

- [ ] Net worth number is the largest visual element on the page
- [ ] GoldDelta is directly below the hero number, not duplicated elsewhere on the page
- [ ] Grounding anchor ("vs snapshot [date]") opacity is ≥ 0.38
- [ ] MilestoneProgress is inside the dark stage, below the hero number
- [ ] Trial badge is above (not inside) the dark hero stage
- [ ] Signal strip renders only when at least one cell has content
- [ ] Signal strip has exactly 2 cells: freshness + milestone proximity
- [ ] No accounts count in signal strip
- [ ] No snapshot count in signal strip
- [ ] No 90-day delta in signal strip
- [ ] Urgency strip shows maximum 1 signal; absent when none apply
- [ ] All 4 urgency conditions evaluate in priority order
- [ ] PlanPreview sparkline appears to the right of the projection number
- [ ] PlanPreview shows freedom year for Pro, PRO label for Free
- [ ] Section 6 shows maximum 1 action prompt; absent when none apply
- [ ] InsightRail has no "All →" link
- [ ] No insight `onClick` routes to `setPage('insights')`
- [ ] Onboarding is a single line, not a multi-step card
- [ ] Sign-out button is absent from Home

---

### Page 2 — Plan (`pages/Outlook.jsx`)

**Core question:** Am I on track, and what does my current path actually mean?

---

#### Section 1 — PlanSentence

**Keep as-is:** `PlanSentence` inline component. All status templates and `deltaMc` lever logic unchanged.

**Modify:** raise font sizes from `text-[17px] sm:text-[19px]` to `text-[19px] sm:text-[22px]`. This makes it the largest text block after the page h1.

**Guard:** already in place — only renders when `forecast` exists and `settingsReady` is true.

---

#### Section 2 — Full-bleed dark stage (Scene 1)

The stage already exists as the `-mx-4 sm:-mx-6 lg:-mx-8` dark gradient div.

**Sub-section 2a — Plan identity and controls (`PlanHeroDashboard`)**

**Keep:** goal name, status badge, edit button, inflation toggle (Pro), feedback label.

**Flatten:** if `PlanHeroDashboard` wraps its content in an internal `Card` or `rounded-3xl border` div, remove that wrapper. Content should sit directly against the stage background without a box-inside-box.

**Sub-section 2b — Projected outcome and progress**

**Keep as-is inside PlanHeroDashboard:** projected end value, "by age X" qualifier, target comparison line, progress bar with current/projected segments, progress legend.

**Sub-section 2c — Stat grid (single instance)**

**Keep:** the 4-cell grid (Wealth / Gap or Ahead / Return / Monthly) at the bottom of the dark stage.

**Remove:** the `summaryLine` paragraph (`{summaryLine}`) that currently renders below the stat grid. `PlanSentence` in Section 1 does this job. This is the primary change to Outlook.jsx.

**Sub-section 2d — Freedom timeline (Pro) / Pro gate (Free)**

**Keep as-is.** Confirm it renders after the stat grid without competing with it.

---

#### Section 3 — Trajectory chart zone (inside dark stage)

**Keep as-is.** Chart, legend, collapse toggle, scenario overlay, empty state ("Add accounts to see your trajectory"). No changes.

---

#### Section 4 — Assumptions strip (inside dark stage)

**Keep as-is.** Monthly contribution input, return input, 3%/5%/7% presets, dirty-state "Update projection" button, footnote. The `rgba(255,255,255,0.25)` "Assumptions" eyebrow correctly signals demoted status.

---

#### Section 5 — Inline Decisions pull (end of dark stage)

**Keep as-is.** Status-aware copy, "Open Decisions →" gold-tinted button at the bottom of the dark stage. Already implemented.

---

#### Section 6 — Scenarios

**Keep:** `ScenarioCompareCard`. No change. Section label remains demoted (already `text-[11px]` `text-ink-muted/50 dark:text-white/25`).

---

#### Section 7 — Breakdown & assumptions (collapsed)

**Keep:** `PlanDetailsGroup` collapse wrapper, `AccountProjectionsCard`, `PlanPriorityCard`, `PlanReviewCard`. Toggle label "Breakdown & assumptions", collapsed hint "Account projections · assumptions · review". These are already correct.

---

#### Section 8 — Decisions handoff (final CTA)

**Keep:** `DecisionsHandoff` inline component. Already implemented correctly.

**Delete file:** `components/outlook/PlanStrategyPreviewCard.jsx` — not imported anywhere; dead code.

---

#### Section 9 — EditPlanModal

**Keep unchanged.**

---

#### Anti-duplication guardrails

- `PlanSentence` is the only interpretation sentence — `summaryLine` is removed
- Stat grid appears once (2c) — no second stat grid anywhere on the page
- Decisions entry points appear twice intentionally (Sections 5 and 8) — this is by design

#### Acceptance criteria

- [ ] `PlanSentence` renders before any chart, number, or input field
- [ ] `PlanSentence` font is `text-[19px] sm:text-[22px]`
- [ ] `PlanHeroDashboard` content is flat against the stage (no internal Card wrapper)
- [ ] `summaryLine` paragraph is absent from the page
- [ ] Stat grid appears exactly once
- [ ] "Open Decisions →" pull appears at the bottom of the dark stage
- [ ] `DecisionsHandoff` is the last section before the edit modal
- [ ] `PlanStrategyPreviewCard.jsx` confirmed deleted (grep for imports returned zero results before deletion)
- [ ] Freedom timeline renders for Pro; upgrade gate renders for Free

---

### Page 3 — Decisions (`pages/Strategy.jsx`)

**Core question:** What should the next pounds do, and what do I need to model before I commit?

---

#### Section 1 — Recommendation stage (full-bleed dark, Scene 1)

**Keep:** existing full-bleed dark stage div.

**Sub-section 1a — Context eyebrow**

**Modify:** apply condition. Currently always shows "Tax year [YYYY/YY] · [N] days remaining". Change to: only render when `isaRemaining > 500 && daysUntilTaxYearEnd() <= 90`.

**Sub-section 1b — Primary recommendation (left column)**

**Modify headline logic:**

| Condition | Headline |
|---|---|
| `isaRemaining > 500 && daysUntilTaxYearEnd() <= 90` | "Use this tax year deliberately." |
| `forecast?.status === 'adjust'` (and no ISA urgency) | "Close the gap to your [goal name] target." |
| Otherwise | "Allocate your next contribution deliberately." |

**Remove priority row 3** ("Compare trade-offs before committing"). It is a meta-instruction, not a decision priority. Keep rows 1 and 2.

**Sub-section 1c — Supporting context (right column)**

**Keep:** `ImpactNumber` (surfaces) showing ISA remaining or plan gap. Already implemented.

**Keep:** current pace, months/days remaining when tax year framing is active.

**Modify CTA** "Open decision lab →": sets `activeTab` to the context-derived default and scrolls to the workbench. Logic: `derivedDefaultTab` (see cross-page shared logic, Section 3).

---

#### Section 2 — Decision lab workbench (Scene 2)

**Restructure:** convert existing `activeTool` state + button row into a proper 4-tab workbench.

**Tab state:** rename `activeTool` to `activeTab`. Keep as string keys:
`'isa' | 'mortgage-overpayment' | 'mortgage-vs-savings' | 'what-if'`

**Tab bar — fixed order:**

| Index | Key | Label |
|---|---|---|
| 0 | `'isa'` | ISA strategy |
| 1 | `'mortgage-overpayment'` | Mortgage overpayment |
| 2 | `'mortgage-vs-savings'` | Where next pounds go |
| 3 | `'what-if'` | Accelerate your plan |

**Tab default on mount:** `useState(() => getDecisionsDefaultTab(forecast, accounts, isaRemaining, daysUntilTaxYearEnd()))` (see Section 3 shared logic). Manual tab changes persist until unmount.

**Wrap each tab in `ToolWorkbench`** (surfaces). Pass `title`, `badge` (ISA tab only, tax year label), `isPro`. Pro-gating is inside the tool, not at the ToolWorkbench level — set `proOnly={false}` on all four wrappers. Each tool owns its `LabInterpretation` internally; pass `interpretation={undefined}` to ToolWorkbench.

```
Tab 0 — ISA strategy:
  ToolWorkbench title="ISA strategy" badge={taxYearLabel}
    └── PlanIsaStrategyCard (keep as-is)

Tab 1 — Mortgage overpayment:
  ToolWorkbench title="Mortgage overpayment"
    └── MortgageOverpaymentTool (keep as-is)

Tab 2 — Where next pounds go:
  ToolWorkbench title="Where next pounds go"
    └── MortgageVsSavingsTool (keep as-is)

Tab 3 — Accelerate your plan:
  ToolWorkbench title="Accelerate your plan"
    └── WhatIfCard (migrated — see below)
```

**WhatIfCard migration:**

- Import `WhatIfCard` from `'../pages/WhatIfCard'` (do not move the file)
- Add to Strategy.jsx: `const [accounts, setAccounts] = useState([])` + `useEffect(() => { api('/accounts').then(setAccounts).catch(() => {}) }, [])`
- Pass `accounts={accounts}` to `WhatIfCard`
- Change WhatIfCard's own title rendering from "Accelerate your milestone" to "Accelerate your plan" (copy-only change inside WhatIfCard)
- Pro gates inside WhatIfCard (lump-sum mode, projected gain) unchanged
- `LabResult` chips and `LabInterpretation` inside WhatIfCard unchanged

**Used-tabs tracking:**

```
const [usedTabs, setUsedTabs] = useState(new Set())
```

When any field inside a tool changes, call `setUsedTabs(prev => new Set(prev).add(activeTab))`. This powers the post-interaction micro-links in Section 3.

---

#### Section 3 — Conclusion and routing (Scene 3)

**Keep:** "Adjustments here feed into your long-term plan." copy and "View plan →" button.

**Add** post-interaction micro-links below "View plan →":

- When `usedTabs.has('isa')`: `"Update your ISA contribution in Accounts →"` → `setPage('accounts')`
- When `usedTabs.has('mortgage-overpayment')`: `"Update your mortgage balance in Accounts →"` → `setPage('accounts')`

Micro-links only appear after the user has interacted with the relevant tab.

---

#### State summary (Strategy)

| State | Purpose |
|---|---|
| `accounts` | Tab 3 WhatIfCard data + tab default logic |
| `activeTab` (was `activeTool`) | Active workbench tab |
| `usedTabs` | Set of tabs the user has interacted with |
| All existing forecast/ISA states | Unchanged |

#### Loading / empty / error states

**Keep all existing:** no-goal empty state, loading skeleton, error + retry. No change.

#### Free vs Pro

- All 4 tabs visible to all tiers
- `PlanIsaStrategyCard` has its own internal gating
- `ToolWorkbench proOnly={false}` on all tabs — gating is inside the tool
- WhatIfCard: lump-sum mode and projected gain remain Pro-gated internally

#### Anti-duplication guardrails

- No plan trajectory chart on Decisions
- No account editing modals on Decisions (micro-links route to Accounts)
- No third priority row containing meta-advice

#### Acceptance criteria

- [ ] Eyebrow renders only when ISA urgency is active
- [ ] Headline adapts to three conditions (ISA / gap / neutral)
- [ ] Exactly two priority rows (row 3 removed)
- [ ] Tab bar shows 4 tabs in fixed order
- [ ] Default active tab is context-driven on mount
- [ ] Manual tab selection persists within the session
- [ ] Navigating away and back resets to context-driven default
- [ ] WhatIfCard renders as Tab 4 with title "Accelerate your plan"
- [ ] WhatIfCard receives accounts array
- [ ] WhatIfCard lump-sum mode is Pro-gated
- [ ] All four tools have a LabInterpretation or equivalent reading panel
- [ ] "Open decision lab →" CTA focuses the context-appropriate tab
- [ ] Post-ISA interaction micro-link routes to Accounts
- [ ] Post-mortgage interaction micro-link routes to Accounts
- [ ] No full trajectory chart on Decisions
- [ ] No account editing modals on Decisions

---

### Page 4 — Accounts (`pages/Accounts.jsx`)

**Core question:** Where does my money live, and what does each account imply?

---

#### Section 1 — Ledger summary header (full-bleed dark)

**Keep:** existing full-bleed dark header structure.

**Modify stat grid from 5 cells to 3:**

| Cell | Content | Condition |
|---|---|---|
| 1 | Total assets | Always shown |
| 2 | Liabilities | Only when `totalLiabilities > 0` |
| 3 | Last recorded: `[date]` or "Not yet recorded" | Always shown; amber when stale |

**Remove from stat grid:** monthly pace / monthly flow, accounts count, growth rate.

**Amber treatment for stale cell:** `daysSinceSnapshot > 30` triggers amber on the Last recorded cell. Token: `text-amber-400` — same as Home freshness treatment.

**Keep:** "Add account" button top-right, free-tier usage bar below stat grid.

---

#### Section 2 — Ledger column headers

**Keep:** `LedgerColumnHeader` inline component unchanged. Account · Monthly · Rate · Balance labels.

---

#### Section 3 — Grouped wealth sections

**Keep:** `WealthGroup` sub-component, `WEALTH_GROUPS` taxonomy, fixed group order (Cash & Liquid · Investments & Wrappers · Pensions · Property · Other Assets · Liabilities), `LedgerEntryRow` 4-zone layout.

**Keep:** allocation % pill, type-coloured left-rule hover accent.

**Modify `LedgerEntryRow` Zone 2 and 3:** when `monthly === 0`, render nothing (not "—"). When `rate === 0`, render nothing (not "—"). Empty cells are cleaner than placeholder dashes.

**Keep:** hover menu (Edit · Delete).

**Note:** `surfaces/LedgerRow` (3-zone) and `surfaces/LedgerSection` are structurally different from the 4-zone layout and `WealthGroup`. Do not replace these inline components with the surfaces versions.

---

#### Section 4 — Contextual nudges (per group)

The `nudge` prop already exists on `WealthGroup`. Extend the nudge derivation logic in the main `Accounts` component to cover all five conditions. One nudge per group, first match wins.

**Nudge logic by group:**

**Liabilities group:**
```
Condition: accounts.some(a => a.type === 'mortgage' && Number(a.balance) > 0)
Copy: "Model overpayment savings in Decisions →"
onClick: setPage('strategy')  [Decisions will default to mortgage tab]
dotColor: rgba(192,90,70,0.6)
color: rgba(192,90,70,0.85)
```

**Investments & Wrappers group (priority order):**
```
Priority A:
  Condition: accounts.some(a => ['isa','investment'].includes(a.type)
               && !Number(a.monthly_contribution))
  Copy: "Add a monthly contribution to improve your forecast →"
  onClick: openEditModal(firstMatchingAccount)

Priority B (only when A does not apply):
  Condition: accounts.some(a => ['isa','investment'].includes(a.type)
               && !Number(a.annual_interest_rate_percent)
               && Number(a.balance) > 1000)
  Copy: "Add an expected return to improve your forecast →"
  onClick: openEditModal(firstMatchingAccount)
```

**Pensions group:**
```
Condition: accounts.some(a => a.type === 'sipp' && !Number(a.monthly_contribution))
Copy: "Add a pension contribution to your forecast →"
onClick: openEditModal(firstSipp)
```

**Any group (fallback, evaluated last per group):**
```
Condition: accounts in this group where include_in_net_worth === false
Copy: "One account is excluded from your net worth →"
onClick: openEditModal(firstExcludedAccount)
```

**Visual:** nudge buttons use `opacity: 1` (not muted). `dotColor` and `color` use the group's type accent. The nudge should be legible, not hidden.

**`openEditModal(account)` implementation:** `setEditing(account); setForm({...accountToForm(account)}); setModal(true)` — this is the existing edit flow.

---

#### Section 5 — Snapshot section

**Keep:** record button, history toggle, snapshot rows, delete action.

**Add: stale snapshot nudge.** Renders above the Record button when `daysSinceSnapshot > 30`:
`"It's been [N] days — record your position"` in amber treatment.

**Add: post-snapshot micro-link.** After successful `POST /snapshots`:
- Set `justRecorded = true` (local boolean state)
- Render: `"View your updated plan →"` → `setPage('outlook')`
- Clear after 5 seconds or on unmount

---

#### Section 6 — Composition (demoted, moved below Snapshots)

**Remove:** `DonutChart` component and its lazy-import render.

**Add:** text-only inline legend. A `flex flex-wrap gap-3` row of chips: `[coloured dot] · [type label] · [count]`. Use the `TYPE_ACCENT` colour map already defined in Accounts.jsx.

**Visibility:** hide when user has only 1 account type (`Object.keys(accountsByType).length <= 1`).

**Position:** below the Snapshots section.

---

#### Section 7 — CRUD modals

**Keep:** `Modal` (add/edit form), `ConfirmDialog`. Behaviour and fields unchanged.

---

#### State summary (Accounts)

| State | Change |
|---|---|
| `justRecorded` | New — boolean, set after successful snapshot POST |
| `daysSinceSnapshot` | New derived — from `snaps` array |

#### Free vs Pro

**Keep existing:** free-tier limit (3 accounts), usage bar, upgrade prompt.

#### Anti-duplication guardrails

- Monthly pace removed from header stat grid (belongs on Plan)
- Accounts count removed from header stat grid (not a wealth signal)
- DonutChart removed (text legend replaces it)
- No projection charts on Accounts
- No decision tools embedded (nudges route to Decisions, they do not embed tools)

#### Acceptance criteria

- [ ] Stat grid has exactly 3 cells: Total assets / Liabilities (conditional) / Last recorded
- [ ] Monthly pace absent from stat grid
- [ ] Accounts count absent from stat grid
- [ ] Liabilities cell hidden when liabilities = 0
- [ ] Last recorded cell shows amber treatment when >30 days stale
- [ ] `LedgerEntryRow` Zone 2 is empty (not "—") when monthly = 0
- [ ] `LedgerEntryRow` Zone 3 is empty (not "—") when rate = 0
- [ ] Each WealthGroup shows maximum 1 nudge
- [ ] Nudge buttons have full opacity (not muted)
- [ ] Stale snapshot nudge renders above Record button when >30 days stale
- [ ] Post-snapshot micro-link "View your updated plan →" renders after successful record
- [ ] DonutChart is absent
- [ ] Text-only composition legend renders below Snapshots
- [ ] Composition legend is hidden when only 1 account type exists

---

### Page 5 — Settings (`pages/Settings.jsx`)

**Core question:** How is the app configured?

---

#### Section 1 — Page label and auth

**Keep as-is.** Eyebrow label style (`text-xs font-semibold tracking-[.14em] uppercase`), username, logout button. Already correct.

---

#### Section 2 — Admin card

**Keep as-is.** Conditional on `isAdmin`. No change.

---

#### Section order change

**Reorder the JSX return.** Current order: Admin → Subscription → Appearance → Currency → FX → Dev.

**New order:** Admin → Appearance → Currency → Subscription → FX → Dev.

Appearance and Currency are the controls users most frequently change. Move them above Subscription. This is a JSX reorder only — no logic change.

---

#### Section 3 — Preferences (Appearance + Currency)

**Appearance card:** reduce padding from `p-7` to `p-5`. No other change.

**Currency card:** reduce padding from `p-7` to `p-5`. No other change.

---

#### Section 4 — Membership / billing (moved below Preferences)

**Keep all logic unchanged.** Portal link, refresh status, dev toggle, billing state.

**Keep:** Pro state (Crown badge, status label, action buttons) and free state (outcome-oriented copy + Upgrade CTA).

**Keep:** `p-7` padding on the subscription card — it is the most important card for free users.

**Keep:** existing free-tier copy ("Pro shows you the full picture — freedom timeline, real-terms projections, and what your money needs to do to get there."). Already improved; do not change.

---

#### Section 5 — FX rates (moved to bottom)

**Move:** below Subscription in the JSX order.

**Modify padding:** `p-7` → `p-5`.

**Remove:** the `<h3>` section header inside the FX card ("Exchange Rates"). The button label makes the purpose clear.

**Keep:** description text, "Refresh FX rates" button, status text output.

---

#### Section 6 — Developer (conditional)

**Keep as-is.** Dashed border, `IS_DEV` condition, pro toggle. No change.

---

#### Acceptance criteria

- [ ] Section order: Admin (cond) → Appearance → Currency → Subscription → FX → Dev (cond)
- [ ] Appearance card padding is `p-5`
- [ ] Currency card padding is `p-5`
- [ ] FX card padding is `p-5`
- [ ] FX card `<h3>` header is absent
- [ ] Subscription card is `p-7`
- [ ] Free-tier copy names specific outcomes (verify preserved from prior pass)
- [ ] No navigation CTAs to Plan, Decisions, or Accounts

---

## 3. Cross-Page Shared Logic

The following derivations are used on two or more pages. Define them once.

**Location:** add to `frontend/src/utils.js` or create `frontend/src/utils/planSignals.js`. All are pure functions with no side effects.

---

### `daysUntilTaxYearEnd()`

Currently duplicated inside `Strategy.jsx`. Extract.

```
Input: none (uses current date)
Returns: integer — days until 5 April of the current tax year end
Used by: Home (urgency strip), Strategy (eyebrow condition, tab default)
```

---

### `isIsaUrgent(isaRemaining, daysLeft, thresholdDays = 90, thresholdAmount = 500)`

```
Input: isaRemaining (number), daysLeft (number)
Returns: boolean
Used by: Home (urgency strip), Strategy (eyebrow, headline, tab default)
```

---

### `getDaysSinceSnapshot(snaps)`

```
Input: array of snapshot objects (sorted, most recent last)
Returns: integer | null
Used by: Home (signal strip amber), Accounts (stat grid amber, stale nudge)
```

---

### `isSnapshotStale(snaps, thresholdDays = 30)`

```
Input: snaps array
Returns: boolean
Used by: Home signal strip, Accounts stat grid cell
```

---

### `getPlanStatus(forecast)`

```
Input: forecast object (or null)
Returns: 'ahead' | 'on_track' | 'adjust' | null
Used by: Home (urgency strip), Plan (status badge, PlanSentence), Decisions (headline, tab default)
```

---

### `getDecisionsDefaultTab(forecast, accounts, isaRemaining, daysLeft)`

Priority order (first match wins):

```
1. isIsaUrgent(isaRemaining, daysLeft)          → 'isa'
2. accounts.some(a => a.type === 'mortgage')     → 'mortgage-overpayment'
3. getPlanStatus(forecast) === 'adjust'          → 'what-if'
4. default                                       → 'isa'
```

```
Returns: 'isa' | 'mortgage-overpayment' | 'mortgage-vs-savings' | 'what-if'
Used by: Strategy.jsx (useState initialiser), Plan inline Decisions CTA handler
```

---

### Session-persistent tab selection (Decisions)

`useState(() => getDecisionsDefaultTab(...))` gives session persistence through the component lifetime. On component unmount and remount (navigation away and back), the derived default recalculates from current data. Manual overrides persist within a visit. No `sessionStorage` needed.

---

### Freshness amber token

Amber treatment used consistently across Home signal strip, Home urgency strip, Accounts stat grid, and Accounts snapshot nudge:

```
text-amber-400
bg-amber-500/10
border-amber-500/20
text-amber-700 dark:text-amber-400  (for text-heavy contexts)
```

Define as a shared constant string if used in more than two places, or simply ensure the same Tailwind classes appear consistently.

---

### Insight rerouting

No shared helper needed. Each page that sources insights (Home) is responsible for setting `onClick` correctly at the point of insight array construction. Rule: no insight `onClick` calls `setPage('insights')`.

---

## 4. Removal / Migration List

### Old Home blocks — removed

| Block | Current location | Action |
|---|---|---|
| `MiniSparkline` in hero zone | Inside dark stage | Move to `PlanPreview` block |
| Milestone badge/ring in hero number zone | Inside dark stage | Remove; `MilestoneProgress` is already below |
| Trial badge `<button>` inside hero stage div | Inside dark stage | Move above the dark stage |
| `MetricRow` with accounts count + snapshot count | Below dark stage | Replace with 2-cell signal strip |
| `OnboardingPanel` multi-step card | Home lower | Replace with single conditional line |

### Plan duplicates — removed

| Block | Location | Action |
|---|---|---|
| `summaryLine` paragraph | Below stat strip, inside dark stage | Remove entirely |
| Second stat grid (if present) | Verify and remove | Keep only the 2c stat grid |

### Insights-era links and behaviours — deleted

| What | Action |
|---|---|
| `onSeeAll` prop passed to `InsightRail` on Home | Remove (pass `undefined`) |
| Any insight `onClick` routing to `setPage('insights')` | Replace with natural-destination routing |
| Sidebar nav item for Insights | Remove |
| BottomNav nav item for Insights | Remove |
| `PAGE_TITLES.insights` in App.jsx | Keep — route remains for temporary URL compatibility only. No new nav items, no CTAs, no `setPage('insights')` calls, no new code dependencies on this route. |
| Any "All insights →" links anywhere | Remove |

### What moves from Insights into Decisions

| Component | From | To | Change |
|---|---|---|---|
| `WhatIfCard` | `pages/WhatIfCard.jsx` | Strategy.jsx Tab 4 | Import; rename title from "Accelerate your milestone" to "Accelerate your plan" |

### Dead code — delete

**Safety rule:** before deleting any file, confirm zero imports and zero usages via grep (or equivalent repo search). If any import is found, do not delete — investigate first.

| File | Deletion condition |
|---|---|
| `components/outlook/PlanStrategyPreviewCard.jsx` | Delete after confirming no `import.*PlanStrategyPreviewCard` anywhere in the repo |
| `pages/ProProjectionCard.jsx` | Delete after confirming no imports and no `setPage` references |
| `pages/paddock-hero-slideshow.jsx` | Delete after confirming no imports and no `setPage` references |

### What stays unchanged on purpose

| What | Reason |
|---|---|
| All CRUD logic in Accounts.jsx | Correct; presentation-only changes |
| All hook logic in `useOutlookForecast`, `useProjectionData`, `useScenarioCompare` | Data layer is correct |
| `PlanHeroDashboard` calculation logic | Only the internal Card wrapper is flattened if present |
| `PlanIsaStrategyCard` | Used as Tab 1 in Decisions workbench |
| `MortgageOverpaymentTool` and `MortgageVsSavingsTool` | Used as Tabs 2 and 3; `LabField`/`LabResult`/`LabInterpretation` preserved inside them |
| ISA `localStorage` persistence pattern | Accepted as pragmatic; no architecture change |
| All error boundary logic in App.jsx | Unchanged |
| Settings billing state and logic | Unchanged |
| Shell (Sidebar, MobileNav, BottomNav) | Unchanged |
| Auth bootstrap and session handling | Unchanged |
| All animation and design tokens | Unchanged |
| `surfaces/` folder and all surface primitives | Unchanged; HeroStage adoption deferred (full-bleed pages keep inline dark stage) |

---

## 5. Implementation Order

Each step is independently shippable and does not break adjacent pages.

### Step 1 — Shared utils (est. 30 min)

Add to `utils.js` (or `utils/planSignals.js`):
- `daysUntilTaxYearEnd`
- `isIsaUrgent`
- `getDaysSinceSnapshot`
- `isSnapshotStale`
- `getPlanStatus`
- `getDecisionsDefaultTab`

These are pure functions. Extracting them from their current inline positions enables reuse and simplifies per-page logic.

---

### Step 2 — Plan cleanup (est. 1–2 hours)

a. Remove `summaryLine` paragraph from Outlook.jsx
b. Raise `PlanSentence` font size to `text-[19px] sm:text-[22px]`
c. Flatten `PlanHeroDashboard` internal Card wrapper if present (inspect PlanHeroDashboard.jsx)
d. Delete `components/outlook/PlanStrategyPreviewCard.jsx` — after grepping for imports first

---

### Step 3 — Settings reorder and polish (est. 30 min)

a. Reorder JSX: Appearance and Currency above Subscription
b. Reduce Appearance and Currency card padding to `p-5`
c. Reduce FX card padding to `p-5` and remove its `<h3>` section header

---

### Step 4 — Decisions: tab bar + WhatIfCard migration (est. 3–4 hours)

a. Add `accounts` state + `useEffect` fetch to Strategy.jsx
b. Rename `activeTool` → `activeTab`; initialise with `getDecisionsDefaultTab`
c. Add Tab 4: import `WhatIfCard`, pass `accounts` prop, update title copy
d. Add `usedTabs` Set state; wire field-change handlers to populate it
e. Wrap all four tools in `ToolWorkbench` with `proOnly={false}`
f. Remove priority row 3 from recommendation section
g. Apply eyebrow ISA-urgency condition
h. Add post-interaction micro-links in Scene 3
i. Modify "Open decision lab →" CTA to set `activeTab` to derived default

---

### Step 5 — Accounts cleanup (est. 2–3 hours)

a. Reduce stat grid to 3 cells; add amber treatment for stale Last recorded
b. Modify `LedgerEntryRow` to render empty (not "—") for zero monthly and zero rate
c. Extend `nudge` derivation in `Accounts` component to cover all five nudge conditions
d. Add `justRecorded` state; wire post-snapshot micro-link
e. Add stale snapshot nudge above Record button
f. Remove `DonutChart` component and lazy-import
g. Add text-only inline composition legend below Snapshots

---

### Step 6 — Home refactor (est. 3–5 hours)

a. Move trial badge above the dark stage
b. Raise grounding anchor opacity to `rgba(255,255,255,0.38)`
c. Move `MiniSparkline` from hero zone to `PlanPreview` block
d. Add `accounts` state + `useEffect` fetch
e. Replace `MetricRow` with 2-cell signal strip (freshness + milestone)
f. Add `UrgencyStrip` with 4-condition priority evaluation
g. Add Section 6 (primary action entry — mortgage / missing contribution)
h. Remove `onSeeAll` from `InsightRail` call
i. Audit insight `onClick` handlers; remove any `setPage('insights')` routing
j. Simplify `OnboardingPanel` to single conditional line

---

### Step 7 — Nav cleanup (est. 30 min)

a. Remove Insights from Sidebar nav items
b. Remove Insights from BottomNav nav items
c. Verify `page === 'insights'` route still resolves in App.jsx (keep for direct-URL resilience)

---

### Step 8 — Dead code deletion (est. 15 min)

For each file: grep for all imports and usages first. Delete only if zero results.

a. Grep `PlanStrategyPreviewCard` across repo → delete `components/outlook/PlanStrategyPreviewCard.jsx` if no imports found
b. Grep `ProProjectionCard` across repo → delete `pages/ProProjectionCard.jsx` if no imports found
c. Grep `paddock-hero-slideshow` across repo → delete `pages/paddock-hero-slideshow.jsx` if no imports found
d. Search codebase for remaining `setPage('insights')` calls; remove any found

---

### Step 9 — QA pass

Run full QA checklist below. Fix failures. Smoke test on mobile (375px) and desktop (1280px).

---

## 6. QA Checklist

### Home

**Content and order**
- [ ] Net worth number is the largest visual element on the page
- [ ] GoldDelta is directly below the hero number; not duplicated elsewhere
- [ ] Grounding anchor ("vs snapshot [date]") opacity is ≥ 0.38
- [ ] `MilestoneProgress` is inside the dark stage, below the hero number
- [ ] Trial badge is above (not inside) the dark hero stage
- [ ] Signal strip renders only when at least one cell has content
- [ ] Signal strip has exactly 2 cells: freshness + milestone proximity
- [ ] No accounts count in signal strip
- [ ] No snapshot count in signal strip
- [ ] No 90-day delta in signal strip
- [ ] Urgency strip shows maximum 1 signal; absent when none apply
- [ ] All 4 urgency conditions evaluate in priority order (not simultaneously)
- [ ] `PlanPreview` sparkline is positioned to the right of the projection number
- [ ] `PlanPreview` shows freedom year for Pro users
- [ ] `PlanPreview` shows a quiet PRO label for free users
- [ ] Section 6 action prompt is absent when no conditions match
- [ ] `InsightRail` has no "All →" link
- [ ] Onboarding is a single line, not a multi-step card

**No duplicate concept checks**
- [ ] 90-day delta appears exactly once (hero stage)
- [ ] No trajectory chart on Home
- [ ] No decision lab tools on Home
- [ ] No account editing controls on Home
- [ ] Sign-out button is absent from Home

**CTA routing**
- [ ] Urgency ISA → `setPage('strategy')`
- [ ] Urgency plan gap → `setPage('outlook')`
- [ ] Urgency concentration → `setPage('accounts')`
- [ ] Urgency large cash → `setPage('strategy')`
- [ ] Signal strip freshness cell → `setPage('accounts')`
- [ ] `PlanPreview` CTA → `setPage('outlook')`
- [ ] Section 6 mortgage → `setPage('strategy')`
- [ ] Section 6 contribution → `setPage('accounts')`
- [ ] No `onClick` anywhere on Home routes to `setPage('insights')`

**Conditional rendering**
- [ ] Signal strip absent when no snapshots and no milestone target
- [ ] Urgency strip absent when no conditions match
- [ ] Section 6 absent when no conditions match
- [ ] Onboarding absent when both goal and accounts exist
- [ ] Trial badge absent when user is not trialling or >14 days remain

---

### Plan

**Content and order**
- [ ] `PlanSentence` renders before any chart, number, or input
- [ ] `PlanSentence` font is `text-[19px] sm:text-[22px]`
- [ ] `PlanHeroDashboard` content is flat against the stage (no internal Card wrapper)
- [ ] `summaryLine` paragraph is absent
- [ ] Stat grid (Wealth / Gap / Return / Monthly) appears exactly once
- [ ] No second stat grid anywhere on the page
- [ ] Inline "Open Decisions →" pull at bottom of dark stage
- [ ] `DecisionsHandoff` is the last content section before the modal

**No duplicate concept checks**
- [ ] `PlanSentence` is the only interpretation paragraph on the page
- [ ] `PlanStrategyPreviewCard.jsx` does not exist in the repo

**CTA routing**
- [ ] "Open Decisions →" in inline pull → `setPage('strategy')`
- [ ] `DecisionsHandoff` → `setPage('strategy')`
- [ ] Edit plan button → opens `EditPlanModal`

**Free vs Pro**
- [ ] Inflation toggle visible to Pro only
- [ ] `ScenarioCompareCard` shows upgrade gate for free users
- [ ] Freedom timeline block renders for Pro; upgrade gate for free

---

### Decisions

**Content and order**
- [ ] Eyebrow renders only when ISA urgency is active
- [ ] Headline adapts to three conditions (ISA / gap / neutral)
- [ ] Exactly 2 priority rows (row 3 removed)
- [ ] Tab bar has exactly 4 tabs in fixed order
- [ ] Tab 1: ISA strategy
- [ ] Tab 2: Mortgage overpayment
- [ ] Tab 3: Where next pounds go
- [ ] Tab 4: Accelerate your plan (`WhatIfCard`)
- [ ] `WhatIfCard` title is "Accelerate your plan" (not "milestone")
- [ ] `WhatIfCard` receives accounts array
- [ ] Conclusion section has "View plan →" button
- [ ] Post-interaction ISA micro-link appears after interacting with Tab 1
- [ ] Post-interaction mortgage micro-link appears after interacting with Tab 2

**No duplicate concept checks**
- [ ] No plan trajectory chart on Decisions
- [ ] No account editing modals on Decisions
- [ ] No third priority row containing meta-advice

**CTA routing**
- [ ] "Open decision lab →" CTA focuses context-appropriate tab
- [ ] "View plan →" → `setPage('outlook')`
- [ ] Post-ISA micro-link → `setPage('accounts')`
- [ ] Post-mortgage micro-link → `setPage('accounts')`

**Tab behaviour**
- [ ] Default tab on first mount is context-driven
- [ ] Manual tab change persists within the session
- [ ] Navigating away and back resets to context-driven default

**Free vs Pro**
- [ ] All 4 tabs are visible to all tiers
- [ ] `WhatIfCard` lump-sum mode is Pro-gated
- [ ] `ToolWorkbench` pro-lock overlay does not appear (gating is inside tools)

---

### Accounts

**Content and order**
- [ ] Stat grid has exactly 3 cells: Total assets / Liabilities (conditional) / Last recorded
- [ ] Monthly pace absent from stat grid
- [ ] Accounts count absent from stat grid
- [ ] Liabilities cell hidden when `totalLiabilities = 0`
- [ ] Last recorded cell shows amber treatment when >30 days stale
- [ ] `LedgerColumnHeader` renders: Account · Monthly · Rate · Balance
- [ ] Wealth groups render in fixed order (Cash → Investments → Pensions → Property → Other → Liabilities)
- [ ] Empty groups are hidden
- [ ] `LedgerEntryRow` Zone 2 is empty (not "—") when `monthly = 0`
- [ ] `LedgerEntryRow` Zone 3 is empty (not "—") when `rate = 0`
- [ ] Each group shows maximum 1 nudge
- [ ] Nudge buttons have full opacity
- [ ] Stale snapshot nudge renders above Record button when >30 days stale
- [ ] Post-snapshot "View your updated plan →" renders after successful record
- [ ] `DonutChart` is absent
- [ ] Text-only composition legend renders below Snapshots
- [ ] Composition legend hidden when only 1 account type exists

**No duplicate concept checks**
- [ ] No plan trajectory chart on Accounts
- [ ] No decision workbench tools on Accounts
- [ ] Monthly pace absent as a stat (belongs on Plan)

**CTA routing**
- [ ] Liabilities nudge → `setPage('strategy')` (Decisions, mortgage tab)
- [ ] Investment contribution nudge → opens edit modal on first matching account
- [ ] Investment return nudge → opens edit modal on first matching account
- [ ] Pensions nudge → opens edit modal on first SIPP
- [ ] Excluded account nudge → opens edit modal on excluded account
- [ ] Post-snapshot micro-link → `setPage('outlook')`

**Free vs Pro**
- [ ] Free-tier usage bar visible when user is at or near account limit
- [ ] Upgrade prompt visible when at the account limit

---

### Settings

**Content and order**
- [ ] Section order: Admin (cond) → Appearance → Currency → Subscription → FX → Dev (cond)
- [ ] Appearance card padding is `p-5`
- [ ] Currency card padding is `p-5`
- [ ] FX card padding is `p-5`
- [ ] FX card has no `<h3>` section header
- [ ] Subscription card is `p-7`
- [ ] Free-tier copy names specific outcomes (verify not reverted)

**No duplicate concept checks**
- [ ] No plan trajectory on Settings
- [ ] No account list on Settings
- [ ] No CTAs routing to Plan, Decisions, or Accounts

---

### Cross-page / global

**Deprecated Insights leakage**
- [ ] Sidebar contains no Insights nav entry
- [ ] BottomNav contains no Insights nav entry
- [ ] Zero `setPage('insights')` calls in any non-Admin page component
- [ ] No "All insights →" or "All →" links in `InsightRail` or anywhere in the app
- [ ] `WhatIfCard` renders inside Strategy.jsx Tab 4 — not on a standalone page

**Stale data coherence (amber token)**
- [ ] Home signal strip uses amber when `daysSinceSnapshot > 30`
- [ ] Accounts stat grid uses amber when `daysSinceSnapshot > 30`
- [ ] Both use the same amber Tailwind classes: `text-amber-400 / bg-amber-500/10 / border-amber-500/20`

**No duplicate concepts (global)**
- [ ] 90-day delta appears on Home only
- [ ] Long-term trajectory chart appears on Plan only
- [ ] Decision workbench tools appear on Decisions only
- [ ] Account editing modals appear on Accounts only
- [ ] Monthly pace as a hero stat appears on Plan only
- [ ] Interpretation paragraph appears on each page exactly once
