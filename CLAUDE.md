# Opsmith: franchise partner onboarding engine (Ops Hackathon, Case 1)

Public, login-free web app: upload Applications + Territories (Excel) -> an explained decision for every
franchise applicant, onboarding plans, a daily action queue, and a follow-up chat. Full brief: `SPEC.md`.
Judgement calls: `DECISIONS.md`.

## Stack
Next.js 14 (App Router) + TypeScript + Tailwind, Vercel. Neon Postgres via `@neondatabase/serverless`
(plain SQL, `db/schema.sql`; in-memory fallback when `DATABASE_URL` is unset). SheetJS (`xlsx`), zod,
vitest. Optional OpenAI API (`OPENAI_API_KEY`) only for text extraction, intent parsing and
wording; the app must work fully without it.

## Commands
- `npm run dev` – dev server (http://localhost:3000)
- `npm test` – vitest (engine cases from SPEC section 20 + property tests)
- `npm run build` – production build. Run `npm run build && npm test` before every commit.

## Engine (lib/engine) – pure: `runEngine(input, config, today) -> RunResult`
No DB, network or clock inside. Follow-ups, overrides, what-ifs = change the input (events) and re-run.
Layer order (never reorder):
1. Clean + validate (`validate.ts`, `normalize.ts`, `signals.ts`) -> flags BLOCKING / WARNING / INFO
2. Hard gates G1-G7 (`decide.ts runGates`) – every gate recorded in the trace
3. Rubric score 0-100 (`score.ts`): 5 weighted pillars minus cannibalisation deduction
4. Allocation under constraints (`decide.ts allocate`): overrides first, then rank order per territory
5. Post-decision (`whatif.ts`, `post.ts`): redirects, counterfactuals, onboarding, reservations, risk, messages
Every number/threshold lives in `lib/config.ts` with a rationale (shown in "Rules in use").
Explanations are generated from the trace (`explain.ts`), never invented.

## Three hard rules (asserted after allocation, overrides and every follow-up; never breakable)
1. Never two stores in the same pin code (existing stores count).
2. Never more approvals in a territory than its open slots.
3. Never approve an applicant whose pin is outside all territories.

## Outcomes
- APPROVED / APPROVED_WITH_CONDITIONS – slot + pin reserved for 30 days; conditions come from WARNING flags.
- HOLD – fixable; the decision states exactly what is needed (provisional score and rank shown).
- WAITLISTED – qualified, but no slot or pin free right now (position + redirects).
- REJECTED – not viable as submitted (always with redirects when any exist).

## Conventions
- Never use applicant name or personal attributes in scoring.
- Never throw on bad data: unparseable values become flags on that applicant.
- LLM never decides outcomes.
- Plain language in UI; reason codes only as small tags.
