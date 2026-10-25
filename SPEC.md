# FINAL BUILD PROMPT: Franchise Partner Onboarding Engine (Ops Hackathon, Case 1)

Give this whole document to Claude Code as the project brief. Save it in the repo as `SPEC.md` so it can be re-read at any time.

---

## 0. HOW TO WORK ON THIS (instructions for Claude Code)

1. Read this entire spec before writing code. Then reply with a short build plan that follows the phases in section 22, and wait for a "go".
2. Create a `CLAUDE.md` in the repo root that summarises: the stack, the three hard rules (section 6), the layer order (section 2), the outcome definitions, and the commands to run tests and the dev server. Keep it under 60 lines.
3. Build the decision engine first, test-first, as pure TypeScript with no UI. Use the test cases in section 20.
4. Keep the app deployable after every phase. Commit after each phase with a clear message. Run `npm run build` and `npm test` before every commit.
5. Use few dependencies. Do not add an ORM, auth library, state-management library or component kit beyond what is listed here unless asked.
6. If anything in this spec is ambiguous or contradictory, choose the simplest reasonable interpretation, write it in `DECISIONS.md`, and continue. Ask before changing a hard rule, the layer order, or the outcome definitions.
7. Priorities are labelled **[MUST]**, **[SHOULD]** and **[STRETCH]**. Finish all MUST items across all phases before any STRETCH item.

---

## 1. ROLE, GOAL AND THE PAIN WE ARE SOLVING

You are a senior full-stack engineer. Build a **public, login-free web app** that acts as a Franchise Partner Acquisition, Geo-Selection and Onboarding Engine for a fast-growing retail brand opening franchise stores in Karnataka, India.

**The pain:** the journey from a partner's first application to an open, trained store is slow and leaky, and it all sits on the expansion team. Leaks happen at every stage:

| Stage | Where it leaks | What the app does about it |
|---|---|---|
| Screening | Manual review is slow and inconsistent | Instant, explained decisions for every applicant |
| Incomplete applications | "On hold" with no clear ask, so applicants drift away | Specific info-request messages in the applicant's language, with deadlines |
| Competition for slots | Conflicts resolved ad hoc; good leads rejected | Ranked allocation, waitlists, and redirects to free slots instead of rejections |
| After approval | Approved partners stall and block slots | Time-limited slot reservations with automatic promotion from the waitlist |
| Team workload | No clear list of who to chase | A daily action queue ranked by value |
| Drop-off | Nobody spots at-risk partners early | A drop-off risk flag with reasons |
| Opening | Partners open unprepared | A gap-based onboarding plan, document checklist, and readiness check before opening |
| Trust | Teams work around tools they cannot overrule | Human override with a logged reason, respecting the hard rules |

**What the user does:** uploads an Excel file of **Applications** and **Territories**. The app decides what should happen to every applicant, explains why in plain language, builds onboarding plans for those who move forward, tells the team what to do next, and answers follow-up questions ("Why is APP-007 on hold?") and updates ("APP-012 has now found a ground-floor space"), re-deciding sensibly and showing what changed.

**How it is judged:** how well it solves the business problem (not technical depth), clarity of reasoning and explanation, handling of messy and contradictory data, follow-up behaviour. There is no single right answer. Clear, traceable reasoning beats clever code. A demo video will be recorded, so the main flow must be smooth and visually clear.

**Hard requirement:** the deployed link must work for strangers with no login, no setup and no help.

---

## 2. ARCHITECTURE PRINCIPLES (non-negotiable)

1. **The decision engine is a pure TypeScript function:** `runEngine(input, config, today) -> RunResult`, where `input` holds applications, territories, existing stores, overrides and events (section 13). No database or network calls inside it. Follow-ups, overrides, counterfactuals and what-ifs all work by changing the input and re-running.
2. **Layer order:** (1) clean and validate, (2) hard gates, (3) rubric scoring, (4) allocation under constraints, (5) post-decision layer (onboarding, reservations, risk, messages, action queue).
3. **Every decision carries a full trace:** an ordered list of checks, each with a reason code, pass/fail/flag, the values used, and a human-readable sentence. Explanations are generated FROM the trace, never invented.
4. **All thresholds, weights and assumptions live in one `lib/config.ts`**, each with a one-line `rationale`, and are shown in a "Rules in use" panel.
5. **Never use the applicant's name or any personal attribute in scoring.**
6. **Never crash on bad data.** Anything unparseable becomes a flagged issue on that applicant, not an error for the whole run.
7. **The LLM never decides outcomes.** It may only extract signals from free text, parse follow-up messages into structured intents, and polish wording of already-computed answers.

---

