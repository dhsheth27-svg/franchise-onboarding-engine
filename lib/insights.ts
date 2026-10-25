// Insights derived from a run result: funnel, where applications leak, near-misses, close calls,
// concentration, training load, openings, overrides and impact. Pure and client-safe.

import type { Config } from './config';
import type { Decision, EngineEvent, RunResult } from './engine/types';

const REASON_TEXT: Record<string, { label: string; soWhat: string }> = {
  SPACE_NOT_IDENTIFIED: { label: 'No shop space yet', soWhat: 'ask for a shortlisted space on the application form, and share a list of available spaces per pin' },
  SPACE_SIZE_MISSING: { label: 'Space size missing', soWhat: 'make space size a required field when a space is owned or rented' },
  SPACE_TOO_SMALL: { label: 'Space below minimum size', soWhat: 'publish the minimum size per city on the application page' },
  CAPITAL_SHORTFALL_SMALL: { label: 'Small capital gap', soWhat: 'offer a financing partner introduction to close gaps of up to 25%' },
  CAPITAL_INSUFFICIENT: { label: 'Capital well below minimum', soWhat: 'state the minimum investment per city up front to filter early' },
  PIN_CITY_MISMATCH: { label: 'Pin does not match city', soWhat: 'replace free-text city with a pin lookup on the form' },
  MISSING_REQUIRED: { label: 'Required details missing', soWhat: 'make these fields mandatory on the form' },
  PIN_INVALID: { label: 'Invalid pin code', soWhat: 'validate the pin as 6 digits on the form' },
  STATE_NOT_KARNATAKA: { label: 'Outside Karnataka', soWhat: 'show the states currently open on the form' },
  NEGATIVE_OR_IMPOSSIBLE_VALUE: { label: 'Impossible values', soWhat: 'add range checks to the form' },
  DUPLICATE_ID: { label: 'Duplicate application ID', soWhat: 'generate IDs automatically' },
  DUPLICATE_APPLICANT: { label: 'Same person applied twice', soWhat: 'detect duplicates at submission' },
  SCORE_NEAR_MISS: { label: 'Just under the score bar', soWhat: 'a single fix (often the floor or the timeline) lifts these over the bar' },
  SCORE_BELOW_BAR: { label: 'Score below the bar', soWhat: 'the form could screen for retail experience earlier' },
  OUTSIDE_TERRITORIES: { label: 'Pin outside every territory', soWhat: 'demand exists here: consider opening a territory, or redirect' },
  PIN_HAS_STORE: { label: 'Pin already has a store', soWhat: 'show taken pins on the form and suggest free ones' },
  NO_SLOTS: { label: 'Territory has no open slots', soWhat: 'demand exists: review slot plans for this territory' },
  PIN_TAKEN_BY_HIGHER_RANK: { label: 'Lost the pin to a stronger applicant', soWhat: 'redirect these qualified applicants to free pins' },
  SLOTS_FULL: { label: 'All slots taken', soWhat: 'keep them warm on the waitlist; they are promoted automatically' },
  RESERVATION_EXPIRED: { label: 'Reservation lapsed', soWhat: 'chase agreements earlier; the reservation window may be too short' },
  WITHDRAWN: { label: 'Withdrew', soWhat: 'call high-risk partners early' },
  RELEASED_BY_OVERRIDE: { label: 'Released by an override', soWhat: 'review overrides' },
};

export const reasonLabel = (code: string) => REASON_TEXT[code]?.label ?? code;

export interface Insights {
  funnel: { label: string; n: number }[];
  leakage: { outcome: 'HOLD' | 'REJECTED' | 'WAITLISTED'; total: number; rows: { code: string; label: string; n: number; share: number; soWhat: string }[] }[];
  nearMisses: { key: string; id: string; score: number | null; fix: string }[];
  underserved: { id: string; city: string; priority: string; unfilled: number; freePins: string[] }[];
  closeCalls: { key: string; id: string; winner: string; margin: number; territory: string | null }[];
  concentration: { city: string; n: number; share: number }[];
  concentrationWarning: string | null;
  trainingLoad: { month: string; byLanguage: Record<string, number> }[];
  openings: { month: string; n: number }[];
  overrides: { total: number; byReason: { reason: string; n: number }[]; refused: number; warning: string | null };
  impact: { decided: number; seconds: number; holdsWithAsk: number; holds: number; slotsFilled: number; slotsAvailable: number; withMessage: number; redirectsOffered: number };
}

