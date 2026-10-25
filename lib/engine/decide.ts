// Layers 1-4: clean and validate, hard gates, rubric score, allocation under constraints.
// Pure: (input, config, today) -> decisions. No I/O. The post-decision layer lives in post.ts.

import type { ConfigValues, Tier } from '../config';
import { applyEvents, type EventState } from './events';
import { addDays, daysBetween, fmtDate, fmtNum, round1, tierForCity } from './normalize';
import { canScore, hasSpace, scoreApplication, weakestPillar, type ScoreResult } from './score';
import { cleanApplications, cleanStores, cleanTerritories, FLAG_SEVERITY } from './validate';
import type {
  Application,
  Condition,
  Confidence,
  DataIssue,
  EngineEvent,
  EngineInput,
  Flag,
  Outcome,
  Override,
  Reservation,
  Store,
  Territory,
  TerritorySummary,
  TraceStep,
} from './types';

export interface Work {
  app: Application;
  territory: Territory | null;
  tier: Tier | null;
  sr: ScoreResult | null;
  trace: TraceStep[];
  gateFails: { gate: string; code: string; outcome: Outcome; reliable: boolean }[];
  outcome: Outcome | null; // null while still eligible for allocation
  reasons: string[];
  eligible: boolean;
  rank: number | null;
  slotRank?: number;
  provisionalRank?: number;
  pinTakenBy?: string;
  waitlistPosition?: number;
  competitor?: { key: string; id: string; score: number; margin: number };
  override?: Override;
  engineOutcome?: Outcome;
  withdrawn?: boolean;
  wasApproved?: boolean;
  reservation?: Reservation;
  conditions: Condition[];
  confidence: Confidence;
  confidenceReasons: string[];
}

export interface CoreResult {
  asOf: string;
  works: Work[];
  territories: Territory[];
  territorySummaries: TerritorySummary[];
  stores: Store[];
  dataIssues: DataIssue[];
  approvalDates: Record<string, string>;
  violations: string[];
  events: EventState;
  cfg: ConfigValues;
}

const APPROVED: Outcome[] = ['APPROVED', 'APPROVED_WITH_CONDITIONS'];
export const isApproved = (o: Outcome | null | undefined) => !!o && APPROVED.includes(o);

function step(w: Work, s: Omit<TraceStep, 'values'> & { values?: Record<string, unknown> }) {
  w.trace.push({ values: {}, ...s });
}

/** Ranking comparator: score desc, Owned over Rented, more experience, higher investment ratio, lower ID. */
export function compareRank(a: Work, b: Work): number {
  const sa = a.sr?.score ?? -1;
  const sb = b.sr?.score ?? -1;
  if (sb !== sa) return sb - sa;
  const own = (w: Work) => (w.app.space === 'Owned' ? 1 : 0);
  if (own(b) !== own(a)) return own(b) - own(a);
  const exp = (w: Work) => w.app.experienceYears ?? 0;
  if (exp(b) !== exp(a)) return exp(b) - exp(a);
  const ratio = (w: Work) => w.sr?.investmentRatio ?? 0;
  if (ratio(b) !== ratio(a)) return ratio(b) - ratio(a);
  return a.app.id.localeCompare(b.app.id, 'en', { numeric: true });
}

function confidenceFor(app: Application): { level: Confidence; reasons: string[] } {
  let pts = 0;
  const reasons: string[] = [];
  for (const f of app.flags) {
    if (f.severity === 'BLOCKING') {
      pts += 4;
      reasons.push(f.message);
    } else if (f.severity === 'WARNING') {
      pts += 2;
      reasons.push(f.message);
    } else if (f.code !== 'NOTE_COMMITMENT_RISK') {
      pts += 1;
      reasons.push(f.message);
    }
  }
  if (app.signals.relevance === 'unknown') {
    pts += 1;
    reasons.push('Business background is blank or unclear.');
  }
  if (app.cleaning.length >= 3) {
    pts += 1;
    reasons.push(`${app.cleaning.length} values had to be cleaned or reinterpreted.`);
  }
  return { level: pts <= 1 ? 'High' : pts <= 3 ? 'Medium' : 'Low', reasons };
}

const CONDITION_TEXT: Record<string, (f: Flag, cfg: ConfigValues) => string> = {
  LAUNCH_UNREALISTIC: (f) => `Agree a realistic opening date: the target of ${f.params?.target} month(s) is shorter than the ${f.params?.lead}-month minimum lead time.`,
  NOTE_TIMELINE_CONFLICT: (f) =>
    `Confirm the opening date: the note says "${f.params?.label}" (${fmtDate(String(f.params?.date))}), which does not fit the ${f.params?.target}-month target and ${f.params?.lead}-month lead time.`,
  NOTE_EXPERIENCE_CONFLICT: (f) => `Confirm retail experience: the form says ${f.params?.field} years but the description mentions ${f.params?.text} years.`,
  CITY_UNRECOGNISED: (f) => `Confirm the city (written as "${f.params?.raw}").`,
  UNPARSEABLE_VALUE: (f) => `Re-send the ${f.params?.field} value, which could not be read.`,
  SPACE_SIZE_WITHOUT_SPACE: () => 'Confirm whether a space has actually been found.',
};

