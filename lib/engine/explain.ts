// Turns the trace and structured facts of a decision into plain-language summaries.
// Rule: every sentence here is filled from values already computed by the engine; nothing is invented.

import type { ConfigValues } from '../config';
import { isApproved, label, type Work } from './decide';
import { fmtDate, fmtNum } from './normalize';
import { weakestPillar } from './score';
import type { Counterfactual, Redirect } from './types';

function gateValues(w: Work, code: string): Record<string, unknown> {
  return w.trace.find((t) => t.code === code)?.values ?? {};
}

function bestPillar(w: Work): string | null {
  if (!w.sr) return null;
  const p = w.sr.pillars;
  const best = [p.financial, p.operator, p.site, p.territory].sort((a, b) => b.raw - a.raw || b.weight - a.weight)[0];
  return best.label.toLowerCase();
}

function slotsPhrase(w: Work): string {
  const t = w.territory;
  return t ? `${t.openSlots} slot${t.openSlots === 1 ? '' : 's'} in ${t.id}` : '';
}

/** Main reason, stated plainly, as the first sentence. */
export function reasonSentence(w: Work, code: string, cfg: ConfigValues): string {
  const a = w.app;
  const v = gateValues(w, code);
  switch (code) {
    case 'ALLOCATED':
    case 'ALLOCATED_WITH_CONDITIONS':
      return `${a.id} is ${w.outcome === 'APPROVED' ? 'approved' : 'approved with conditions'} for ${w.territory?.id} (${w.territory?.city}), pin ${a.pin}: ranked #${w.slotRank ?? w.rank} with a score of ${w.sr?.score} for ${slotsPhrase(w)}.`;
    case 'PIN_TAKEN_BY_HIGHER_RANK':
      return `${a.id} is waitlisted because pin ${a.pin} went to ${w.competitor?.id}, who scored ${w.competitor?.score} against ${w.sr?.score}${w.competitor && w.competitor.margin > 0 ? '' : ' (decided on tie-breakers)'}; the brand allows only one store per pin.`;
    case 'SLOTS_FULL':
      return `${a.id} is waitlisted because all ${slotsPhrase(w)} went to higher-ranked applicants${w.competitor ? `; the last one approved, ${w.competitor.id}, scored ${w.competitor.score} against ${w.sr?.score}` : ''}.`;
    case 'NO_SLOTS':
      return `${a.id} is waitlisted because ${w.territory?.id} (${w.territory?.city}) has no open slots right now.`;
    case 'OUTSIDE_TERRITORIES':
      return `${a.id} is rejected for now because pin ${a.pin}${a.pinCity ? ` (${a.pinCity})` : ''} is outside every territory the brand is opening in.`;
    case 'PIN_HAS_STORE':
      return `${a.id} is rejected for pin ${a.pin} because the brand's store ${v.store} already operates there, and the brand never opens two stores in one pin.`;
    case 'CAPITAL_INSUFFICIENT':
      return `${a.id} is rejected because the investment of ₹${fmtNum(Number(v.investment))} lakh is well below the ₹${v.minimum} lakh minimum for ${v.tier}: short by ₹${fmtNum(Number(v.shortfall))} lakh (${v.shortfallPct}%).`;
    case 'CAPITAL_SHORTFALL_SMALL':
      return `${a.id} is on hold because the investment of ₹${fmtNum(Number(v.investment))} lakh is just short of the ₹${v.minimum} lakh minimum for ${v.tier}: a gap of ₹${fmtNum(Number(v.shortfall))} lakh (${v.shortfallPct}%).`;
    case 'SPACE_NOT_IDENTIFIED':
      return `${a.id} is on hold because no shop space has been found yet.`;
    case 'SPACE_TOO_SMALL':
      return `${a.id} is on hold because the space of ${fmtNum(Number(v.sqft))} sq ft is below the ${v.minimum} sq ft minimum for ${w.tier}.`;
    case 'SCORE_NEAR_MISS': {
      const weak = w.sr ? weakestPillar(w.sr.pillars) : null;
      return `${a.id} is on hold because the score of ${w.sr?.score} is just under the approval bar of ${cfg.MIN_SCORE_TO_APPROVE}${weak ? `; the weakest area is ${weak.label.toLowerCase()} (${weak.explanation.replace(/\.$/, '')})` : ''}.`;
    }
    case 'SCORE_BELOW_BAR': {
      const weak = w.sr ? weakestPillar(w.sr.pillars) : null;
      return `${a.id} is rejected because the score of ${w.sr?.score} is below the approval bar of ${cfg.MIN_SCORE_TO_APPROVE}${weak ? `; the weakest area is ${weak.label.toLowerCase()} (${weak.explanation.replace(/\.$/, '')})` : ''}.`;
    }
    case 'WITHDRAWN':
      return `${a.id} has withdrawn${w.wasApproved ? `, so the slot and pin ${a.pin} have been released to the next eligible applicant` : ''}.`;
    case 'RESERVATION_EXPIRED':
      return `${a.id} is back on hold because the slot reservation lapsed: ${w.trace.find((t) => t.code === 'RESERVATION_EXPIRED')?.sentence ?? ''}`;
    case 'RELEASED_BY_OVERRIDE':
      return `${a.id} is waitlisted because a team override released this approval in favour of ${gateValues(w, 'RELEASED_BY_OVERRIDE').for}.`;
    case 'MISSING_REQUIRED':
    case 'PIN_INVALID':
    case 'STATE_NOT_KARNATAKA':
    case 'PIN_CITY_MISMATCH':
    case 'SPACE_SIZE_MISSING':
    case 'NEGATIVE_OR_IMPOSSIBLE_VALUE':
    case 'DUPLICATE_ID':
    case 'DUPLICATE_APPLICANT': {
      const blocking = a.flags.filter((f) => f.severity === 'BLOCKING');
      return `${a.id} is on hold until the data is fixed: ${blocking.map((f) => f.message.replace(/\.$/, '')).join('; ')}.`;
    }
    default:
      return `${a.id} is ${label(w.outcome!).toLowerCase()}.`;
  }
}

