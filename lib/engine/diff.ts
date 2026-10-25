// Before/after comparison of two run versions across ALL applicants, so ripple effects
// (a withdrawal promoting someone else) are visible.

import { label } from './decide';
import type { Decision, Outcome, RunResult } from './types';

export interface FieldChange {
  field: 'outcome' | 'score' | 'rank' | 'conditions' | 'reservation' | 'territory' | 'pin';
  from: string;
  to: string;
}

export interface DiffEntry {
  key: string;
  applicationId: string;
  outcomeFrom: Outcome | null;
  outcomeTo: Outcome | null;
  changes: FieldChange[];
  sentence: string;
}

const rankOf = (d: Decision) => (d.slotRank ? `#${d.slotRank} (slot)` : d.provisionalRank ? `#${d.provisionalRank} (provisional)` : d.waitlistPosition ? `#${d.waitlistPosition} (waitlist)` : '—');

export function diffRuns(before: RunResult, after: RunResult): DiffEntry[] {
  const b = new Map(before.decisions.map((d) => [d.key, d]));
  const a = new Map(after.decisions.map((d) => [d.key, d]));
  const keys = [...new Set([...b.keys(), ...a.keys()])];
  const out: DiffEntry[] = [];
  for (const key of keys) {
    const x = b.get(key);
    const y = a.get(key);
    const changes: FieldChange[] = [];
    const push = (field: FieldChange['field'], from: unknown, to: unknown) => {
      const f = from === undefined || from === null ? '—' : String(from);
      const t = to === undefined || to === null ? '—' : String(to);
      if (f !== t) changes.push({ field, from: f, to: t });
    };
    push('outcome', x && label(x.outcome), y && label(y.outcome));
    push('score', x?.score, y?.score);
    push('rank', x && rankOf(x), y && rankOf(y));
    push('pin', x?.pin, y?.pin);
    push('territory', x?.territoryId, y?.territoryId);
    push('conditions', x?.conditions.length ?? 0, y?.conditions.length ?? 0);
    push('reservation', x?.reservation?.status, y?.reservation?.status);
    if (!changes.length) continue;
    const id = (y ?? x)!.applicationId;
    const oc = changes.find((c) => c.field === 'outcome');
    const sentence = oc
      ? `${id}: ${oc.from} → ${oc.to}${y ? ` (${y.oneLine})` : ''}.`
      : `${id}: ${changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join(', ')}.`;
    out.push({ key, applicationId: id, outcomeFrom: x?.outcome ?? null, outcomeTo: y?.outcome ?? null, changes, sentence });
  }
  // Outcome changes first
  return out.sort((p, q) => Number(q.outcomeFrom !== q.outcomeTo) - Number(p.outcomeFrom !== p.outcomeTo));
}