export function conditionsFor(app: Application, cfg: ConfigValues, approvedOn: string): Condition[] {
  const deadline = addDays(approvedOn, cfg.conditionDays);
  return app.flags
    .filter((f) => f.severity === 'WARNING' || f.severity === 'BLOCKING')
    .map((f) => ({ code: f.code, text: CONDITION_TEXT[f.code]?.(f, cfg) ?? `Resolve: ${f.message}`, deadline }));
}

// ---------- Gates ----------

function runGates(w: Work, cfg: ConfigValues, existingPins: Map<string, Store>) {
  const { app, territory } = w;
  const blocking = app.flags.filter((f) => f.severity === 'BLOCKING');
  const pinSuspect = app.flags.some((f) => ['PIN_INVALID', 'PIN_CITY_MISMATCH', 'DUPLICATE_ID', 'DUPLICATE_APPLICANT'].includes(f.code));

  // G1
  if (blocking.length) {
    w.gateFails.push({ gate: 'G1', code: blocking[0].code, outcome: 'HOLD', reliable: true });
    step(w, {
      step: 'gate',
      check: 'G1 No blocking data problems',
      code: blocking.map((f) => f.code).join(','),
      result: 'fail',
      values: { flags: blocking.map((f) => f.code) },
      sentence: `Cannot decide yet: ${blocking.map((f) => f.message).join(' ')}`,
    });
  } else step(w, { step: 'gate', check: 'G1 No blocking data problems', result: 'pass', sentence: 'All required information is present and consistent enough to decide.' });

  // G2
  if (!app.pin) step(w, { step: 'gate', check: 'G2 Pin inside a target territory', result: 'skip', sentence: 'Skipped: no valid pin code.' });
  else if (territory)
    step(w, {
      step: 'gate',
      check: 'G2 Pin inside a target territory',
      result: 'pass',
      values: { pin: app.pin, territory: territory.id },
      sentence: `Pin ${app.pin} is in ${territory.id} (${territory.city}, ${territory.priority} priority).`,
    });
  else {
    w.gateFails.push({ gate: 'G2', code: 'OUTSIDE_TERRITORIES', outcome: 'REJECTED', reliable: !pinSuspect });
    step(w, {
      step: 'gate',
      check: 'G2 Pin inside a target territory',
      code: 'OUTSIDE_TERRITORIES',
      result: 'fail',
      values: { pin: app.pin },
      sentence: `Pin ${app.pin} is not in any territory the brand is currently opening in${app.pinCity ? ` (${app.pinCity} has no open territory covering it)` : ''}.`,
    });
  }

  // G3
  const store = app.pin ? existingPins.get(app.pin) : undefined;
  if (!app.pin) step(w, { step: 'gate', check: 'G3 No existing store in the pin', result: 'skip', sentence: 'Skipped: no valid pin code.' });
  else if (store) {
    w.gateFails.push({ gate: 'G3', code: 'PIN_HAS_STORE', outcome: 'REJECTED', reliable: !pinSuspect });
    step(w, {
      step: 'gate',
      check: 'G3 No existing store in the pin',
      code: 'PIN_HAS_STORE',
      result: 'fail',
      values: { pin: app.pin, store: store.storeId },
      sentence: `Pin ${app.pin} already has store ${store.storeId} (opened ${store.openedYear}); the brand never opens two stores in one pin.`,
    });
  } else step(w, { step: 'gate', check: 'G3 No existing store in the pin', result: 'pass', values: { pin: app.pin }, sentence: `No existing store in pin ${app.pin}.` });

  // G4
  if (!territory) step(w, { step: 'gate', check: 'G4 Territory has open slots', result: 'skip', sentence: 'Skipped: not in a territory.' });
  else if (territory.openSlots <= 0) {
    w.gateFails.push({ gate: 'G4', code: 'NO_SLOTS', outcome: 'WAITLISTED', reliable: !pinSuspect });
    step(w, {
      step: 'gate',
      check: 'G4 Territory has open slots',
      code: 'NO_SLOTS',
      result: 'fail',
      values: { territory: territory.id, openSlots: territory.openSlots },
      sentence: `${territory.id} has no open slots right now (0 new stores planned).`,
    });
  } else
    step(w, {
      step: 'gate',
      check: 'G4 Territory has open slots',
      result: 'pass',
      values: { territory: territory.id, openSlots: territory.openSlots },
      sentence: `${territory.id} plans ${territory.openSlots} more store${territory.openSlots === 1 ? '' : 's'}.`,
    });

  // G5
  if (app.investmentLakh === null || !w.tier) step(w, { step: 'gate', check: 'G5 Investment meets the tier minimum', result: 'skip', sentence: 'Skipped: investment or city tier unknown.' });
  else {
    const min = cfg.minInvestmentLakh[w.tier];
    const inv = app.investmentLakh;
    if (inv >= min)
      step(w, {
        step: 'gate',
        check: 'G5 Investment meets the tier minimum',
        result: 'pass',
        values: { investment: inv, minimum: min, tier: w.tier },
        sentence: `Investment ₹${fmtNum(inv)} lakh meets the ${w.tier} minimum of ₹${min} lakh.`,
      });
    else {
      const short = round1(min - inv);
      const pct = short / min;
      const small = pct <= cfg.capitalShortfallHoldThreshold;
      w.gateFails.push({ gate: 'G5', code: small ? 'CAPITAL_SHORTFALL_SMALL' : 'CAPITAL_INSUFFICIENT', outcome: small ? 'HOLD' : 'REJECTED', reliable: true });
      step(w, {
        step: 'gate',
        check: 'G5 Investment meets the tier minimum',
        code: small ? 'CAPITAL_SHORTFALL_SMALL' : 'CAPITAL_INSUFFICIENT',
        result: 'fail',
        values: { investment: inv, minimum: min, shortfall: short, shortfallPct: Math.round(pct * 100), tier: w.tier },
        sentence: `Investment ₹${fmtNum(inv)} lakh vs ₹${min} lakh minimum for ${w.tier}: short by ₹${fmtNum(short)} lakh (${Math.round(pct * 100)}%)${small ? ', a gap small enough to close' : `, more than the ${Math.round(cfg.capitalShortfallHoldThreshold * 100)}% that can reasonably be closed`}.`,
      });
    }
  }

  // G6
  if (!app.space) step(w, { step: 'gate', check: 'G6 Shop space identified', result: 'skip', sentence: 'Skipped: space status unknown.' });
  else if (hasSpace(app)) step(w, { step: 'gate', check: 'G6 Shop space identified', result: 'pass', values: { space: app.space }, sentence: `Space is ${app.space.toLowerCase()}.` });
  else {
    w.gateFails.push({ gate: 'G6', code: 'SPACE_NOT_IDENTIFIED', outcome: 'HOLD', reliable: true });
    step(w, { step: 'gate', check: 'G6 Shop space identified', code: 'SPACE_NOT_IDENTIFIED', result: 'fail', values: { space: app.space }, sentence: 'No shop space has been identified yet.' });
  }

  // G7
  if (!hasSpace(app) || app.spaceSqft === null || !w.tier) step(w, { step: 'gate', check: 'G7 Space meets the minimum size', result: 'skip', sentence: 'Skipped: no space size to check.' });
  else {
    const min = cfg.minSpaceSqft[w.tier];
    if (app.spaceSqft >= min)
      step(w, {
        step: 'gate',
        check: 'G7 Space meets the minimum size',
        result: 'pass',
        values: { sqft: app.spaceSqft, minimum: min },
        sentence: `${fmtNum(app.spaceSqft)} sq ft meets the ${w.tier} minimum of ${min} sq ft.`,
      });
    else {
      w.gateFails.push({ gate: 'G7', code: 'SPACE_TOO_SMALL', outcome: 'HOLD', reliable: true });
      step(w, {
        step: 'gate',
        check: 'G7 Space meets the minimum size',
        code: 'SPACE_TOO_SMALL',
        result: 'fail',
        values: { sqft: app.spaceSqft, minimum: min },
        sentence: `${fmtNum(app.spaceSqft)} sq ft is below the ${w.tier} minimum of ${min} sq ft (short by ${fmtNum(min - app.spaceSqft)} sq ft).`,
      });
    }
  }

  // Outcome: first failing gate, except that a reliable REJECT later in the list wins over a HOLD or
  // WAITLIST (fixing the hold would not make the applicant viable). See DECISIONS.md.
  if (w.gateFails.length) {
    let primary = w.gateFails[0];
    if (primary.outcome !== 'REJECTED') {
      const rej = w.gateFails.find((g) => g.outcome === 'REJECTED' && g.reliable);
      if (rej) primary = rej;
    }
    w.outcome = primary.outcome;
    w.reasons = [primary.code, ...w.gateFails.filter((g) => g !== primary).map((g) => g.code)];
  }
}