/** Short reason for the table. */
export function oneLine(w: Work, cfg: ConfigValues): string {
  const code = w.reasons[0] === 'OVERRIDDEN' ? w.reasons[1] ?? 'OVERRIDDEN' : w.reasons[0];
  const a = w.app;
  const v = gateValues(w, code);
  const prefix = w.override?.status === 'applied' ? `Overridden by ${w.override.by}. ` : '';
  const lines: Record<string, string> = {
    ALLOCATED: `Ranked #${w.slotRank ?? w.rank} for ${slotsPhrase(w)}`,
    ALLOCATED_WITH_CONDITIONS: `Ranked #${w.slotRank ?? w.rank}; ${w.conditions.length} condition(s) to clear`,
    PIN_TAKEN_BY_HIGHER_RANK: `Pin ${a.pin} taken by ${w.competitor?.id} (${w.competitor?.score} vs ${w.sr?.score})`,
    SLOTS_FULL: `All ${w.territory?.openSlots} slots in ${w.territory?.id} filled by higher ranks`,
    NO_SLOTS: `${w.territory?.id} has 0 open slots`,
    OUTSIDE_TERRITORIES: `Pin ${a.pin} is outside all territories`,
    PIN_HAS_STORE: `Existing store ${v.store} in pin ${a.pin}`,
    CAPITAL_INSUFFICIENT: `₹${fmtNum(Number(v.investment))}L vs ₹${v.minimum}L minimum (short ${v.shortfallPct}%)`,
    CAPITAL_SHORTFALL_SMALL: `Short ₹${fmtNum(Number(v.shortfall))}L of the ₹${v.minimum}L minimum`,
    SPACE_NOT_IDENTIFIED: 'No shop space yet',
    SPACE_TOO_SMALL: `${fmtNum(Number(v.sqft))} sq ft < ${v.minimum} sq ft minimum`,
    SCORE_NEAR_MISS: `Score ${w.sr?.score}, just under the bar of ${cfg.MIN_SCORE_TO_APPROVE}`,
    SCORE_BELOW_BAR: `Score ${w.sr?.score} below the bar of ${cfg.MIN_SCORE_TO_APPROVE}`,
    WITHDRAWN: 'Applicant withdrew',
    RESERVATION_EXPIRED: 'Reservation lapsed; slot released',
    RELEASED_BY_OVERRIDE: 'Released for an override',
  };
  if (lines[code]) return prefix + lines[code];
  const blocking = a.flags.filter((f) => f.severity === 'BLOCKING');
  if (blocking.length) return prefix + [...new Set(blocking.map((f) => shortFlag(f.code)))].join('; ');
  return prefix + label(w.outcome!);
}

export function shortFlag(code: string): string {
  return (
    {
      MISSING_REQUIRED: 'Missing required info',
      PIN_INVALID: 'Pin code invalid',
      STATE_NOT_KARNATAKA: 'State not Karnataka',
      PIN_CITY_MISMATCH: 'Pin does not match city',
      SPACE_SIZE_MISSING: 'Space size missing',
      NEGATIVE_OR_IMPOSSIBLE_VALUE: 'Impossible value',
      DUPLICATE_ID: 'Duplicate application ID',
      DUPLICATE_APPLICANT: 'Same person applied twice',
    } as Record<string, string>
  )[code] ?? code;
}