## 3. TECH STACK (fixed)

- **Next.js 14+ (App Router), TypeScript, Tailwind CSS**, deployed on **Vercel**.
- **Neon Postgres** via `@neondatabase/serverless` (plain SQL, one migration file, no ORM).
- **GitHub** repo with Vercel auto-deploys.
- **SheetJS (`xlsx`)** to parse and export Excel. **zod** for validation. **vitest** for tests.
- Optional LLM: Anthropic API with the key in `ANTHROPIC_API_KEY`. **The app must work fully without the key** using deterministic keyword/regex fallbacks. Every LLM call has a timeout and falls back on any failure.
- Environment variables: `DATABASE_URL`, `ANTHROPIC_API_KEY` (optional). If `DATABASE_URL` is missing, fall back to in-memory storage so the app runs locally.
- No authentication. Runs are identified by an unguessable random ID in the URL (`/run/[id]`).

---

## 4. INPUT FORMAT (exact)

Match sheet names case-insensitively and trim whitespace.

**Applications** (one row per applicant). Locate the header row by scanning for the cell "Application ID" (there is a title line above the headers and a grey example row; treat every row below the header with a non-empty Application ID as data; skip fully blank rows).
Columns: `Application ID`, `Applicant name`, `City`, `State`, `Pin code`, `Investment capacity (₹ lakh)`, `Retail experience (years)`, `Current / past business`, `Space available` (Owned / Rented / Not yet identified), `Space size (sq ft)`, `Floor` (Ground / Upper / Mall unit / Not known), `Target launch (months)`, `Preferred language` (Kannada / English / Hindi), `Notes from applicant`.
Required: ID, name, city, state, pin, investment, experience, space available. Everything else may be blank.

**Territories** (one row per territory): `Territory ID`, `City`, `State`, `Pin codes covered` (comma-separated text), `City tier` (Tier 1/2/3), `Open slots` (number: how many MORE stores), `Priority` (High/Medium/Low). Applications do NOT carry a territory ID; link applicants to territories by pin code.

**Existing stores** (fixed): `Store ID`, `City`, `Pin code`, `Opened (year)`. If the sheet is missing, use this embedded copy:
ST-01 Bengaluru 560001 2019; ST-02 Bengaluru 560034 2020; ST-03 Bengaluru 560038 2021; ST-04 Bengaluru 560066 2022; ST-05 Bengaluru 560076 2023; ST-06 Mysuru 570009 2021; ST-07 Mysuru 570017 2024; ST-08 Mangaluru 575001 2022; ST-09 Hubballi-Dharwad 580020 2023; ST-10 Belagavi 590001 2024.

**City to pin prefix to tier map (embed in config):** Bengaluru 560 Tier 1; Mysuru 570 Tier 2; Mangaluru 575 Tier 2; Hubballi-Dharwad 580 Tier 2; Belagavi 590 Tier 2; Tumakuru 572 Tier 3; Davanagere 577 Tier 3. State is always Karnataka. Preferred language is one of Kannada, English, Hindi.

### Parsing robustness [MUST]
- Pin codes arrive as numbers (`570001.0`) or text with spaces: normalise to a 6-character string; if not exactly 6 digits, flag `PIN_INVALID`.
- Trim whitespace; case-insensitive enums; tolerate synonyms ("ground floor"/"GF" = Ground, "own"/"owned" = Owned, "rent"/"leased" = Rented, "n/a"/"-"/blank = missing).
- Numbers may arrive as strings with commas, "₹", "lakh", "yrs", "sq ft": strip and parse; unparseable becomes missing plus a data-quality flag.
- Territory pins: split on commas, normalise each, ignore blanks. A pin in more than one territory: flag `TERRITORY_OVERLAP` in the data-issues report and assign it to the first.
- Duplicate Application IDs: keep the first, flag later ones `DUPLICATE_ID` (HOLD). Same name plus same pin under different IDs: flag `DUPLICATE_APPLICANT`; keep the higher-scoring one and HOLD the rest with an explanation.
- Up to 500 rows per sheet must process in a few seconds.
- Produce a **Data Quality Report** per run: what was cleaned, inferred, missing or contradictory, per applicant.

---

## 5. LAYER 1: VALIDATION AND CONTRADICTION FLAGS [MUST]

Each flag has a severity: `BLOCKING` (cannot decide, results in HOLD), `WARNING` (decide but record; lowers confidence; may become a condition), `INFO`.