// ---------- Allocation ----------

interface AllocResult {
  status: Map<string, { kind: 'approved' | 'pinTaken' | 'slotsFull'; by?: Work }>;
  approvedByTerritory: Map<string, Work[]>;
  pinHolder: Map<string, Work>;
}

function allocate(groups: Map<string, Work[]>, territories: Territory[], existingPins: Map<string, Store>, forced: Work[], excluded: Set<string>): AllocResult {
  const status: AllocResult['status'] = new Map();
  const approvedByTerritory = new Map<string, Work[]>(territories.map((t) => [t.id, []]));
  const pinHolder = new Map<string, Work>();
  const slotsLeft = new Map(territories.map((t) => [t.id, t.openSlots]));
  const take = (w: Work) => {
    status.set(w.app.key, { kind: 'approved' });
    approvedByTerritory.get(w.territory!.id)!.push(w);
    pinHolder.set(w.app.pin!, w);
    slotsLeft.set(w.territory!.id, slotsLeft.get(w.territory!.id)! - 1);
  };
  for (const w of forced) if (!excluded.has(w.app.key)) take(w);
  for (const t of territories) {
    for (const w of groups.get(t.id) ?? []) {
      if (excluded.has(w.app.key) || status.has(w.app.key)) continue;
      const pin = w.app.pin!;
      if (existingPins.has(pin)) continue; // cannot happen: G3
      const holder = pinHolder.get(pin);
      if (holder) {
        status.set(w.app.key, { kind: 'pinTaken', by: holder });
        continue;
      }
      if ((slotsLeft.get(t.id) ?? 0) <= 0) {
        const list = approvedByTerritory.get(t.id)!;
        status.set(w.app.key, { kind: 'slotsFull', by: list[list.length - 1] });
        continue;
      }
      take(w);
    }
  }
  return { status, approvedByTerritory, pinHolder };
}

// ---------- Main ----------