export interface SummaryExtras {
  redirects: Redirect[];
  whatWouldChange: Counterfactual[];
  messageLanguage?: string;
}

/** 2-3 sentence summary: outcome + main reason, supporting numbers, what happens next / what would change it. */
export function summarise(w: Work, cfg: ConfigValues, x: SummaryExtras): string {
  const parts: string[] = [];
  const primary = w.reasons[0] === 'OVERRIDDEN' ? null : w.reasons[0];
  const a = w.app;

  if (w.override?.status === 'applied') {
    parts.push(`${a.id} is ${label(w.outcome!).toLowerCase()} by a team override from ${w.override.by} ("${w.override.reason}").`);
    parts.push(`The engine's own decision was ${label(w.engineOutcome!).toLowerCase()}.`);
    if (w.reasons[1] && !w.reasons[1].startsWith('ALLOCATED')) parts.push(`Engine reasoning: ${reasonSentence(w, w.reasons[1], cfg)}`);
  } else if (primary) {
    parts.push(reasonSentence(w, primary, cfg));
  }

  if (w.override?.status === 'refused') parts.push(`A requested override to ${label(w.override.outcome).toLowerCase()} was refused: ${w.override.conflict}`);

  // Supporting context
  if (isApproved(w.outcome)) {
    const best = bestPillar(w);
    if (best) parts.push(`Strongest area: ${best}.`);
    if (w.conditions.length) parts.push(`Before the agreement, ${w.conditions.length === 1 ? 'one condition must' : `${w.conditions.length} conditions must`} be resolved by ${fmtDate(w.conditions[0].deadline)}: ${w.conditions.map((c) => c.text.replace(/\.$/, '')).join('; ')}.`);
    if (w.reservation) parts.push(`The slot is reserved until ${fmtDate(w.reservation.deadline)}; the next step is signing the agreement and confirming the space.`);
  } else if (w.outcome === 'HOLD' && w.sr && !w.withdrawn) {
    const others = w.gateFails.filter((g) => g.code !== primary).map((g) => g.code);
    const rank = w.provisionalRank && w.territory ? `; would rank #${w.provisionalRank} for ${slotsPhrase(w)} if the hold cleared` : '';
    const pinNote = w.pinTakenBy ? ` Note that pin ${a.pin} is already taken by ${w.pinTakenBy}, so a different pin would be needed.` : '';
    const tone = w.sr.score >= cfg.MIN_SCORE_TO_APPROVE + 15 ? 'Everything else looks strong' : w.sr.score >= cfg.MIN_SCORE_TO_APPROVE ? 'Otherwise the application clears the bar' : 'Even then the score is below the bar';
    if (!['SCORE_NEAR_MISS', 'RESERVATION_EXPIRED'].includes(primary ?? '')) parts.push(`${others.length ? 'Other open points: ' + others.map(shortFlag).join(', ').toLowerCase() + '. ' : ''}${tone} (${w.sr.provisional ? 'provisional ' : ''}score ${w.sr.score}${rank}).${pinNote}`);
  } else if (w.outcome === 'WAITLISTED' && w.waitlistPosition) {
    parts.push(`Waitlist position #${w.waitlistPosition} in ${w.territory?.id}; promoted automatically if an approved partner drops out or misses their deadline.`);
  } else if (w.outcome === 'REJECTED' && w.sr && primary && ['OUTSIDE_TERRITORIES', 'PIN_HAS_STORE'].includes(primary)) {
    parts.push(`The application itself scores ${w.sr.score}${w.sr.provisional ? ' (provisional)' : ''}, so it is worth redirecting.`);
  }

  if (x.redirects.length) parts.push(x.redirects[0].sentence);
  else if (['OUTSIDE_TERRITORIES', 'PIN_HAS_STORE', 'NO_SLOTS', 'SLOTS_FULL', 'PIN_TAKEN_BY_HIGHER_RANK'].includes(primary ?? '')) parts.push('No other territory in the same city has a free slot and pin right now.');
  if (x.whatWouldChange.length && !isApproved(w.outcome)) parts.push(x.whatWouldChange[0].sentence);

  if (w.confidence === 'Low') parts.push(`Confidence is low because the data is thin or contradictory (${w.confidenceReasons.length} issue${w.confidenceReasons.length === 1 ? '' : 's'}), so the team should confirm before acting.`);
  if (x.messageLanguage && !w.withdrawn) parts.push(`A message has been prepared in ${x.messageLanguage}.`);
  return parts.join(' ');
}
