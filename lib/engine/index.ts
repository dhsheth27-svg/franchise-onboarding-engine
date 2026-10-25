// runEngine(input, config, today) -> RunResult. Pure: no database, network or clock access.
// Layers: (1) clean + validate, (2) hard gates, (3) rubric score, (4) allocation [decide.ts],
// (5) post-decision layer: redirects, counterfactuals, onboarding, reservations, risk, messages, actions.

import { config as defaultConfig, configValues, type Config } from '../config';
import { decide, type CoreResult, type Work } from './decide';
import { oneLine, summarise } from './explain';
import { buildPost } from './post';
import type { Decision, EngineInput, Outcome, RunResult } from './types';
import { computeCounterfactuals, computeRedirects } from './whatif';

export * from './types';
export { decide, isApproved, label } from './decide';

export interface EngineOptions {
  /** Skip counterfactuals and redirect projections (used for fast hypothetical runs). */
  shallow?: boolean;
}

export class HardRuleViolation extends Error {}

export function runEngine(input: EngineInput, config: Config = defaultConfig, today: string, opts: EngineOptions = {}): RunResult {
  const started = Date.now();
  const cfg = configValues(config);
  const core = decide(input, cfg, today);

  const decisions: Decision[] = core.works.map((w) => {
    const redirects = opts.shallow ? [] : computeRedirects(w, core, input);
    const whatWouldChange = opts.shallow ? [] : computeCounterfactuals(w, core, input, redirects);
    const post = buildPost(w, core, redirects, whatWouldChange);
    return toDecision(w, core, { redirects, whatWouldChange, ...post });
  });

  const result: RunResult = {
    asOf: core.asOf,
    decisions,
    territories: core.territorySummaries,
    stores: core.stores,
    dataIssues: [
      ...core.dataIssues,
      ...core.works.flatMap((w) =>
        w.app.flags.map((f) => ({ scope: 'application' as const, ref: w.app.key, code: f.code, severity: f.severity, message: f.message })),
      ),
    ],
    assertions: { ok: core.violations.length === 0, violations: core.violations },
    approvalDates: core.approvalDates,
    actions: [],
    counts: countOutcomes(decisions),
    durationMs: 0,
  };
  result.durationMs = Date.now() - started;
  return result;
}

export function countOutcomes(decisions: Decision[]): Record<Outcome, number> {
  const c: Record<Outcome, number> = { APPROVED: 0, APPROVED_WITH_CONDITIONS: 0, HOLD: 0, WAITLISTED: 0, REJECTED: 0 };
  for (const d of decisions) c[d.outcome]++;
  return c;
}

type PostParts = Pick<Decision, 'redirects' | 'whatWouldChange' | 'onboarding' | 'documents' | 'readiness' | 'risk' | 'message'>;

function toDecision(w: Work, core: CoreResult, post: PostParts): Decision {
  const cfg = core.cfg;
  const a = w.app;
  return {
    key: a.key,
    applicationId: a.id,
    applicantName: a.name,
    rowNumber: a.rowNumber,
    city: a.city,
    pin: a.pin,
    territoryId: w.territory?.id ?? null,
    tier: w.tier,
    language: a.language,
    outcome: w.outcome!,
    engineOutcome: w.engineOutcome ?? w.outcome!,
    override: w.override,
    withdrawn: w.withdrawn,
    score: w.sr?.score ?? null,
    provisionalScore: !!w.sr?.provisional || w.outcome === 'HOLD',
    scoreNote: w.sr?.assumedSpace ? 'Provisional: assumes a minimum-size rented space because none has been found yet.' : undefined,
    pillars: w.sr?.pillars ?? null,
    confidence: w.confidence,
    confidenceReasons: w.confidenceReasons,
    rankInTerritory: w.rank,
    slotRank: w.slotRank,
    provisionalRank: w.provisionalRank,
    territorySlots: w.territory?.openSlots,
    waitlistPosition: w.waitlistPosition,
    reasons: w.reasons,
    primaryReason: w.reasons[0] === 'OVERRIDDEN' ? w.reasons[1] ?? 'OVERRIDDEN' : w.reasons[0],
    trace: w.trace,
    summary: summarise(w, cfg, { redirects: post.redirects, whatWouldChange: post.whatWouldChange, messageLanguage: post.message.text ? a.language : undefined }),
    oneLine: oneLine(w, cfg),
    whatWouldChange: post.whatWouldChange,
    redirects: post.redirects,
    conditions: w.conditions,
    reservation: w.reservation,
    risk: post.risk,
    onboarding: post.onboarding,
    documents: post.documents,
    readiness: post.readiness,
    message: post.message,
    estimatedPaybackMonths: w.sr?.paybackMonths ?? null,
    flags: a.flags,
    cleaning: a.cleaning,
    signals: a.signals,
    competitor: w.competitor,
    application: a,
  };
}