export function decide(input: EngineInput, cfg: ConfigValues, todayInput: string): CoreResult {
  const ev = applyEvents(input, todayInput);
  const today = ev.today;
  const dataIssues: DataIssue[] = [];

  const { stores, issues: storeIssues } = cleanStores(input.existingStores);
  dataIssues.push(...storeIssues);
  const { territories, issues: terrIssues, pinOwner } = cleanTerritories(input.territories);
  dataIssues.push(...terrIssues);
  const terrById = new Map(territories.map((t) => [t.id, t]));
  const existingPins = new Map(stores.map((s) => [s.pin, s]));
  for (const t of territories) {
    if (t.openSlots > 0 && t.pins.every((p) => existingPins.has(p)))
      dataIssues.push({ scope: 'territory', ref: t.id, code: 'NO_FREE_PINS', severity: 'WARNING', message: `${t.id} has ${t.openSlots} open slot(s) but every pin already has a store, so no new store can open there.` });
  }

  const apps = cleanApplications(ev.applications, cfg, today, input.llmSignals);

  const works: Work[] = apps.map((app) => {
    const tid = app.pin ? pinOwner.get(app.pin) : undefined;
    const territory = tid ? terrById.get(tid) ?? null : null;
    const tier = territory?.tier ?? (app.pinCity ? tierForCity(app.pinCity) : null) ?? tierForCity(app.city);
    const w: Work = { app, territory, tier, sr: null, trace: [], gateFails: [], outcome: null, reasons: [], eligible: false, rank: null, conditions: [], confidence: 'High', confidenceReasons: [] };
    for (const c of app.cleaning) step(w, { step: 'clean', check: `Cleaned ${c.field}`, result: 'info', values: { from: c.from, to: c.to }, sentence: c.note });
    for (const f of app.flags) step(w, { step: 'validate', check: f.code, code: f.code, result: f.severity === 'INFO' ? 'info' : 'flag', values: { severity: f.severity, ...(f.params ?? {}) }, sentence: f.message });
    const evs = ev.byApplication.get(app.key) ?? [];
    for (const e of evs.filter((x) => x.type === 'update'))
      step(w, { step: 'event', check: 'Update received', result: 'info', values: e.payload, sentence: `Updated on ${fmtDate(e.at)}: ${describePatch(e.payload)}${e.reason ? ` (${e.reason})` : ''}.` });
    if (w.tier && canScore(app, w.tier)) w.sr = scoreApplication(app, { tier: w.tier, territory, stores, today }, cfg);
    return w;
  });

  // Same person under two IDs (same name + same pin): keep the higher-scoring one.
  const groupsByPerson = new Map<string, Work[]>();
  for (const w of works) {
    if (!w.app.pin || w.app.name === '(name missing)' || w.app.key.includes('#')) continue;
    const k = `${w.app.name.toLowerCase().replace(/[^a-z]/g, '')}|${w.app.pin}`;
    if (!groupsByPerson.has(k)) groupsByPerson.set(k, []);
    groupsByPerson.get(k)!.push(w);
  }
  for (const group of groupsByPerson.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort(compareRank);
    const keep = sorted[0];
    for (const other of sorted.slice(1)) {
      const f: Flag = {
        code: 'DUPLICATE_APPLICANT',
        severity: FLAG_SEVERITY.DUPLICATE_APPLICANT,
        message: `Looks like the same person as ${keep.app.id} (same name and pin ${other.app.pin}); ${keep.app.id} is kept because it ${keep.sr && other.sr && keep.sr.score !== other.sr.score ? `scores higher (${keep.sr.score} vs ${other.sr.score})` : 'ranks first'}. This application is held until the team confirms it is a different person.`,
        params: { keep: keep.app.id },
      };
      other.app.flags.unshift(f);
      step(other, { step: 'validate', check: f.code, code: f.code, result: 'flag', values: { keep: keep.app.id }, sentence: f.message });
    }
  }

  for (const w of works) {
    const c = confidenceFor(w.app);
    w.confidence = c.level;
    w.confidenceReasons = c.reasons;
    runGates(w, cfg, existingPins);
  }

  // Score step and approval bar
  for (const w of works) {
    if (!w.sr) {
      step(w, { step: 'score', check: 'Rubric score', result: 'skip', sentence: 'Not scored: investment, experience or city tier is missing.' });
      continue;
    }
    const p = w.sr.pillars;
    step(w, {
      step: 'score',
      check: 'Rubric score',
      result: 'info',
      values: {
        score: w.sr.score,
        financial: p.financial.points,
        operator: p.operator.points,
        site: p.site.points,
        launch: p.launch.points,
        territory: p.territory.points,
        deduction: -p.cannibalisationDeduction.points,
      },
      sentence: `${w.sr.provisional ? 'Provisional score' : 'Score'} ${w.sr.score}/100: financial ${p.financial.points}/${p.financial.weight}, operator ${p.operator.points}/${p.operator.weight}, site ${p.site.points}/${p.site.weight}, launch ${p.launch.points}/${p.launch.weight}, territory ${p.territory.points}/${p.territory.weight}, cannibalisation −${p.cannibalisationDeduction.points}.`,
    });
    if (w.outcome) continue;
    const bar = cfg.MIN_SCORE_TO_APPROVE;
    if (w.sr.score >= bar) {
      w.eligible = true;
      step(w, { step: 'score', check: 'Approval bar', result: 'pass', values: { score: w.sr.score, bar }, sentence: `Score ${w.sr.score} clears the approval bar of ${bar}.` });
    } else {
      const weak = weakestPillar(p);
      const near = w.sr.score >= bar - cfg.nearMissMargin;
      w.outcome = near ? 'HOLD' : 'REJECTED';
      w.reasons = [near ? 'SCORE_NEAR_MISS' : 'SCORE_BELOW_BAR'];
      step(w, {
        step: 'score',
        check: 'Approval bar',
        code: w.reasons[0],
        result: 'fail',
        values: { score: w.sr.score, bar, weakest: weak.label, weakestRaw: weak.raw },
        sentence: `Score ${w.sr.score} is ${fmtNum(round1(bar - w.sr.score))} points below the bar of ${bar}${near ? ` (within the ${cfg.nearMissMargin}-point near-miss margin)` : ''}; weakest area is ${weak.label.toLowerCase()} (${weak.raw}/100): ${weak.explanation}`,
      });
    }
  }
  for (const w of works) if (!w.sr && !w.outcome) {
    w.outcome = 'HOLD';
    w.reasons = ['MISSING_REQUIRED'];
  }

  // Withdrawals
  const excludedBase = new Set<string>();
  for (const w of works) {
    const e = ev.withdrawn.get(w.app.key);
    if (!e) continue;
    excludedBase.add(w.app.key);
    w.withdrawn = true;
    w.wasApproved = !!input.priorApprovals?.[w.app.key];
    step(w, { step: 'event', check: 'Withdrawn', code: 'WITHDRAWN', result: 'fail', values: { at: e.at }, sentence: `The applicant withdrew on ${fmtDate(e.at)}${e.reason ? ` (${e.reason})` : ''}.` });
  }

  // Overrides: last one per applicant wins.
  const overrideFor = new Map<string, EngineEvent>();
  for (const o of ev.overrides) {
    if (o.payload.outcome === 'ENGINE' || o.payload.outcome === 'CLEAR') overrideFor.delete(o.applicationId!);
    else overrideFor.set(o.applicationId!, o);
  }
  const byKey = new Map(works.map((w) => [w.app.key, w]));
  const forcedNonApprove = new Map<string, EngineEvent>();
  const forcedApprove: EngineEvent[] = [];
  for (const [key, o] of overrideFor) {
    if (excludedBase.has(key)) continue;
    if (isApproved(o.payload.outcome as Outcome)) forcedApprove.push(o);
    else forcedNonApprove.set(key, o);
  }
  for (const key of forcedNonApprove.keys()) excludedBase.add(key);

  // Groups of eligible applicants per territory, in rank order.
  const groups = new Map<string, Work[]>();
  for (const w of works) {
    if (!w.eligible || !w.territory) continue;
    if (!groups.has(w.territory.id)) groups.set(w.territory.id, []);
    groups.get(w.territory.id)!.push(w);
  }
  for (const g of groups.values()) g.sort(compareRank);

  // Allocation with forced approvals and reservation expiry, iterated until stable.
  const prior = input.priorApprovals ?? {};
  const expired = new Map<string, string>(); // key -> reason sentence
  let alloc!: AllocResult;
  let forcedOk: Work[] = [];
  const overrideStatus = new Map<string, Override>();
  const released = new Map<string, string>(); // released key -> by override for
  for (let iter = 0; iter < 10; iter++) {
    let releaseAdded = false;
    const excluded = new Set([...excludedBase, ...expired.keys(), ...released.keys()]);
    forcedOk = [];
    overrideStatus.clear();
    for (const o of forcedApprove) {
      const w = byKey.get(o.applicationId!)!;
      const ov: Override = { outcome: o.payload.outcome as Outcome, reason: o.reason ?? '', by: o.by ?? 'Team', at: o.at, status: 'applied' };
      if (excluded.has(w.app.key) && !released.has(w.app.key)) {
        ov.status = 'refused';
        ov.conflict = expired.has(w.app.key) ? 'The reservation for this applicant has expired.' : 'This applicant is excluded.';
      } else if (!w.app.pin || !w.territory) {
        ov.status = 'refused';
        ov.conflict = `Cannot approve: ${w.app.pin ? `pin ${w.app.pin} is outside every territory` : 'there is no valid pin code'} (hard rule 3: never approve outside the territories).`;
      } else if (existingPins.has(w.app.pin)) {
        const s = existingPins.get(w.app.pin)!;
        ov.status = 'refused';
        ov.conflict = `Cannot approve: pin ${w.app.pin} already has existing store ${s.storeId} (hard rule 1: never two stores in one pin). An existing store cannot be released.`;
      } else {
        // Baseline without this override: who would hold the pin and the slots?
        const base = allocate(groups, territories, existingPins, forcedOk, excluded);
        const holder = base.pinHolder.get(w.app.pin);
        const terrApproved = base.approvedByTerritory.get(w.territory.id) ?? [];
        const release = o.payload.releaseApplicationId ? String(o.payload.releaseApplicationId).toUpperCase() : null;
        const releaseWork = release ? works.find((x) => x.app.key.toUpperCase() === release || x.app.id.toUpperCase() === release) : undefined;
        const problems: string[] = [];
        let toRelease: Work | undefined;
        if (holder && holder.app.key !== w.app.key) {
          if (releaseWork?.app.key === holder.app.key) toRelease = holder;
          else problems.push(`pin ${w.app.pin} is taken by ${holder.app.id} (score ${holder.sr?.score}). Approving both would put two stores in one pin (hard rule 1)`);
        }
        const slotsNeeded = terrApproved.filter((x) => x !== toRelease && x !== w).length + 1;
        if (slotsNeeded > w.territory.openSlots) {
          if (!toRelease && releaseWork && terrApproved.includes(releaseWork)) toRelease = releaseWork;
          else if (!toRelease)
            problems.push(
              `all ${w.territory.openSlots} slot(s) in ${w.territory.id} are taken by ${terrApproved.map((x) => x.app.id).join(', ')} (hard rule 2: never more approvals than open slots)`,
            );
        }
        if (problems.length) {
          ov.status = 'refused';
          ov.conflict = `Override refused: ${problems.join('; and ')}. Choose an approval to release, or cancel.`;
        } else {
          if (toRelease && !released.has(toRelease.app.key)) {
            released.set(toRelease.app.key, w.app.id);
            releaseAdded = true;
          }
          if (toRelease) ov.released = toRelease.app.id;
          for (const [rk, forId] of released) if (forId === w.app.id) ov.released = byKey.get(rk)?.app.id;
          forcedOk.push(w);
        }
      }
      overrideStatus.set(w.app.key, ov);
    }
    const excludedNow = new Set([...excludedBase, ...expired.keys(), ...released.keys()]);
    alloc = allocate(groups, territories, existingPins, forcedOk, excludedNow);

    // Reservation expiry
    let changed = false;
    for (const [key, st] of alloc.status) {
      if (st.kind !== 'approved' || expired.has(key)) continue;
      const approvedOn = prior[key] ?? today;
      const deadline = addDays(approvedOn, cfg.reservationDays);
      const ms = (ev.milestones.get(key) ?? []).find((m) => m.stage === 'agreement' && m.at <= deadline);
      const missed = ev.missed.get(key);
      if (missed) {
        expired.set(key, `The reservation was released on ${fmtDate(missed.at)} because the first milestone was missed${missed.reason ? ` (${missed.reason})` : ''}.`);
        changed = true;
      } else if (!ms && today > deadline) {
        expired.set(key, `The reservation lapsed on ${fmtDate(deadline)}: the agreement was not signed within ${cfg.reservationDays} days of approval (approved ${fmtDate(approvedOn)}).`);
        changed = true;
      }
    }
    if (!changed && !releaseAdded) break;
  }

  // What the engine alone would decide (no overrides, no releases): used for the "original decision".
  const withdrawnOrExpired = new Set([...ev.withdrawn.keys(), ...expired.keys()]);
  const engineAlloc = allocate(groups, territories, existingPins, [], withdrawnOrExpired);
  const engineOnly = (w: Work): Outcome => {
    if (w.gateFails.length) {
      let primary = w.gateFails[0];
      const rej = w.gateFails.find((g) => g.outcome === 'REJECTED' && g.reliable);
      if (primary.outcome !== 'REJECTED' && rej) primary = rej;
      return primary.outcome;
    }
    if (!w.eligible) return w.reasons.includes('SCORE_NEAR_MISS') || !w.sr ? 'HOLD' : 'REJECTED';
    if (expired.has(w.app.key)) return 'HOLD';
    const st = engineAlloc.status.get(w.app.key);
    if (st?.kind === 'approved') return w.app.flags.some((f) => f.severity === 'WARNING') ? 'APPROVED_WITH_CONDITIONS' : 'APPROVED';
    return 'WAITLISTED';
  };

  // Apply allocation results
  const approvalDates: Record<string, string> = {};
  for (const w of works) {
    const key = w.app.key;
    if (w.withdrawn) {
      w.engineOutcome = w.outcome ?? 'REJECTED';
      w.outcome = 'REJECTED';
      w.reasons = ['WITHDRAWN', ...w.reasons.filter((r) => r !== 'WITHDRAWN')];
      continue;
    }
    if (expired.has(key)) {
      w.outcome = 'HOLD';
      w.reasons = ['RESERVATION_EXPIRED'];
      step(w, { step: 'reservation', check: 'Reservation', code: 'RESERVATION_EXPIRED', result: 'fail', values: {}, sentence: expired.get(key)! });
    }
    if (released.has(key)) {
      w.outcome = 'WAITLISTED';
      w.reasons = ['RELEASED_BY_OVERRIDE'];
      step(w, { step: 'override', check: 'Released for an override', code: 'RELEASED_BY_OVERRIDE', result: 'fail', values: { for: released.get(key) }, sentence: `This approval was released by a team override in favour of ${released.get(key)}.` });
    }
    const st = alloc.status.get(key);
    if (!w.outcome && st) {
      if (st.kind === 'approved') {
        w.outcome = w.app.flags.some((f) => f.severity === 'WARNING') ? 'APPROVED_WITH_CONDITIONS' : 'APPROVED';
        w.reasons = [w.outcome === 'APPROVED' ? 'ALLOCATED' : 'ALLOCATED_WITH_CONDITIONS'];
      } else if (st.kind === 'pinTaken') {
        const by = st.by!;
        w.outcome = 'WAITLISTED';
        w.reasons = ['PIN_TAKEN_BY_HIGHER_RANK'];
        w.competitor = { key: by.app.key, id: by.app.id, score: by.sr?.score ?? 0, margin: round1((by.sr?.score ?? 0) - (w.sr?.score ?? 0)) };
      } else {
        const by = st.by;
        w.outcome = 'WAITLISTED';
        w.reasons = ['SLOTS_FULL'];
        if (by) w.competitor = { key: by.app.key, id: by.app.id, score: by.sr?.score ?? 0, margin: round1((by.sr?.score ?? 0) - (w.sr?.score ?? 0)) };
      }
    }
    if (!w.outcome && w.eligible) {
      // eligible but excluded from allocation without another reason (shouldn't happen)
      w.outcome = 'HOLD';
      w.reasons = ['NOT_ALLOCATED'];
    }
    w.engineOutcome = w.outcome!;
  }

  // Overrides: non-approve ones set the outcome; approve ones were applied in allocation.
  for (const [key, o] of forcedNonApprove) {
    const w = byKey.get(key)!;
    w.engineOutcome = engineOnly(w);
    w.override = { outcome: o.payload.outcome as Outcome, reason: o.reason ?? '', by: o.by ?? 'Team', at: o.at, status: 'applied' };
    w.outcome = w.override.outcome;
    w.reasons = ['OVERRIDDEN', ...w.reasons.filter((r) => r !== 'OVERRIDDEN')];
    step(w, { step: 'override', check: 'Human override', code: 'OVERRIDDEN', result: 'info', values: { outcome: w.override.outcome, by: w.override.by }, sentence: `Overridden to ${label(w.override.outcome)} by ${w.override.by}: "${w.override.reason}".` });
  }
  for (const [key, ov] of overrideStatus) {
    const w = byKey.get(key)!;
    w.override = ov;
    if (ov.status === 'applied') {
      w.engineOutcome = engineOnly(w);
      w.outcome = ov.outcome;
      if (!w.reasons.includes('OVERRIDDEN')) w.reasons = ['OVERRIDDEN', ...w.reasons.filter((r) => !r.startsWith('ALLOCATED'))];
      step(w, {
        step: 'override',
        check: 'Human override',
        code: 'OVERRIDDEN',
        result: 'info',
        values: { outcome: ov.outcome, by: ov.by, released: ov.released },
        sentence: `Approved by override from ${ov.by}: "${ov.reason}".${ov.released ? ` ${ov.released} was released to make room.` : ''} Hard rules were re-checked and still hold.`,
      });
    } else {
      step(w, { step: 'override', check: 'Human override refused', code: 'OVERRIDE_REFUSED', result: 'fail', values: { requested: ov.outcome, by: ov.by }, sentence: ov.conflict ?? 'Override refused.' });
    }
  }

  // Ranks, waitlist positions, reservations, conditions
  for (const t of territories) {
    const ranked = (groups.get(t.id) ?? []).filter((w) => !w.withdrawn && !forcedNonApprove.has(w.app.key) && !expired.has(w.app.key));
    ranked.forEach((w, i) => (w.rank = i + 1));
    let pos = 0;
    for (const w of ranked) if (w.outcome === 'WAITLISTED') w.waitlistPosition = ++pos;
  }
  for (const w of works) {
    if (isApproved(w.outcome) && w.app.pin && w.territory) {
      const approvedOn = prior[w.app.key] ?? today;
      approvalDates[w.app.key] = approvedOn;
      const deadline = addDays(approvedOn, cfg.reservationDays);
      const fulfilled = (ev.milestones.get(w.app.key) ?? []).some((m) => m.stage === 'agreement');
      const daysLeft = daysBetween(today, deadline);
      w.reservation = {
        approvedOn,
        deadline,
        daysLeft,
        pin: w.app.pin,
        territoryId: w.territory.id,
        status: fulfilled ? 'Fulfilled' : daysLeft <= cfg.dueSoonDays ? 'Due soon' : 'Active',
      };
      w.conditions = conditionsFor(w.app, cfg, approvedOn);
      step(w, {
        step: 'allocate',
        check: 'Slot allocated',
        code: w.reasons[0],
        result: 'pass',
        values: { territory: w.territory.id, pin: w.app.pin, rank: w.rank, slots: w.territory.openSlots },
        sentence: `${w.override?.status === 'applied' ? 'Given' : `Ranked #${w.rank} in ${w.territory.id} and given`} one of ${w.territory.openSlots} slot(s) with pin ${w.app.pin}; reservation held until ${fmtDate(deadline)}${fulfilled ? ' (agreement signed)' : ''}.`,
      });
    } else if (w.outcome === 'WAITLISTED' && w.reasons[0] === 'PIN_TAKEN_BY_HIGHER_RANK' && w.competitor) {
      step(w, {
        step: 'allocate',
        check: 'Pin contest',
        code: 'PIN_TAKEN_BY_HIGHER_RANK',
        result: 'fail',
        values: { winner: w.competitor.id, winnerScore: w.competitor.score, margin: w.competitor.margin },
        sentence: `Pin ${w.app.pin} went to ${w.competitor.id} (score ${w.competitor.score}), ${w.competitor.margin > 0 ? `${fmtNum(w.competitor.margin)} points ahead` : 'ahead on the tie-breakers'}; only one store is allowed per pin.`,
      });
    } else if (w.outcome === 'WAITLISTED' && w.reasons[0] === 'SLOTS_FULL') {
      step(w, {
        step: 'allocate',
        check: 'Slots full',
        code: 'SLOTS_FULL',
        result: 'fail',
        values: { lastApproved: w.competitor?.id, margin: w.competitor?.margin, slots: w.territory?.openSlots },
        sentence: `All ${w.territory?.openSlots} slot(s) in ${w.territory?.id} went to higher-ranked applicants${w.competitor ? `; the last one approved, ${w.competitor.id}, scored ${w.competitor.score} (${fmtNum(w.competitor.margin)} points ahead)` : ''}.`,
      });
    }
  }

  // Slot rank for approvals (position among the approved), and provisional rank for holds:
  // insert the held applicant among the approvals without taking a slot.
  const approvedIn = new Map<string, Work[]>();
  for (const w of works) {
    if (!isApproved(w.outcome) || !w.territory) continue;
    if (!approvedIn.has(w.territory.id)) approvedIn.set(w.territory.id, []);
    approvedIn.get(w.territory.id)!.push(w);
  }
  for (const list of approvedIn.values()) list.sort(compareRank).forEach((w, i) => (w.slotRank = i + 1));
  for (const w of works) {
    if (w.outcome !== 'HOLD' || !w.sr || !w.territory || w.withdrawn) continue;
    const approved = (approvedIn.get(w.territory.id) ?? []).filter((x) => x !== w);
    w.provisionalRank = 1 + approved.filter((x) => compareRank(x, w) < 0).length;
    const holder = approved.find((x) => x.app.pin === w.app.pin);
    if (holder) w.pinTakenBy = holder.app.id;
  }

  const territorySummaries = summariseTerritories(territories, works, existingPins);
  const violations = checkHardRules(works, territories, existingPins);
  return { asOf: today, works, territories, territorySummaries, stores, dataIssues, approvalDates, violations, events: ev, cfg };
}

