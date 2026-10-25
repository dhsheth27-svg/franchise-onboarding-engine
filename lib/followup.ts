// Follow-up engine: turn a plain-language message into a structured intent (rules first, optional
// LLM), then answer from stored traces or apply an update as an event and re-run the engine.
// The LLM never decides outcomes: it only parses the message into the same intent shape.

import { CITIES } from './config';
import { label } from './engine/decide';
import type { DiffEntry } from './engine/diff';
import { fmtDate } from './engine/normalize';
import type { Decision, RunResult, TerritorySummary } from './engine/types';
import type { NewEvent } from './runs';

export type Patch = Partial<Record<'spaceAvailable' | 'spaceSize' | 'floor' | 'investment' | 'experience' | 'targetLaunch' | 'pin' | 'city' | 'state' | 'language' | 'notes', string | number>>;

export type Intent =
  | { kind: 'explain'; id: string }
  | { kind: 'compare'; a: string; b: string }
  | { kind: 'status'; territoryId?: string; city?: string }
  | { kind: 'whatif'; id: string; patch: Patch; notes: string[] }
  | { kind: 'update'; id: string; patch: Patch; notes: string[] }
  | { kind: 'withdraw'; id: string }
  | { kind: 'reservationMissed'; id: string }
  | { kind: 'milestone'; id: string; stage: string }
  | { kind: 'dateAdvance'; days: number }
  | { kind: 'actions' }
  | { kind: 'overview' }
  | { kind: 'territories' }
  | { kind: 'clarify'; question: string };

// ---------- Rule-based parsing ----------

