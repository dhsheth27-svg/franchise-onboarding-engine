// Re-running the engine on changed inputs: redirects (section 11) and counterfactuals (section 18).
// Territories are independent (each pin belongs to one territory), so a re-run only needs the
// applicants of the territory involved. That keeps hundreds of what-ifs fast.

import type { ConfigValues } from '../config';
import { decide, isApproved, label, type CoreResult, type Work } from './decide';
import { fmtDate, fmtNum } from './normalize';
import { hasSpace } from './score';
import type { Counterfactual, EngineEvent, EngineInput, Outcome, RawApplication, RawTerritory, Redirect } from './types';

const PRIORITY_ORDER = { High: 0, Medium: 1, Low: 2 } as const;

interface LocalRun {
  work: Work | undefined;
  core: CoreResult;
}

/** Re-run only the given territory, with one applicant's raw row patched (and optional extra events). */
export function rerunLocal(
  core: CoreResult,
  input: EngineInput,
  key: string,
  patch: Partial<RawApplication>,
  territoryId: string,
  extraEvents: EngineEvent[] = [],
): LocalRun {
  const t = core.territories.find((x) => x.id === territoryId)!;
  const rawT: RawTerritory = { territoryId: t.id, city: t.city, state: 'Karnataka', pins: t.pins.join(','), tier: t.tier, openSlots: t.openSlots, priority: t.priority };
  const ev = core.events;
  const keysInT = new Set(core.works.filter((w) => w.territory?.id === territoryId).map((w) => w.app.key));
  keysInT.add(key);
  const applications: RawApplication[] = [];
  ev.keys.forEach((k, i) => {
    if (!k || !keysInT.has(k)) return;
    const row: RawApplication = { ...ev.applications[i], applicationId: k };
    applications.push(k === key ? { ...row, ...patch } : row);
  });
  const events = (input.events ?? []).filter((e) => e.type !== 'update' && e.type !== 'dateAdvance' && e.applicationId && keysInT.has(resolve(e.applicationId, ev.keys)));
  const sub: EngineInput = {
    applications,
    territories: [rawT],
    existingStores: core.stores.map((s) => ({ storeId: s.storeId, city: s.city, pin: s.pin, openedYear: s.openedYear })),
    events: [...events.map((e) => ({ ...e, applicationId: resolve(e.applicationId!, ev.keys) })), ...extraEvents],
    priorApprovals: input.priorApprovals,
    llmSignals: input.llmSignals,
  };
  const res = decide(sub, core.cfg, core.asOf);
  return { work: res.works.find((w) => w.app.key === key), core: res };
}

function resolve(ref: string, keys: (string | null)[]): string {
  const r = ref.trim().toUpperCase();
  return keys.find((k) => k && k.toUpperCase() === r) ?? ref;
}

// ---------- Redirects ----------

const REDIRECT_REASONS = ['OUTSIDE_TERRITORIES', 'PIN_HAS_STORE', 'PIN_TAKEN_BY_HIGHER_RANK', 'SLOTS_FULL', 'NO_SLOTS'];

export function computeRedirects(w: Work, core: CoreResult, input: EngineInput): Redirect[] {
  const primary = w.reasons.find((r) => REDIRECT_REASONS.includes(r));
  if (!primary || w.withdrawn || w.override?.status === 'applied') return [];
  const city = w.territory?.city ?? w.app.pinCity ?? w.app.city;
  const candidates = core.territorySummaries
    .filter((t) => t.slotsLeft > 0 && t.freePinsNow.length > 0)
    .filter((t) => t.city === city || w.app.signals.flexibleOnLocation || w.app.signals.preferredCities.includes(t.city))
    .sort((a, b) => {
      const pref = (t: { city: string }) => {
        const i = w.app.signals.preferredCities.indexOf(t.city);
        return i < 0 ? 99 : i;
      };
      return (
        Number(b.city === city) - Number(a.city === city) ||
        Number(b.id === w.territory?.id) - Number(a.id === w.territory?.id) ||
        pref(a) - pref(b) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      );
    });
  return candidates.slice(0, 3).map((t) => {
    const pin = t.freePinsNow[0];
    const run = rerunLocal(core, input, w.app.key, { pin, city: t.city, spaceAvailable: 'Not yet identified', spaceSize: '', floor: '' }, t.id);
    const pw = run.work;
    const rank = pw?.provisionalRank ?? pw?.slotRank ?? null;
    const sameTerritory = t.id === w.territory?.id;
    const pinsText = t.freePinsNow.slice(0, 4).join(', ') + (t.freePinsNow.length > 4 ? ` and ${t.freePinsNow.length - 4} more` : '');
    return {
      territoryId: t.id,
      city: t.city,
      priority: t.priority,
      sameCity: t.city === city,
      openSlotsLeft: t.slotsLeft,
      freePins: t.freePinsNow,
      projectedRank: rank,
      projectedOf: t.openSlots,
      sentence: `${sameTerritory ? `${t.id} still has` : `${t.id} (${t.city}, ${t.priority} priority) has`} ${t.slotsLeft} open slot${t.slotsLeft === 1 ? '' : 's'} and free pin${t.freePinsNow.length === 1 ? '' : 's'} ${pinsText}.${rank ? ` With a space there, ${w.app.id} would rank #${rank} for ${t.openSlots} slot${t.openSlots === 1 ? '' : 's'}.` : ''}`,
    };
  });
}

// ---------- Counterfactuals ----------

interface Candidate {
  kind: Counterfactual['kind'];
  change: string;
  patch: Partial<RawApplication>;
  territoryId?: string;
  events?: EngineEvent[];
}