export function label(o: Outcome): string {
  return { APPROVED: 'Approved', APPROVED_WITH_CONDITIONS: 'Approved with conditions', HOLD: 'On hold', WAITLISTED: 'Waitlisted', REJECTED: 'Rejected' }[o];
}

export function describePatch(p: Record<string, unknown>): string {
  const names: Record<string, string> = {
    spaceAvailable: 'space',
    spaceSize: 'size (sq ft)',
    floor: 'floor',
    investment: 'investment (₹ lakh)',
    experience: 'experience (years)',
    targetLaunch: 'target launch (months)',
    pin: 'pin',
    city: 'city',
    language: 'language',
    notes: 'notes',
    business: 'business',
  };
  return Object.entries(p)
    .filter(([k]) => k in names)
    .map(([k, v]) => `${names[k]} → ${String(v)}`)
    .join(', ');
}

function summariseTerritories(territories: Territory[], works: Work[], existingPins: Map<string, Store>): TerritorySummary[] {
  return territories.map((t) => {
    const inT = works.filter((w) => w.territory?.id === t.id);
    const approved = inT.filter((w) => isApproved(w.outcome)).sort(compareRank);
    const pinsUsed: Record<string, string> = {};
    for (const w of approved) pinsUsed[w.app.pin!] = w.app.id;
    const existingStorePins = t.pins.filter((p) => existingPins.has(p));
    const freePinsAtStart = t.pins.filter((p) => !existingPins.has(p));
    const freePinsNow = freePinsAtStart.filter((p) => !pinsUsed[p]);
    const realCapacity = Math.min(t.openSlots, freePinsAtStart.length);
    const slotsLeft = Math.max(0, t.openSlots - approved.length);
    return {
      id: t.id,
      city: t.city,
      tier: t.tier,
      priority: t.priority,
      openSlots: t.openSlots,
      pins: t.pins,
      existingStorePins,
      freePinsAtStart,
      freePinsNow,
      realCapacity,
      approved: approved.map((w) => w.app.key),
      waitlisted: inT.filter((w) => w.outcome === 'WAITLISTED').sort((a, b) => (a.waitlistPosition ?? 99) - (b.waitlistPosition ?? 99)).map((w) => w.app.key),
      held: inT.filter((w) => w.outcome === 'HOLD').map((w) => w.app.key),
      pinsUsed,
      slotsLeft,
      unfilled: Math.max(0, Math.min(slotsLeft, freePinsNow.length)),
      issues: t.issues,
    };
  });
}