- `MISSING_REQUIRED` (BLOCKING): a required field is blank or unparseable.
- `PIN_INVALID` (BLOCKING).
- `STATE_NOT_KARNATAKA` (BLOCKING).
- `PIN_CITY_MISMATCH` (BLOCKING): the pin prefix belongs to a different city than stated. Say which city the prefix belongs to and ask the applicant to confirm.
- `SPACE_SIZE_MISSING` (BLOCKING if Owned or Rented).
- `SPACE_SIZE_WITHOUT_SPACE` (WARNING): "Not yet identified" but a size is given. Treat as no space.
- `FLOOR_MISSING` (INFO).
- `LAUNCH_MISSING` (INFO): use the default from config.
- `LAUNCH_UNREALISTIC` (WARNING): target launch shorter than the minimum lead time.
- `NOTE_TIMELINE_CONFLICT` (WARNING): notes mention a deadline or festival that conflicts with the Target launch field (e.g. "before Diwali" with target 3 months). Festival dates live in config. Compare against the run date.
- `NOTE_EXPERIENCE_CONFLICT` (WARNING): e.g. experience 0 but the business text says "running my shop for 5 years".
- `NOTE_COMMITMENT_RISK` (INFO): side business, part-time, will hire a manager, loan pending.
- `NEGATIVE_OR_IMPOSSIBLE_VALUE` (BLOCKING): negative investment, experience over 60, size over 20,000 sq ft, etc.

### Free-text extraction: `extractSignals(businessText, notesText)`
Returns `{ businessCategory, relevance: 'high'|'medium'|'low'|'unknown', commitment: 'full'|'partial'|'unknown', mentionsDeadline, deadlineDate?, hiresManager, loanPending, flexibleOnLocation, contradictions[] }`.
Deterministic version: keyword lists. High relevance: footwear, apparel, garments, mobile, electronics, accessories, eyewear, optical, grocery, kirana, pharmacy, cosmetics, general retail, franchise owner. Medium: restaurant, cafe, salon, distributor, wholesale, sales job. Low: IT job, office job, student, homemaker, none. If the LLM key exists, call the model with strict JSON output, validate with zod, and fall back to deterministic on any failure. Store which method produced the signals.

---

## 6. LAYER 2: HARD GATES AND HARD RULES [MUST]

Run every gate and record every result in the trace (so the user sees everything wrong at once). The first failing gate in this order sets the outcome.

| # | Gate | Fail outcome | Reason code |
|---|------|--------------|-------------|
| G1 | No BLOCKING flags | **HOLD** | the flag codes |
| G2 | Pin belongs to a territory | **REJECT**, with redirect suggestions (section 11) | `OUTSIDE_TERRITORIES` |
| G3 | No existing store in that pin | **REJECT**, with redirect suggestions | `PIN_HAS_STORE` |
| G4 | Territory has open slots above 0 | **WAITLIST**, with redirect suggestions | `NO_SLOTS` |
| G5 | Investment at least the tier minimum | shortfall 25% or less of the minimum: **HOLD** (`CAPITAL_SHORTFALL_SMALL`, state the exact shortfall); more: **REJECT** (`CAPITAL_INSUFFICIENT`) | |
| G6 | Space identified (Owned or Rented) | **HOLD**, still gets a provisional score and rank | `SPACE_NOT_IDENTIFIED` |
| G7 | Space at least the tier minimum size | **HOLD** | `SPACE_TOO_SMALL` |

**The three hard rules** (enforced again as final assertions after allocation, after overrides and after every follow-up; they can never be broken, not even by a human override):
1. Never two stores in the same pin code (existing stores count).
2. Never more approvals in a territory than its open slots.
3. Never approve an applicant whose pin is outside all territories.

---

## 7. LAYER 3: RUBRIC SCORE (0 to 100) [MUST]

Applies to every applicant with enough data, including HOLD applicants as a "provisional score". Five pillars plus one deduction. Each pillar computes 0..100 internally, then is weighted.