export function computeCounterfactuals(w: Work, core: CoreResult, input: EngineInput, redirects: Redirect[]): Counterfactual[] {
  if (isApproved(w.outcome) || w.withdrawn || w.override?.status === 'applied') return [];
  const cfg = core.cfg;
  const a = w.app;
  const tier = w.tier;
  const codes = new Set([...w.reasons, ...a.flags.filter((f) => f.severity === 'BLOCKING').map((f) => f.code)]);
  const cands: Candidate[] = [];
  const combinedPatch: Partial<RawApplication> = {};
  const combined: string[] = [];

  if (codes.has('PIN_CITY_MISMATCH') && a.pinCity) {
    cands.push({ kind: 'data', change: `the applicant confirms the store is in ${a.pinCity} (pin ${a.pin})`, patch: { city: a.pinCity } });
    combinedPatch.city = a.pinCity;
    combined.push(`the city is confirmed as ${a.pinCity}`);
  }
  if (tier && (codes.has('SPACE_NOT_IDENTIFIED') || codes.has('SPACE_SIZE_MISSING') || codes.has('SPACE_TOO_SMALL') || codes.has('SPACE_SIZE_WITHOUT_SPACE'))) {
    const min = cfg.minSpaceSqft[tier];
    const size = Math.max(min, a.spaceSqft ?? 0);
    const tenure = hasSpace(a) ? a.space! : 'Rented';
    const p = { spaceAvailable: tenure, spaceSize: size, floor: a.floor && a.floor !== 'Not known' ? a.floor : 'Ground' };
    const txt = codes.has('SPACE_SIZE_MISSING') ? `the space size is confirmed at ${size}+ sq ft` : `a ${p.floor === 'Ground' ? 'ground-floor ' : ''}space of ${size}+ sq ft is confirmed`;
    cands.push({ kind: 'space', change: txt, patch: p });
    Object.assign(combinedPatch, p);
    combined.push(txt);
  }
  if (tier && a.investmentLakh !== null && (codes.has('CAPITAL_SHORTFALL_SMALL') || codes.has('CAPITAL_INSUFFICIENT'))) {
    const min = cfg.minInvestmentLakh[tier];
    const short = Math.round((min - a.investmentLakh) * 10) / 10;
    cands.push({ kind: 'capital', change: `investment rises by ₹${fmtNum(short)} lakh to the ₹${min} lakh ${tier} minimum`, patch: { investment: min } });
    combinedPatch.investment = min;
    combined.push(`investment reaches ₹${min} lakh`);
  }
  if (w.competitor && (codes.has('PIN_TAKEN_BY_HIGHER_RANK') || codes.has('SLOTS_FULL'))) {
    const comp = core.works.find((x) => x.app.key === w.competitor!.key);
    const deadline = comp?.reservation ? ` (their reservation runs until ${fmtDate(comp.reservation.deadline)})` : '';
    cands.push({
      kind: 'competitor',
      change: `${w.competitor.id} withdraws or misses the reservation deadline${deadline}`,
      patch: {},
      events: [{ id: 'cf-withdraw', type: 'withdraw', applicationId: w.competitor.key, payload: {}, at: core.asOf }],
    });
  }
  if (tier && w.sr && (codes.has('SCORE_NEAR_MISS') || codes.has('SCORE_BELOW_BAR'))) {
    if (hasSpace(a) && a.floor !== 'Ground') cands.push({ kind: 'score', change: 'the space is on the ground floor', patch: { floor: 'Ground' } });
    if (a.targetLaunchMonths !== null && w.sr.pillars.launch.raw < 100) {
      const lead = hasSpace(a) ? cfg.leadTimeMonths.withSpace : cfg.leadTimeMonths.withoutSpace;
      cands.push({ kind: 'launch', change: `the target launch moves to ${lead} months`, patch: { targetLaunch: lead } });
    }
    const min = cfg.minInvestmentLakh[tier];
    for (const mult of [1.25, 1.5, 2]) {
      const inv = Math.ceil(min * mult);
      if ((a.investmentLakh ?? 0) < inv) {
        cands.push({ kind: 'capital', change: `investment rises to ₹${inv} lakh`, patch: { investment: inv } });
        break;
      }
    }
  }
  const moveTo = redirects.find((r) => r.freePins.length);
  if (moveTo && tier) {
    const min = cfg.minSpaceSqft[moveTo.territoryId === w.territory?.id ? tier : core.territories.find((t) => t.id === moveTo.territoryId)!.tier];
    cands.push({
      kind: 'move',
      change: `the applicant opens in pin ${moveTo.freePins[0]} (${moveTo.territoryId}, ${moveTo.city}) instead, with a ${min}+ sq ft space there`,
      patch: { pin: moveTo.freePins[0], city: moveTo.city, spaceAvailable: 'Rented', spaceSize: Math.max(min, a.spaceSqft ?? 0), floor: 'Ground' },
      territoryId: moveTo.territoryId,
    });
  }
  if (combined.length > 1) cands.push({ kind: 'data', change: combined.join(' and '), patch: combinedPatch });

  const out: Counterfactual[] = [];
  for (const c of cands) {
    const tid = c.territoryId ?? w.territory?.id;
    if (!tid) continue;
    const run = rerunLocal(core, input, a.key, c.patch, tid, c.events ?? []);
    const pw = run.work;
    if (!pw || !isApproved(pw.outcome)) continue;
    const t = run.core.territories[0];
    out.push({
      kind: c.kind,
      change: c.change,
      outcome: pw.outcome as Outcome,
      rank: pw.slotRank ?? pw.rank,
      sentence: `Moves to ${label(pw.outcome!)} if ${c.change}; would rank #${pw.slotRank ?? pw.rank} for ${t.openSlots} slot${t.openSlots === 1 ? '' : 's'} in ${t.id}.`,
    });
    if (out.length >= 3) break;
  }
  return out;
}