/** The three hard rules. Returns a list of violations (empty when all hold). */
export function checkHardRules(works: Work[], territories: Territory[], existingPins: Map<string, Store>): string[] {
  const v: string[] = [];
  const approved = works.filter((w) => isApproved(w.outcome));
  const pins = new Map<string, string>();
  for (const w of approved) {
    const pin = w.app.pin;
    if (!pin) {
      v.push(`Rule 3: ${w.app.id} is approved without a valid pin.`);
      continue;
    }
    if (existingPins.has(pin)) v.push(`Rule 1: ${w.app.id} approved in pin ${pin}, which already has store ${existingPins.get(pin)!.storeId}.`);
    if (pins.has(pin)) v.push(`Rule 1: ${w.app.id} and ${pins.get(pin)} are both approved in pin ${pin}.`);
    pins.set(pin, w.app.id);
    if (!w.territory || !w.territory.pins.includes(pin)) v.push(`Rule 3: ${w.app.id} approved with pin ${pin} outside every territory.`);
  }
  for (const t of territories) {
    const n = approved.filter((w) => w.territory?.id === t.id).length;
    if (n > t.openSlots) v.push(`Rule 2: ${n} approvals in ${t.id}, which has only ${t.openSlots} open slot(s).`);
  }
  return v;
}