const monthKey = (iso: string) => iso.slice(0, 7);
export const monthLabel = (key: string) => new Date(`${key}-01T00:00:00Z`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric', timeZone: 'UTC' });

export function computeInsights(r: RunResult, config: Config, events: EngineEvent[]): Insights {
  const ds = r.decisions.filter((d) => !d.withdrawn);
  const approved = (d: Decision) => d.outcome === 'APPROVED' || d.outcome === 'APPROVED_WITH_CONDITIONS';
  const valid = ds.filter((d) => !d.flags.some((f) => f.severity === 'BLOCKING'));
  const passed = valid.filter((d) => d.trace.filter((t) => t.step === 'gate').every((t) => t.result !== 'fail'));
  const bar = config.MIN_SCORE_TO_APPROVE.value;
  const above = passed.filter((d) => (d.score ?? 0) >= bar);
  const funnel = [
    { label: 'Applied', n: r.decisions.length },
    { label: 'Valid data', n: valid.length },
    { label: 'Passed all gates', n: passed.length },
    { label: 'Above score bar', n: above.length },
    { label: 'Approved', n: ds.filter(approved).length },
  ];

  const leakage = (['HOLD', 'WAITLISTED', 'REJECTED'] as const).map((outcome) => {
    const list = r.decisions.filter((d) => d.outcome === outcome);
    const counts = new Map<string, number>();
    for (const d of list) counts.set(d.primaryReason, (counts.get(d.primaryReason) ?? 0) + 1);
    const rows = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([code, n]) => ({ code, label: reasonLabel(code), n, share: list.length ? n / list.length : 0, soWhat: REASON_TEXT[code]?.soWhat ?? '' }));
    return { outcome, total: list.length, rows };
  });

  const nearMisses = ds
    .filter((d) => !approved(d) && d.whatWouldChange.length)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, 6)
    .map((d) => ({ key: d.key, id: d.applicationId, score: d.score, fix: d.whatWouldChange[0].sentence }));

  const underserved = r.territories.filter((t) => t.unfilled > 0).map((t) => ({ id: t.id, city: t.city, priority: t.priority, unfilled: t.unfilled, freePins: t.freePinsNow }));

  const margin = config.closeCallMargin.value;
  const closeCalls = ds
    .filter((d) => d.outcome === 'WAITLISTED' && d.competitor && d.competitor.margin <= margin)
    .map((d) => ({ key: d.key, id: d.applicationId, winner: d.competitor!.id, margin: d.competitor!.margin, territory: d.territoryId }));

  const approvedList = ds.filter(approved);
  const byCity = new Map<string, number>();
  for (const d of approvedList) byCity.set(d.city ?? '—', (byCity.get(d.city ?? '—') ?? 0) + 1);
  const concentration = [...byCity.entries()].sort((a, b) => b[1] - a[1]).map(([city, n]) => ({ city, n, share: approvedList.length ? n / approvedList.length : 0 }));
  const top = concentration[0];
  const concentrationWarning =
    top && top.share > config.concentrationWarningShare.value ? `${Math.round(top.share * 100)}% of approvals are in ${top.city}; growth is not spreading across cities as intended.` : null;

  const training = new Map<string, Record<string, number>>();
  const openings = new Map<string, number>();
  for (const d of approvedList) {
    const step = d.onboarding?.steps.find((s) => s.id === 'training');
    if (step && d.onboarding) {
      const m = monthKey(step.dueDate);
      const rec = training.get(m) ?? {};
      rec[d.onboarding.trainingLanguage] = (rec[d.onboarding.trainingLanguage] ?? 0) + 1;
      training.set(m, rec);
    }
    if (d.onboarding) openings.set(monthKey(d.onboarding.earliestOpening), (openings.get(monthKey(d.onboarding.earliestOpening)) ?? 0) + 1);
  }

  const overrideEvents = events.filter((e) => e.type === 'override');
  const byReason = new Map<string, number>();
  for (const d of r.decisions) {
    if (!d.override) continue;
    const engineReason = d.reasons.find((x) => x !== 'OVERRIDDEN' && !x.startsWith('ALLOCATED')) ?? 'Engine approval';
    byReason.set(engineReason, (byReason.get(engineReason) ?? 0) + 1);
  }
  const byReasonList = [...byReason.entries()].sort((a, b) => b[1] - a[1]).map(([reason, n]) => ({ reason: reasonLabel(reason), n }));
  const hot = byReasonList.find((x) => x.n >= 3);

  const holds = ds.filter((d) => d.outcome === 'HOLD');
  return {
    funnel,
    leakage,
    nearMisses,
    underserved,
    closeCalls,
    concentration,
    concentrationWarning,
    trainingLoad: [...training.entries()].sort().map(([month, byLanguage]) => ({ month, byLanguage })),
    openings: [...openings.entries()].sort().map(([month, n]) => ({ month, n })),
    overrides: {
      total: overrideEvents.length,
      byReason: byReasonList,
      refused: r.decisions.filter((d) => d.override?.status === 'refused').length,
      warning: hot ? `"${hot.reason}" has been overridden ${hot.n} times: consider reviewing this rule.` : null,
    },
    impact: {
      decided: r.decisions.length,
      seconds: r.durationMs / 1000,
      holdsWithAsk: holds.filter((d) => /\n1\. /.test(d.message.english)).length,
      holds: holds.length,
      slotsFilled: approvedList.length,
      slotsAvailable: r.territories.reduce((n, t) => n + t.realCapacity, 0),
      withMessage: r.decisions.filter((d) => d.message.text).length,
      redirectsOffered: ds.filter((d) => d.redirects.length).length,
    },
  };
}
