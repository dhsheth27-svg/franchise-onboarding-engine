# Opsmith: franchise partner onboarding engine

Ops Hackathon, Case 1. A public, login-free web app that takes a franchise brand's **Applications** and
**Territories** (Excel), decides what should happen to every applicant, explains why in plain language,
builds onboarding plans for those who move forward, tells the expansion team what to do today, and
answers follow-up questions and updates ("Why is APP-007 on hold?", "APP-012 has now found a
ground-floor space"), re-deciding and showing what changed.

**Live demo:** https://opsmith-app.vercel.app · Click **Watch the 2-minute guided demo** for a 10-step live walkthrough (explained hold → the brief's APP-012 update → a withdrawal promoting the waitlist → a refused override → the Journey board → the policy simulator → a printable one-pager), or **Sample data** to explore freely.

## What it does

| Where the journey leaks | What the app does |
|---|---|
| Slow, inconsistent screening | Instant decision for every applicant, with a full trace of every check and the numbers used |
| Incomplete applications drift away | Holds come with a specific ask, a deadline and a ready message in the applicant's language (English / Kannada / Hindi) |
| Competition for slots | Ranked allocation, one store per pin, waitlists, and redirects to free pins/territories instead of rejections |
| Approved partners stall | 30-day slot reservations; lapsed reservations release the slot and the waitlist is promoted automatically |
| No clear list of who to chase | **Today** tab: an action queue ranked by value |
| Drop-off | Risk flag with reasons and a suggested action |
| Partners open unprepared | Gap-based onboarding plan (training depth by experience, extra modules, site checks), documents, readiness check |
| Teams can't overrule the tool | Overrides with a logged name and reason; the three hard rules can never be broken |
| Approved partners stall between agreement and opening | **Journey board**: every partner by stage (Agreement → Site → Fit-out & stock → People & training → Readiness → Launch → Open) with overdue flags, the bottleneck stage and one-click progress |
| Messages are written but never sent | **Outbox**: every message in the applicant's language with WhatsApp / email buttons, "mark as sent" tracking, and a warning when the decision changed after sending |
| Thresholds are guesses | **Policy simulator**: change the approval bar, minimums, reservation window or territory slots, preview exactly who changes, then apply it as a logged version |
| Committee and partner files | **Printable one-pager** per applicant with the decision, reasons, checks, next steps and sign-off lines |

## Outcomes

- **Approved / Approved with conditions**: slot and pin reserved for 30 days; conditions come from data warnings (e.g. a "before Diwali" note that conflicts with the timeline).
- **On hold**: fixable. The decision states exactly what is needed, plus the provisional score and rank.
- **Waitlisted**: qualified, but no slot or pin is free right now (with position and redirects).
- **Rejected**: not viable as submitted, always with redirects when any exist.

### The three hard rules (asserted after every run, override and follow-up)
1. Never two stores in the same pin code (existing stores count).
2. Never more approvals in a territory than its open slots.
3. Never approve an applicant whose pin is outside all territories.

## How a decision is made

`runEngine(input, config, today) -> RunResult` is a pure TypeScript function (`lib/engine`), with no database or network inside.

1. **Clean and validate** (`validate.ts`, `normalize.ts`, `signals.ts`): pins like `570001.0` or ` 560 010`, "₹25 lakh", "GF", "rent", synonyms and city spellings; flags graded **Blocking / Warning / Info**; free-text signals (business relevance, part-time, hired manager, loan pending, flexibility, deadlines such as Diwali).
2. **Hard gates G1–G7** (`decide.ts`): every gate is run and recorded; the first failure sets the outcome (a reliable rejection beats a hold, see `DECISIONS.md`).
3. **Score 0–100** (`score.ts`): financial 25, operator 20, site 25, launch 10, territory 20, minus up to 10 for cannibalisation. Names and personal details are never used.
4. **Allocation** (`decide.ts`): overrides first, then rank order per territory; pins taken, slots full, real capacity = min(slots, free pins).
5. **Post-decision** (`whatif.ts`, `post.ts`, `messages.ts`, `actions.ts`): redirects with projected rank, "what would change this" (found by re-running the engine on changed inputs), onboarding plans, reservations, risk, messages, action queue.

Every follow-up, override, checklist change or date move is stored as an **event**, so a run is fully replayable; each change saves a **new run version** with a before/after diff across all applicants.

The optional LLM (OpenAI API) only reads free text and parses follow-up messages into a validated structure. **It never decides an outcome**, and the app works fully without it (keyword/regex rules).

## Assumptions (all in `lib/config.ts`, shown in the app under "Rules in use")

| Assumption | Value | Why |
|---|---|---|
| Minimum investment (₹ lakh) | Tier 1: 30; Tier 2: 20; Tier 3: 12 | Security deposit + fit-out + opening inventory + 3 months of working capital; bigger cities cost more on every line. |
| Minimum shop size (sq ft) | Tier 1: 250; Tier 2: 200; Tier 3: 150 | Smallest floor plate that fits the standard display, a billing counter and a small stock room. |
| Ideal shop size range (sq ft) | Tier 1: 300–800; Tier 2: 250–700; Tier 3: 200–600 | Big enough for the full range, small enough that rent stays proportionate to expected sales. |
| Lead time to open (months) | withSpace: 2; withoutSpace: 5 | About 2 months for agreement, fit-out, stock and training once a space exists; finding and securing a space adds roughly 3 more. |
| Default target launch (months) | 4 | Used when the applicant leaves the field blank; a typical stated ambition in franchise enquiries. |
| Capital shortfall that still gets a hold | 0.25 | A gap of up to 25% can usually be closed with a family contribution or small loan; beyond that the plan is not viable as submitted. |
| Approval bar (score out of 100) | 50 | Midpoint of the rubric: an applicant must be at least average across all pillars after passing every gate. |
| Near-miss margin (points) | 5 | Applicants this close below the bar are held with a clear ask rather than rejected, because one fix lifts them over. |
| Close-call margin (points) | 3 | A contested slot decided by 3 points or less is shown to the team for a second look. |
| Concentration warning share | 0.6 | If more than 60% of approvals land in one city, growth is not spreading as intended. |
| Pillar weights (sum 100) | financial: 25; operator: 20; site: 25; launch: 10; territory: 20 | Money and site carry most weight because they decide whether a store can open at all; operator skill can be trained; launch timing is the least predictive. |
| Maximum cannibalisation deduction (points) | 10 | Enough to break ties against crowding existing stores without overruling a strong applicant. |
| Stores per city before it counts as crowded | Tier 1: 8; Tier 2: 3; Tier 3: 2 | Rough catchment capacity per city size; used to scale the city part of the cannibalisation deduction (up to 4 points). |
| Pin-closeness deduction (points) | sameFirst5: 6; sameFirst4: 3 | Stand-in for distance because no coordinates are provided: pins sharing 5 digits are usually neighbouring areas, 4 digits the same broad zone. |
| Slot reservation window (days) | 30 | Time an approved partner has to sign the agreement and confirm the space before the slot goes to the waitlist. |
| Condition deadline (days) | 14 | Conditions are small clarifications; two weeks keeps momentum without being unreasonable. |
| "Due soon" window (days) | 7 | One working week of notice before a deadline lapses. |
| Drop-off risk thresholds | longGapMonths: 9; thinCapitalRatio: 1.1 | Partners waiting more than 9 months tend to lose interest; capital within 10% of the minimum leaves no buffer for overruns. |
| Payback assumptions (ILLUSTRATIVE) | revenuePerSqftMonth: Tier 1: 1500; Tier 2: 1100; Tier 3: 900; grossMarginPct: 40; baseCostsMonthLakh: Tier 1: 0.6; Tier 2: 0.4; Tier 3: 0.3; rentPerSqftMonth: Tier 1: 150; Tier 2: 80; Tier 3: 50 | Illustrative benchmarks only: monthly sales per sq ft, gross margin, staff + utilities, and rent per sq ft (zero if the space is owned). Payback = minimum investment / monthly profit. Shown for context, never scored. |
| Festival dates | Diwali 2026: 2026-11-08; Diwali 2027: 2027-10-29 | Applicants often tie openings to festivals; used to check notes like "before Diwali" against the target launch (Diwali 2026 = 8 Nov 2026). |
| Impossible-value limits | maxExperienceYears: 60; maxSpaceSqft: 20000; maxInvestmentLakh: 10000; maxTargetLaunchMonths: 60 | Values beyond these are almost certainly typing errors and are held for confirmation rather than scored. |
| Onboarding stage durations (weeks) | agreement: 2; spaceVerification: 2; fitOut: 4; staffHiring: 3; inventorySetup: 2; readinessCheck: 1; softLaunch: 1 | Typical small-format retail roll-out: legal and KYC in 2 weeks, fit-out in about a month, hiring and stock set-up in parallel. |
| Training length by track (weeks) | Extended: 4; Standard: 2; Compressed: 1 | 0–1 years of experience: extended programme with a mentor and supervised pilot weeks; 2–4 years: standard; 5+ years: compressed, brand processes only. |
| Days per month (for date maths) | 30 | Simple 30-day months keep deadlines easy to explain. |

All values are team assumptions to defend, not facts about a real brand. Payback figures are illustrative.

> **Kannada and Hindi templates should be reviewed by a native speaker.**

## Running it

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest: SPEC section 20 cases, follow-ups, property tests on the hard rules
npm run build
```

Environment variables (`.env.local`):

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | No | Neon Postgres connection string. Without it runs are kept in memory (fine locally; on serverless hosts runs may disappear between requests). The schema (`db/schema.sql`) is applied automatically on first use. |
| `OPENAI_API_KEY` | No | Enables AI reading of free text and follow-up messages (structured JSON output, validated). Every call has a timeout and falls back to rules. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |

## Input format

Exactly the case template: sheets **Applications** (header row found by the "Application ID" cell; the grey example row is skipped), **Territories**, and optionally **Existing stores** (the fixed list from the brief is used if it is missing). Sheet and column names are matched case-insensitively. Download a blank template or the sample workbook from the home page.

## Repository map

```
lib/config.ts         every threshold, weight and assumption, with rationale
lib/engine/           pure decision engine (validate, gates, score, allocate, what-if, post, messages, actions, diff)
lib/excel.ts          workbook parsing and templates; lib/export.ts Excel/CSV export
lib/followup.ts       follow-up intents and trace-based answers; lib/llm.ts optional LLM parsing
lib/store.ts          Neon / in-memory storage of run versions and chat
app/                  Next.js pages and API routes
tests/                vitest suites
SPEC.md               the brief · DECISIONS.md interpretation calls · CLAUDE.md working notes
```

## API

`POST /api/upload` (multipart xlsx) · `POST /api/sample` · `GET /api/runs/[id]` · `GET /api/runs/[id]/history` · `GET /api/runs/[id]/diff?from=` · `POST /api/runs/[id]/followup` · `POST /api/runs/[id]/events` · `GET /api/runs/[id]/export` (`?format=csv`) · `GET /api/template`

## Out of scope (roadmap)

Partner-facing portal, WhatsApp/SMS sending, document upload and verification, real training assessments, CRM integration, roles and permissions, and maps/geocoding for true distance-based cannibalisation (pin closeness is used as a stand-in).