export function findIds(text: string, decisions: Decision[]): { found: string[]; unknown: string[] } {
  const found: string[] = [];
  const unknown: string[] = [];
  for (const m of text.matchAll(/\b(?:APP|app|App)[\s\-_]?0*(\d{1,4})(#\d)?\b/g)) {
    const num = parseInt(m[1], 10);
    const suffix = m[2] ?? '';
    const d =
      decisions.find((x) => x.key.toUpperCase() === `APP-${m[1].padStart(3, '0')}${suffix}`) ??
      decisions.find((x) => x.key.toUpperCase() === `APP-${m[1]}${suffix}`) ??
      decisions.find((x) => /^APP-?0*\d+$/i.test(x.applicationId) && parseInt(x.applicationId.replace(/\D/g, ''), 10) === num && (!suffix || x.key.endsWith(suffix)));
    if (d && !found.includes(d.key)) found.push(d.key);
    else if (!d) unknown.push(`APP-${m[1].padStart(3, '0')}`);
  }
  // Exact keys that are not APP-style (e.g. ROW-12)
  for (const d of decisions) if (!/^APP/i.test(d.key) && new RegExp(`\\b${d.key.replace(/[#-]/g, '\\$&')}\\b`, 'i').test(text) && !found.includes(d.key)) found.push(d.key);
  return { found, unknown };
}

export function extractPatch(text: string): { patch: Patch; notes: string[] } {
  const t = text.toLowerCase();
  const patch: Patch = {};
  const notes: string[] = [];
  if (/ground[\s-]?floor|\bground\b|\bgf\b|street[- ]facing/.test(t)) patch.floor = 'Ground';
  else if (/upper[\s-]?floor|first[\s-]floor|1st[\s-]floor|second[\s-]floor|2nd[\s-]floor/.test(t)) patch.floor = 'Upper';
  else if (/\bmall\b/.test(t)) patch.floor = 'Mall unit';

  const size = t.match(/(\d[\d,]*)\s*(?:sq\.?\s*ft|sqft|square\s*feet|sq\.?\s*feet|sft)/);
  if (size) patch.spaceSize = parseInt(size[1].replace(/,/g, ''), 10);

  const lostSpace = /(lost|no longer has|gave up|lease fell through|dropped) (the |their |his |her )?(space|shop)/.test(t);
  const spaceWords = /space|shop|premises|unit|property|outlet|location/.test(t) || patch.floor || patch.spaceSize;
  const foundWords = /found|got|secured|identified|has (a|an)|have (a|an)|signed (a|the)? ?lease|leased|rented|bought|purchased|owns?|finali[sz]ed|located/.test(t);
  if (lostSpace) patch.spaceAvailable = 'Not yet identified';
  else if (/\bowned\b|\bown (shop|space|property|building)\b|bought|purchased|their own|his own|her own/.test(t)) patch.spaceAvailable = 'Owned';
  else if (/\brent(ed)?\b|\blease(d)?\b|on rent/.test(t) && spaceWords) patch.spaceAvailable = 'Rented';
  else if (spaceWords && foundWords) {
    patch.spaceAvailable = 'Rented';
    notes.push('Tenure was not stated, so the space is recorded as rented (the more conservative assumption). Say "owned" to correct it.');
  }

  const inv = t.match(/(?:₹|rs\.?\s*)?(\d+(?:\.\d+)?)\s*(lakh|lakhs|lac|lacs|crore|cr)\b/);
  if (inv) patch.investment = parseFloat(inv[1]) * (/cr/.test(inv[2]) ? 100 : 1);
  const exp = t.match(/(\d+(?:\.\d+)?)\s*(?:years?|yrs?)(?:\s+of)?(?:\s+retail)?\s+experience|experience\s+(?:of\s+|is\s+|to\s+)?(\d+(?:\.\d+)?)\s*(?:years?|yrs?)/);
  if (exp) patch.experience = parseFloat(exp[1] ?? exp[2]);
  const months = t.match(/(\d{1,2})\s*months?/);
  if (months && /launch|open|target|timeline|start|months? (from now|away)|in \d+ months/.test(t)) patch.targetLaunch = parseInt(months[1], 10);
  const pin = t.match(/\b(\d{3}\s?\d{3})\b/);
  if (pin && /pin|move|moved|shift|relocat|change/.test(t)) patch.pin = pin[1].replace(/\s/g, '');
  const lang = t.match(/\b(kannada|hindi|english)\b/);
  if (lang && /language|prefers?|speak|training|communicat|messages?/.test(t)) patch.language = lang[1][0].toUpperCase() + lang[1].slice(1);
  const note = text.match(/notes?\s*[:=]\s*(.+)$/i);
  if (note) patch.notes = note[1].trim();
  return { patch, notes };
}

/** Allowed city named in the text (accepts old spellings such as Bangalore, Mysore, Belgaum, Hubli). */
export function findCity(t: string): string | null {
  const c = CITIES.find(
    (c) =>
      t.includes(c.city.toLowerCase()) ||
      (c.city === 'Bengaluru' && /bangalore/.test(t)) ||
      (c.city === 'Mysuru' && /mysore/.test(t)) ||
      (c.city === 'Mangaluru' && /mangalore/.test(t)) ||
      (c.city === 'Belagavi' && /belgaum/.test(t)) ||
      (c.city === 'Hubballi-Dharwad' && /hubli|hubballi|dharwad/.test(t)) ||
      (c.city === 'Tumakuru' && /tumkur/.test(t)) ||
      (c.city === 'Davanagere' && /davangere/.test(t)),
  );
  return c?.city ?? null;
}

/** Wording that must be present before a message may record these events (also used to check the AI's reading). */
export const EVENT_WORDING = {
  withdraw: /withdr[ae]w|dropped out|drop out|backed out|pulled out|no longer interested|not interested|cancel(l)?ed|quit/,
  reservationMissed: /missed (the |their )?(deadline|reservation)|did ?n[o']t sign|reservation (has )?(lapsed|expired)|failed to sign/,
  milestone: /signed (the )?(franchise )?agreement|agreement (is |has been |was )?signed|signs? the agreement/,
  dateAdvance: /(?:move|go|jump|fast[\s-]?forward|advance|skip|simulate)\s+(?:the date\s+)?(?:forward\s+|ahead\s+)?(?:by\s+)?(\d{1,3})\s*days?|(\d{1,3})\s*days?\s+(?:later|forward|ahead|pass)/,
};

/** Reject an AI reading that would record an event the message does not actually describe. */
export function confirmEventWording(intent: Intent, message: string): boolean {
  const t = message.toLowerCase();
  if (intent.kind === 'withdraw' || intent.kind === 'reservationMissed' || intent.kind === 'milestone' || intent.kind === 'dateAdvance') return EVENT_WORDING[intent.kind].test(t);
  return true;
}

export function parseRules(message: string, decisions: Decision[], territories: TerritorySummary[]): Intent {
  const text = message.trim();
  const t = text.toLowerCase();
  const { found, unknown } = findIds(text, decisions);

  const days = t.match(EVENT_WORDING.dateAdvance);
  if (days) return { kind: 'dateAdvance', days: parseInt(days[1] ?? days[2], 10) };

  if (unknown.length && !found.length) {
    return { kind: 'clarify', question: `I couldn't find ${unknown.join(', ')} in this run. Which application did you mean? (IDs run from ${decisions[0]?.applicationId} to ${decisions[decisions.length - 1]?.applicationId}.)` };
  }

  if (!found.length) {
    if (/what should|to-?do|today|action|priorit|chase|follow up|next steps for the team/.test(t)) return { kind: 'actions' };
    const terr = t.match(/\bter[\s-]?0*(\d+)\b/);
    const city = findCity(t);
    if (terr) {
      const id = territories.find((x) => parseInt(x.id.replace(/\D/g, ''), 10) === parseInt(terr[1], 10))?.id;
      if (id) return { kind: 'status', territoryId: id };
      return { kind: 'clarify', question: `There is no territory TER-${terr[1].padStart(2, '0')} in this run. Territories: ${territories.map((x) => x.id).join(', ')}.` };
    }
    if (city) return { kind: 'status', city };
    if (/territor|slots? (left|open|free|available|remaining)|open slots?|free (pins?|slots?)|capacity|where can|unfilled|vacan|new stores?|still (open|room)|have room|which (places|areas|cities)/.test(t)) return { kind: 'territories' };
    if (/summary|overview|how many|overall|results|approved|who got|slots/.test(t)) return { kind: 'overview' };
    return {
      kind: 'clarify',
      question: 'Which application or territory do you mean? For example: "Why is APP-007 on hold?", "Who got approved in Mysuru?", "APP-012 has found a ground-floor space of 400 sq ft", or "What should the team do today?"',
    };
  }

  if (found.length >= 2 && /beat|vs\.?|versus|compare|over|instead|ahead|better|lose|lost|why did|difference/.test(t)) return { kind: 'compare', a: found[0], b: found[1] };
  const id = found[0];
  if (EVENT_WORDING.withdraw.test(t)) return { kind: 'withdraw', id };
  if (EVENT_WORDING.reservationMissed.test(t)) return { kind: 'reservationMissed', id };
  if (EVENT_WORDING.milestone.test(t)) return { kind: 'milestone', id, stage: 'agreement' };

  const { patch, notes } = extractPatch(text);
  const hypothetical = /what if|what would|would .* (be|get|happen)|suppose|hypothetical|imagine|if (they|he|she|app)|^can |^could |\bcan (app|they|he|she)\b|\bcould (app|they|he|she)\b/.test(t);
  const d = decisions.find((x) => x.key === id)!;

  // State correction ("the state is actually Karnataka")
  if (/\bstate\b/.test(t) && /karnataka/.test(t)) patch.state = 'Karnataka';

  // City named for this applicant: either confirming the city its pin already points to, or a move.
  const city = findCity(t);
  if (city && patch.pin === undefined) {
    const pinCity = d.application.pinCity;
    if (pinCity === city && city !== d.city) {
      patch.city = city; // confirms the pin's city, clearing a pin/city mismatch
    } else if (city !== pinCity) {
      const free = territories.filter((x) => x.city === city && x.slotsLeft > 0 && x.freePinsNow.length > 0);
      if (!free.length)
        return { kind: 'clarify', question: `${city} has no territory with a free slot and pin right now, so ${d.applicationId} cannot be placed there. Ask "Which territories still have open slots?" to see where there is room.` };
      const statesFact = /\b(has|have|is|was|had)\s+(moved|moving|relocated|relocating|shifted|shifting)\b|\bmoved to\b/.test(t);
      if (!statesFact && (hypothetical || /instead|relocat|open in|switch|move to/.test(t))) {
        const target = free[0];
        // A new city needs a new shop space; the current one is in the old city.
        return {
          kind: 'whatif',
          id,
          patch: { pin: target.freePinsNow[0], city, spaceAvailable: 'Not yet identified', spaceSize: '', floor: '' },
          notes: [`Assumed free pin ${target.freePinsNow[0]} in ${target.id} and that a new shop space would be needed there. To record a real move, say e.g. "${d.applicationId} moved to pin ${target.freePinsNow[0]}".`],
        };
      }
      return { kind: 'clarify', question: `Which pin code in ${city} should ${d.applicationId} move to? Free pins with open slots: ${free.flatMap((x) => x.freePinsNow.slice(0, 4).map((p) => `${p} (${x.id})`)).join(', ')}.` };
    }
  }
  if (Object.keys(patch).length) return hypothetical ? { kind: 'whatif', id, patch, notes } : { kind: 'update', id, patch, notes };
  if (hypothetical) return { kind: 'clarify', question: `What would change for ${decisions.find((d) => d.key === id)?.applicationId}? For example: "What if APP-007 found a ground-floor space of 300 sq ft?"` };
  return { kind: 'explain', id };
}

// ---------- Answers from stored traces ----------

export function explainAnswer(d: Decision): string {
  const parts = [d.summary];
  const failed = d.trace.filter((s) => s.step === 'gate' && s.result === 'fail').map((s) => s.sentence);
  if (failed.length > 1) parts.push(`All checks that failed: ${failed.join(' ')}`);
  if (d.whatWouldChange.length > 1) parts.push(`Other ways forward: ${d.whatWouldChange.slice(1).map((c) => c.sentence).join(' ')}`);
  return parts.join('\n\n');
}

export function compareAnswer(a: Decision, b: Decision): string {
  if (!a.pillars || !b.pillars) return `${[a, b].filter((x) => !x.pillars).map((x) => x.applicationId).join(' and ')} could not be scored (missing data), so a score comparison is not possible. ${a.applicationId}: ${a.oneLine}. ${b.applicationId}: ${b.oneLine}.`;
  const [hi, lo] = (a.score ?? 0) >= (b.score ?? 0) ? [a, b] : [b, a];
  const keys = ['financial', 'operator', 'site', 'launch', 'territory'] as const;
  const diffs = keys
    .map((k) => ({ k, label: hi.pillars![k].label, d: hi.pillars![k].points - lo.pillars![k].points, hiX: hi.pillars![k].explanation, loX: lo.pillars![k].explanation }))
    .sort((x, y) => Math.abs(y.d) - Math.abs(x.d));
  const ded = lo.pillars!.cannibalisationDeduction.points - hi.pillars!.cannibalisationDeduction.points;
  const sameTerr = a.territoryId && a.territoryId === b.territoryId;
  const lines = [
    `${hi.applicationId} scores ${hi.score} (${label(hi.outcome).toLowerCase()}) against ${lo.score} for ${lo.applicationId} (${label(lo.outcome).toLowerCase()}), a gap of ${(Math.round(((hi.score ?? 0) - (lo.score ?? 0)) * 10) / 10).toFixed(1)} points.`,
    sameTerr
      ? hi.pin === lo.pin
        ? `They want the same pin ${hi.pin} in ${hi.territoryId}, and only one store is allowed per pin, so the higher score wins it.`
        : `Both are in ${hi.territoryId} but on different pins, so they compete only for its ${hi.territorySlots} slot(s).`
      : `They are in different territories (${a.territoryId ?? 'none'} vs ${b.territoryId ?? 'none'}), so they do not compete directly.`,
    `Biggest differences: ${diffs
      .filter((x) => Math.abs(x.d) >= 0.5)
      .slice(0, 3)
      .map((x) => `${x.label.toLowerCase()} ${x.d >= 0 ? '+' : ''}${x.d.toFixed(1)} for ${hi.applicationId} (${hi.applicationId}: ${x.hiX.replace(/\.$/, '')}; ${lo.applicationId}: ${x.loX.replace(/\.$/, '')})`)
      .join('; ')}${Math.abs(ded) >= 0.5 ? `; cannibalisation deduction differs by ${Math.abs(ded).toFixed(1)}` : ''}.`,
  ];
  if (Math.abs((hi.score ?? 0) - (lo.score ?? 0)) <= 3) lines.push('This is a close call (3 points or less); worth a second look by the team.');
  return lines.join(' ');
}

export function statusAnswer(r: RunResult, q: { territoryId?: string; city?: string }): string {
  const terrs = r.territories.filter((t) => (q.territoryId ? t.id === q.territoryId : t.city === q.city));
  const byKey = new Map(r.decisions.map((d) => [d.key, d]));
  const name = (k: string) => {
    const d = byKey.get(k)!;
    return `${d.applicationId}${d.pin ? ` (pin ${d.pin}${d.score !== null ? `, ${d.score}` : ''})` : ''}`;
  };
  if (!terrs.length) {
    const outside = r.decisions.filter((d) => d.city === q.city);
    return `${q.city} has no territory in this run${outside.length ? `; ${outside.length} applicant(s) there were rejected as outside the territories: ${outside.map((d) => d.applicationId).join(', ')}.` : '.'}`;
  }
  return terrs
    .map(
      (t) =>
        `${t.id} (${t.city}, ${t.priority} priority): ${t.approved.length} approved of ${t.openSlots} slot(s) (real capacity ${t.realCapacity}).` +
        `\n• Approved: ${t.approved.length ? t.approved.map(name).join(', ') : 'none'}` +
        `\n• Waitlisted: ${t.waitlisted.length ? t.waitlisted.map(name).join(', ') : 'none'}` +
        `\n• On hold: ${t.held.length ? t.held.map(name).join(', ') : 'none'}` +
        `\n• Slots left: ${t.slotsLeft}; free pins: ${t.freePinsNow.length ? t.freePinsNow.join(', ') : 'none'}`,
    )
    .join('\n\n');
}

export function territoriesAnswer(r: RunResult): string {
  const open = r.territories.filter((t) => t.unfilled > 0);
  const lines = r.territories.map(
    (t) =>
      `• ${t.id} (${t.city}, ${t.priority}): ${t.slotsLeft} of ${t.openSlots} slot(s) left${t.freePinsNow.length ? `, free pins ${t.freePinsNow.slice(0, 4).join(', ')}` : ', no free pins'}${t.realCapacity < t.openSlots ? ` (only ${t.realCapacity} usable: other pins already have stores)` : ''}${t.waitlisted.length ? `; ${t.waitlisted.length} waitlisted` : ''}`,
  );
  return `${open.length ? `${open.length} territor${open.length === 1 ? 'y has' : 'ies have'} room right now: ${open.map((t) => `${t.id} (${t.city}, ${t.unfilled} slot${t.unfilled === 1 ? '' : 's'})`).join(', ')}.` : 'Every usable slot is filled right now.'}\n\n${lines.join('\n')}`;
}

export function overviewAnswer(r: RunResult): string {
  const c = r.counts;
  const slots = r.territories.reduce((n, t) => n + t.realCapacity, 0);
  return `${r.decisions.length} applications decided: ${c.APPROVED} approved, ${c.APPROVED_WITH_CONDITIONS} approved with conditions, ${c.HOLD} on hold, ${c.WAITLISTED} waitlisted, ${c.REJECTED} rejected. ${c.APPROVED + c.APPROVED_WITH_CONDITIONS} of ${slots} usable slots are filled. Ask about a territory ("Who got approved in Mysuru?") or an applicant ("Why is APP-007 on hold?") for detail.`;
}

export function actionsAnswer(r: RunResult): string {
  const open = r.actions.filter((a) => !a.done);
  if (!open.length) return 'No open actions right now.';
  return `${open.length} open action(s). Top ${Math.min(5, open.length)}:\n${open
    .slice(0, 5)
    .map((a, i) => `${i + 1}. ${a.what}: ${a.why}${a.deadline ? ` (by ${fmtDate(a.deadline)})` : ''}`)
    .join('\n')}`;
}

/** Turn a re-decided run into an answer: what changed for the applicant, which step flipped, ripple effects. */
export function changeAnswer(before: RunResult, after: RunResult, key: string | null, diff: DiffEntry[], lead: string, notes: string[] = []): string {
  const parts = [lead];
  if (key) {
    const b = before.decisions.find((d) => d.key === key);
    const a = after.decisions.find((d) => d.key === key);
    if (a && b) {
      if (a.outcome !== b.outcome || a.withdrawn !== b.withdrawn) {
        parts.push(`${a.applicationId} moves from ${b.withdrawn ? 'withdrawn' : label(b.outcome).toLowerCase()} to ${a.withdrawn ? 'withdrawn' : label(a.outcome).toLowerCase()}.`);
        const flipped = a.trace.find((s, i) => {
          const prev = b.trace.find((x) => x.check === s.check && x.step === s.step);
          return (s.step === 'gate' || s.step === 'score' || s.step === 'allocate' || s.step === 'reservation' || s.step === 'event') && prev && prev.result !== s.result && i >= 0;
        });
        if (flipped) parts.push(`The step that changed: ${flipped.check.replace(/^G\d /, '')}: ${flipped.sentence}`);
      } else {
        parts.push(`${a.applicationId} stays ${label(a.outcome).toLowerCase()}${a.score !== b.score && a.score !== null ? ` (score ${b.score ?? '—'} → ${a.score})` : ''}.`);
      }
      parts.push(a.summary);
    }
  }
  const ripple = diff.filter((x) => x.key !== key && x.outcomeFrom !== x.outcomeTo);
  if (ripple.length) parts.push(`Ripple effects: ${ripple.map((x) => x.sentence).join(' ')}`);
  else if (key) parts.push('No other applicant changed outcome.');
  if (notes.length) parts.push(notes.join(' '));
  if (!after.assertions.ok) parts.push(`Warning: hard rule check failed: ${after.assertions.violations.join(' ')}`);
  return parts.join('\n\n');
}

export function describeIntentPatch(p: Patch): string {
  const names: Record<string, string> = { spaceAvailable: 'space', spaceSize: 'size', floor: 'floor', investment: 'investment', experience: 'experience', targetLaunch: 'target launch', pin: 'pin', city: 'city', state: 'state', language: 'language', notes: 'notes' };
  const unit: Record<string, string> = { spaceSize: ' sq ft', investment: ' lakh', experience: ' years', targetLaunch: ' months' };
  if (p.pin && p.city && p.spaceAvailable === 'Not yet identified') return `opened in ${p.city} at pin ${p.pin} instead (with a new shop space to find there)`;
  return Object.entries(p)
    .filter(([, v]) => v !== '' && v !== undefined && v !== null)
    .map(([k, v]) => `${names[k] ?? k} ${v}${unit[k] ?? ''}`)
    .join(', ');
}

export function intentToEvents(intent: Intent, message: string): NewEvent[] {
  switch (intent.kind) {
    case 'update':
      return [{ type: 'update', applicationId: intent.id, payload: intent.patch, reason: message.slice(0, 200) }];
    case 'withdraw':
      return [{ type: 'withdraw', applicationId: intent.id, payload: {}, reason: message.slice(0, 200) }];
    case 'reservationMissed':
      return [{ type: 'reservationMissed', applicationId: intent.id, payload: {}, reason: message.slice(0, 200) }];
    case 'milestone':
      return [{ type: 'milestone', applicationId: intent.id, payload: { stage: intent.stage } }];
    case 'dateAdvance':
      return [{ type: 'dateAdvance', payload: { days: intent.days } }];
    default:
      return [];
  }
}