| Pillar | Weight | Inputs and scoring logic |
|---|---|---|
| **Financial strength** | 25 | ratio = investment / tier minimum. Piecewise linear: ratio below 1 gives 0 to 40; 1.0 gives 50; 1.5 gives 75; 2.0 or more gives 100. Also compute an **estimated payback (months)** from config assumptions and display it (informational, not double counted). |
| **Operator capability** | 20 | 60% experience curve (0y=0, 1y=30, 2y=55, 3y=70, 5y=90, 7y+=100) plus 40% business relevance (high=100, medium=60, low=20, unknown=40). Partial commitment or "will hire a manager" reduces the pillar by up to 15 points. |
| **Site readiness** | 25 | tenure 40% (Owned 100, Rented 75, none 0); size fit 35% (100 inside the tier's ideal range, falling to 40 at the minimum, also falling for space beyond 2x the ideal maximum); floor 25% (Ground 100, Mall unit 90, Upper 50, Not known or missing 40). |
| **Launch realism** | 10 | 100 if the target launch is at or beyond the needed lead time (2 months with space, 5 without); minus 25 per missing month; slightly reduced above 12 months (it blocks a slot). Missing target uses the default. |
| **Territory value** | 20 | priority 60% (High 100, Medium 65, Low 35); market maturity 40% (city has a store opened 2+ years ago: 100; only stores opened within the last year: 60; no stores in the city: 40). |
| **Cannibalisation deduction** | up to -10 | based on (a) existing stores in the same city relative to the tier and (b) numeric pin closeness to any existing store (same first 5 digits: heavy; same first 4: moderate). Say plainly that pin closeness is a stand-in because no coordinates are provided. Exact-pin conflicts are handled by G3. |

Final score = weighted pillars minus deduction, clamped 0..100. Approval bar `MIN_SCORE_TO_APPROVE` (default 50). Passing all gates but scoring below the bar: **REJECT** (`SCORE_BELOW_BAR`), naming the weakest pillar; if within `nearMissMargin` (5) of the bar, **HOLD** instead and say what would lift them.

**Confidence (High/Medium/Low)** comes from data-quality flags and conflicts, is shown next to the decision, and is NOT part of the score.

---

## 8. LAYER 4: ALLOCATION UNDER CONSTRAINTS [MUST]

Eligible set: passed G1 to G7 and met the score bar.

1. Group eligible applicants by territory. Sort by score descending. Tie-breakers: Owned over Rented, more experience, higher investment ratio, lower Application ID.
2. Apply **human overrides first** (section 14): forced approvals take their slot and pin before ranked allocation, provided they do not break a hard rule.
3. `takenPins` starts as all existing store pins (global across territories).
4. Walk each group in order:
   - pin already in `takenPins` (taken by a higher-ranked applicant): **WAITLIST**, `PIN_TAKEN_BY_HIGHER_RANK`, naming the winner, their score and the margin, plus redirect suggestions.
   - no slots remaining: **WAITLIST**, `SLOTS_FULL`, naming the last approved applicant and the margin, plus redirect suggestions.
   - otherwise **APPROVED**, or **APPROVED_WITH_CONDITIONS** if any WARNING flag exists (unrealistic launch, note conflict, etc.), listing each condition. Decrement slots, add the pin to `takenPins`, and create a **slot reservation** (section 10).
5. Real capacity per territory = min(open slots, number of free pins). Report both.
6. Keep waitlist order. When an approval is released (withdrawal, expired reservation, override), the next eligible waitlisted applicant is promoted on re-run.
7. **Provisional rank** for HOLD applicants: "would rank #N in territory X if the hold cleared", computed by inserting them into the ranking without taking a slot.
8. **Final assertions:** hard rules 1 to 3. Throw in tests; in production, log and surface a visible error banner.

**Outcomes (final):** `APPROVED`, `APPROVED_WITH_CONDITIONS`, `HOLD`, `WAITLISTED`, `REJECTED`.
HOLD = fixable, here is exactly what is needed. WAITLISTED = qualified, but no slot or pin free right now. REJECTED = not viable as submitted (always with redirect suggestions when any exist).

---

## 9. ONBOARDING PLAN, DOCUMENTS AND READINESS (APPROVED and APPROVED_WITH_CONDITIONS)

### 9a. Gap-based onboarding plan [MUST]
A dated checklist (week offsets from approval and actual dates from the run date) with owner (Brand / Partner / Both) and status (Not started / In progress / Done / Blocked).
1. **Backbone stages:** agreement and KYC; space verification and approval; fit-out and signage; inventory and billing system setup; staff hiring; training; readiness check; soft launch; grand opening.
2. **Training depth by experience:** 0 to 1 years: extended programme, assigned operations mentor, supervised pilot weeks. 2 to 4 years: standard. 5+ years: compressed, focused on brand processes.
3. **Low business relevance:** add product-knowledge and customer-handling modules.
4. **Space gaps:** unknown floor adds a site visit; Upper floor adds a footfall and signage review; size near the minimum adds a layout review.
5. **Language:** all training and communication in the preferred language.
6. **Timeline reality check:** earliest realistic opening date from stage durations versus the applicant's target; if later, state the gap and why.
7. **Conditions** from conditional approval appear at the top as "must be resolved before agreement", each with a deadline.

### 9b. Document checklist [SHOULD]
Per partner: ID proof, address proof, PAN, space proof (rental agreement or ownership document), bank details, GST registration, local shop and establishment registration and trade licence. Each with status. Label the list as "typical requirements, to be confirmed by the brand's legal team", not legal advice. Missing documents feed the action queue and the drop-off risk.

### 9c. Readiness check before opening [SHOULD]
A checklist that must be fully ticked before the store is marked "Ready to open": training completed and certified; staff hired and trained; inventory received; billing/POS working; signage and brand standards verified; opening-day plan agreed. Show a readiness percentage. The opening stage cannot be marked done while readiness is below 100%.

### 9d. Aggregates [SHOULD]
**Training load** (partners per language per month) and **opening timeline** (stores opening per month).

Checklist status changes are stored as events (section 13) so they persist across run versions.

---

## 10. SLOT RESERVATIONS AND AUTO-PROMOTION [MUST]

- Every approval creates a reservation of its slot and pin with a deadline: `reservationDays` (default 30) to reach the first milestone (agreement signed and space confirmed). Conditional approvals also have a deadline per condition (`conditionDays`, default 14).
- Status per reservation: Active, Due soon (7 days or less), Expired, Fulfilled.
- An Expired reservation (deadline passed with the milestone not marked done, or an explicit "missed the deadline" event) releases the slot and pin. On the next run, the top eligible waitlisted applicant is promoted, and the diff shows it.
- **Demo control:** a "Simulate date" input on the run page (and the follow-up "move forward 35 days") that re-runs the engine with a later `today`, so expiries and promotions can be shown live. Default is the real date.

---

## 11. REDIRECT INSTEAD OF REJECT [MUST]

For REJECT (`OUTSIDE_TERRITORIES`, `PIN_HAS_STORE`) and WAITLIST (`PIN_TAKEN_BY_HIGHER_RANK`, `SLOTS_FULL`, `NO_SLOTS`), compute alternatives:
1. Territories in the **same city** with free slots and free pins, ordered by priority, listing the free pins.
2. If the notes show location flexibility, also list other cities with free capacity, by priority.
3. For each suggestion, re-run the engine with the applicant moved there (assume they would need a new space in that pin, so they become HOLD `SPACE_NOT_IDENTIFIED` unless the note says otherwise) and report the projected rank.
Output example: "TER-03 (Mysuru, High priority) has 2 open slots and free pins 570002, 570008. With a space there, APP-014 would rank #1."
Include the redirect in the applicant's message (section 12).

---

## 12. APPLICANT MESSAGES IN THEIR LANGUAGE [MUST]

For every applicant, generate a ready-to-send message (shown in the drawer with a copy button and included in the export), in the preferred language:
- **APPROVED:** congratulations, the reservation deadline, the first three steps, the documents to start with.
- **APPROVED_WITH_CONDITIONS:** the same, plus each condition and its deadline.
- **HOLD:** exactly what is missing (from flags and counterfactuals), how to send it, the deadline, and what happens once received ("you would rank #2 for 3 slots").
- **WAITLISTED:** position on the waitlist, the reason, and redirect options.
- **REJECTED:** a polite reason in plain words, and redirect options when any exist.

Templates are deterministic, written in English, Kannada and Hindi, filled with the applicant's facts. If the LLM key exists it may polish the wording but must keep every fact unchanged. Add a visible note in the README and the UI: "Kannada and Hindi templates should be reviewed by a native speaker." No internal reason codes or scores in the applicant-facing text, except the waitlist position.

---

## 13. EVENTS (state that changes after the upload) [MUST]

The run input includes an `events` list, so everything that happens after the upload is replayable:
`{ type: 'update' | 'withdraw' | 'override' | 'milestone' | 'checklist' | 'reservationMissed' | 'dateAdvance', applicationId?, payload, reason?, at }`.
Every follow-up, override or checklist change appends an event, re-runs the engine, and saves a **new run version** with `parent_run_id`. This gives a full history and before/after diffs.

---

## 14. HUMAN OVERRIDE [MUST]

- From the applicant drawer, a team member can force any outcome (e.g. Approve, Hold, Reject) and **must** enter a reason (minimum 10 characters) and their name.
- Overrides are stored as events and applied in the engine before ranked allocation.
- An override can never break a hard rule. If a forced approval needs a slot or pin that is taken, show the conflict and offer a choice: cancel, or release a named lower-ranked approval (which is then also logged).
- Overridden decisions show an "Overridden by X: reason" badge; the original engine decision stays visible.
- Insights show override counts by rule or reason. If one rule is overridden often, flag "consider reviewing this rule".

---

## 15. DROP-OFF RISK FLAG [MUST]

For APPROVED, APPROVED_WITH_CONDITIONS and HOLD applicants compute **Risk: Low/Medium/High** with listed reasons, from: no space identified; loan pending; partial commitment or hired manager; long gap between approval and target launch (over 9 months); timeline conflict; low confidence data; capital just at the minimum (ratio below 1.1); missing documents; reservation due soon. Risk does NOT change the decision; it drives the action queue and suggested team actions ("call this week", "confirm loan status").

---

## 16. DAILY ACTION QUEUE [MUST]

The first tab after upload: **"Today"**. A ranked to-do list for the expansion team, each item with: who, what to do, why, deadline, and a one-click link to the applicant and their ready-made message. Sources, in priority order:
1. Reservations or condition deadlines expiring within 7 days.
2. HOLD applicants with the highest provisional rank (closest to an approval): send the info request.
3. High drop-off risk approvals: call this week.
4. Waitlisted applicants who could be redirected to free slots.
5. High-priority territories with unfilled slots and no qualified applicants: recruit here.
6. Data issues needing confirmation (pin and city mismatch, duplicates).
Mark items done (stored as events). Show the count of open actions in the header.

---

## 17. DECISION OBJECT (per applicant) [MUST]

```ts
{
  applicationId, applicantName, city, pin, territoryId | null,
  outcome: 'APPROVED' | 'APPROVED_WITH_CONDITIONS' | 'HOLD' | 'WAITLISTED' | 'REJECTED',
  engineOutcome,                     // before any override
  override?: { outcome, reason, by, at },
  score: number | null, provisionalScore: boolean,
  pillars: { financial, operator, site, launch, territory, cannibalisationDeduction }, // raw, weight, points, one-line explanation
  confidence: 'High' | 'Medium' | 'Low',
  rankInTerritory: number | null, provisionalRank?: number,
  reasons: ReasonCode[],             // primary first
  trace: TraceStep[],                // {step, check, result: 'pass'|'fail'|'flag', values, sentence}
  summary: string,                   // 2 to 3 sentences from the trace
  whatWouldChange: Counterfactual[], // section 18
  redirects: Redirect[],             // section 11
  conditions: { text, deadline }[],
  reservation?: { deadline, status },
  risk?: { level, reasons[] },
  onboarding: OnboardingPlan | null, documents?, readiness?,
  message: { language, text },       // section 12
  estimatedPaybackMonths: number | null
}
```

---

## 18. COUNTERFACTUALS: "WHAT WOULD CHANGE THIS" [MUST]

For every HOLD, WAITLISTED and REJECTED applicant, find the smallest realistic changes that flip the outcome to APPROVED or APPROVED_WITH_CONDITIONS. Clone the input, apply one candidate change, re-run the full engine (so competition is respected), and keep the changes that flip. Candidates: space becomes Rented, Ground, at the tier minimum size; investment raised to the minimum (state the exact shortfall in lakh); missing fields supplied; a named higher-ranked competitor withdrawing; a move to a free pin (via redirects). Output up to 3 sentences, most realistic first, e.g. "Moves to Approved if a ground-floor space of 200+ sq ft is confirmed; would rank #2 of 3 slots in TER-01."

---

## 19. FOLLOW-UP ENGINE [MUST]

API: `POST /api/runs/[id]/followup` with `{ message }`, returning `{ kind: 'answer' | 'update' | 'clarify', answerText, newRunId?, diff? }`.

**Intents** (LLM with zod-validated JSON when the key exists; otherwise rule-based):
- `explain(id)`: "why is APP-007 on hold", "explain APP-003".
- `compare(idA, idB)`: "why did APP-004 beat APP-011".
- `status(territory or city)`: "who got approved in Mysuru", "slots left in TER-02".
- `whatif(id, patch)`: hypothetical; no new run; shows the would-be outcome.
- `update(id, patch)`: new real information. Patchable: space available, size, floor, investment, experience, target launch, pin, language, notes.
- `withdraw(id)`, `reservationMissed(id)`, `milestone(id, stage)`, `dateAdvance(days)`.
- `actions()`: "what should the team do today".
Rule-based patterns to support: "ground floor / ground-floor", "upper floor", "mall", "owned", "rented", "N sq ft", "N lakh", "N months", "N years experience", "withdrawn / dropped out / backed out", "missed the deadline", "signed the agreement", "moved to pin NNNNNN", "move forward N days".
Unknown ID or ambiguous message: ask one short clarifying question. Never guess an outcome.

**Updates:** append an event, re-run, save a new run version, and compute a **diff** across ALL applicants (outcome, score, rank, conditions, reservation), because changes ripple (e.g. a withdrawal promotes a waitlisted applicant). The answer states what changed, the trace step that flipped, and the ripple effects, and links to a before/after view.

**Answers come from stored traces.** The LLM may rephrase but must not add facts; give it only the trace and summary.

---

## 20. SAMPLE DATASET AND TESTS [MUST]

Build a built-in **messy sample dataset** (about 25 applicants, several territories) that includes every case below, and use the same cases as vitest fixtures with assertions:

1. Two applicants on the same pin: higher score wins, the other is waitlisted naming the winner, with redirects.
2. Pin with an existing store: reject with redirect to free pins.
3. Pin outside every territory (Tumakuru and Davanagere have no territory in the sample): reject.
4. Pin prefix does not match the stated city: hold, asks to confirm.
5. Owned or Rented with blank size: hold.
6. "Not yet identified" with a size filled in: treated as no space, warning.
7. No space (hold), then the update "found a ground-floor space of 400 sq ft" flips it to approved.
8. Target launch of 1 month with no space: unrealistic flag plus hold.
9. "Before Diwali" note with target 3 months: conflict flag, conditional approval.
10. Tier 3 applicant with Tier 1 money: checked against the Tier 3 minimum; high financial score.
11. Capital shortfall of 10% (hold) versus 60% (reject).
12. Territory with 0 open slots: waitlist with redirects.
13. Territory where slots exceed free pins: capacity = free pins.
14. Duplicate Application ID; the same person under two IDs.
15. Zero experience and low-relevance business: extended training or below bar.
16. Withdrawal of an approved applicant promotes the top waitlisted one (diff shows both).
17. Date advanced 35 days with no milestone: reservation expires, slot passes to the waitlist.
18. Override that would break the pin rule: refused with a conflict explanation.
19. Pin as `570001.0`, with spaces, and as text.
20. More applicants than total slots, to test allocation invariants.

Add property-style tests that generate random inputs and assert the three hard rules always hold, including after random events and overrides.

---

## 21. UI [MUST unless marked]

Single product, no marketing page. Light theme, strong typography, status colours always paired with text labels. Mobile-friendly. Plain language everywhere; reason codes appear only as small tags.

**Home (`/`):** headline, one-line description, Excel dropzone, **"Try with sample data"** button, link to download the blank template. Clear errors for wrong files or missing sheets/columns (name them).

**Run page (`/run/[id]`):**
1. **Header strip:** counts per outcome, open actions, data issues, run version, "view history", and the **Simulate date** control.
2. **Tabs:**
   - **Today:** the action queue (section 16).
   - **Decisions:** sortable, filterable table (ID, name, city, pin, territory, outcome chip, score, confidence, risk, one-line reason). Clicking a row opens the **Applicant drawer**: outcome and summary; override badge; pillar bars with weights and points; gate checklist; data flags; trace; "what would change this"; redirects; reservation and conditions with deadlines; risk; onboarding plan, documents and readiness (status editable); applicant message with copy button and language label; history across run versions; **Override** button.
   - **Territories:** priority, tier, slots, free pins, real capacity, approved and waitlisted applicants, pins used, existing stores; highlight unfilled High-priority slots.
   - **Insights** [SHOULD]: funnel (applied, valid, passed gates, above bar, approved); leakage breakdown (hold and reject reasons with a "so what" line, e.g. "x% of holds are for missing space: ask for space on the application form"); near-misses and the cheapest fix; underserved territories; close calls (score gap 3 or less on a contested slot); concentration warning (over 60% of approvals in one city); training load by language and month; opening timeline; override statistics; **impact metrics** (applications decided, time to decision for this run in seconds, holds with a clear ask, slots filled vs available, expected openings by month).
   - **Rules in use:** every threshold, weight and assumption with its rationale, plus the three hard rules.
   - **Data quality:** per-applicant cleaning and flag log; territory overlaps.
3. **Ask panel** (docked, always visible): chat with suggested prompts ("Why is APP-00X on hold?", "Who got approved in Mysuru?", "APP-0XX has found a ground-floor space", "What should the team do today?"). Answers link to the applicant; updates show the before/after diff.
4. **Export:** Excel with Decisions (reasons, summaries), Messages, Territories, Onboarding plans, Action queue, Data quality, Assumptions; plus a CSV of decisions.

The first screen after upload should appear within a few seconds, with progress and skeleton states. Every explanation must be readable by a non-technical operations manager.

---

## 22. CONFIG (`lib/config.ts`, shown in "Rules in use")

All values are **team assumptions to defend in the deck**; each needs a `rationale` string.

```ts
minInvestmentLakh: { 'Tier 1': 30, 'Tier 2': 20, 'Tier 3': 12 },  // deposit + fit-out + inventory + working capital buffer
minSpaceSqft:      { 'Tier 1': 250, 'Tier 2': 200, 'Tier 3': 150 },
idealSpaceSqft:    { 'Tier 1': [300, 800], 'Tier 2': [250, 700], 'Tier 3': [200, 600] },
leadTimeMonths:    { withSpace: 2, withoutSpace: 5 },
defaultTargetLaunchMonths: 4,
capitalShortfallHoldThreshold: 0.25,
MIN_SCORE_TO_APPROVE: 50,
nearMissMargin: 5,
closeCallMargin: 3,
concentrationWarningShare: 0.6,
weights: { financial: 25, operator: 20, site: 25, launch: 10, territory: 20 },
maxCannibalisationDeduction: 10,
reservationDays: 30,
conditionDays: 14,
dueSoonDays: 7,
riskThresholds: { longGapMonths: 9, thinCapitalRatio: 1.1 },
paybackAssumptions: { /* revenue per sq ft per month by tier, gross margin %, fixed costs per month by tier: clearly labelled illustrative */ },
festivals: { 'Diwali 2026': '2026-11-08' },  // verify before submission
```

---

## 23. DATABASE (Neon) AND API

`db/schema.sql`:
- `runs(id text primary key, created_at timestamptz, parent_run_id text null, version int, label text, input jsonb, config jsonb, result jsonb)`
- `messages(id serial primary key, run_id text, role text, content text, created_at timestamptz)`
- Indexes on `parent_run_id` and `created_at`.

API routes:
- `POST /api/upload` (multipart xlsx): parse, validate, run, store, return `{ runId }`.
- `POST /api/sample`: run the sample dataset.
- `GET /api/runs/[id]`, `GET /api/runs/[id]/history`, `GET /api/runs/[id]/diff?from=`
- `POST /api/runs/[id]/followup`
- `POST /api/runs/[id]/events` (override, checklist, milestone, action done, date simulation)
- `GET /api/runs/[id]/export` (xlsx)
- `GET /api/template`

---

## 24. EXPLANATION STYLE [MUST]

Every summary and answer must:
- lead with the outcome and the single most important reason,
- cite concrete numbers ("Investment 14 lakh vs 20 lakh minimum for Tier 2: short by 6 lakh"),
- say what happens next or what would change it,
- use plain language with no reason codes in the sentence,
- mention low confidence when the data is thin, and never claim more certainty than the data supports.

Example: "APP-007 is on hold because no shop space has been found yet. Everything else looks strong (provisional score 71; would rank #2 for 3 slots in TER-01). It moves to Approved once a space of at least 200 sq ft is confirmed. A request has been prepared in Kannada."

---

## 25. BUILD PHASES (commit after each; deployable at every step)

1. **Engine core [MUST]:** scaffold Next.js + TS + Tailwind; `lib/engine` with parsing, validation, signals, gates, scoring, allocation, traces, final assertions; `lib/config.ts`; vitest with section 20 cases 1 to 15 and 19 to 20; `CLAUDE.md`.
2. **Upload, sample data and persistence [MUST]:** upload, sample and template routes; Neon schema with in-memory fallback; run page with the Decisions table and applicant drawer. Deploy to Vercel now and confirm the public link works.
3. **Post-decision layer [MUST]:** counterfactuals, redirects, onboarding plan, reservations and auto-promotion, risk flag, applicant messages in three languages.
4. **Events, follow-ups and overrides [MUST]:** event model, run versioning and diffs, follow-up engine (rule-based first, then optional LLM), Ask panel, override flow, Simulate date control; tests 16 to 18 and the property tests.
5. **Today tab and Territories, Rules, Data quality tabs [MUST].**
6. **Insights, documents, readiness, exports [SHOULD].**
7. **Polish [MUST]:** error, empty and loading states; mobile layout; accessibility; README (setup, env vars, architecture, assumptions table with rationales, native-speaker note); test the deployed link from a fresh browser and a phone with no login.
8. **Demo path check [MUST]:** confirm this exact path works on the sample data, without errors: upload, Today tab, a hold explained, a pin conflict with a redirect, "APP-0XX found a ground-floor space" flipping a decision, a withdrawal promoting a waitlisted applicant, an override refused for breaking the pin rule, one insight.

---

## 26. OUT OF SCOPE FOR THE MVP (roadmap for the deck; do NOT build)

Partner-facing portal where applicants update their own details; WhatsApp or SMS sending; document upload and verification; real training assessments; CRM integration; multi-user roles and permissions; maps and geocoding for true distance-based cannibalisation.

## 27. DELIVERABLES

Public Vercel URL (no login), GitHub repo, `SPEC.md` (this file), `CLAUDE.md`, `DECISIONS.md`, README with the assumptions table, the sample dataset, and all tests passing.

---
*End of spec.*
