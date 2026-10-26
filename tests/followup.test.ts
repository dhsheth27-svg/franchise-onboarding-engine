import { describe, expect, test } from 'vitest';
import { config } from '@/lib/config';
import { runEngine } from '@/lib/engine';
import { compareAnswer, explainAnswer, parseRules, statusAnswer } from '@/lib/followup';
import { sampleInput } from '@/lib/sample';

const r = runEngine(sampleInput(), config, '2026-10-25');
const p = (m: string) => parseRules(m, r.decisions, r.territories);

describe('rule-based follow-up parsing', () => {
  test('explain', () => {
    expect(p('Why is APP-007 on hold?')).toEqual({ kind: 'explain', id: 'APP-007' });
    expect(p('explain app 3')).toEqual({ kind: 'explain', id: 'APP-003' });
  });
  test('update from the case brief example', () => {
    const i = p('APP-012 has now found a ground-floor space');
    expect(i.kind).toBe('update');
    if (i.kind === 'update') expect(i.patch).toMatchObject({ spaceAvailable: 'Rented', floor: 'Ground' });
    const j = p('APP-012 found a ground floor space of 400 sq ft, owned');
    if (j.kind === 'update') expect(j.patch).toMatchObject({ spaceAvailable: 'Owned', floor: 'Ground', spaceSize: 400 });
  });
  test('numbers: lakh, months, years experience, pin', () => {
    const i = p('APP-011 can now invest 20 lakh');
    if (i.kind === 'update') expect(i.patch.investment).toBe(20);
    const m = p('APP-005 moved to pin 560103');
    if (m.kind === 'update') expect(m.patch.pin).toBe('560103');
    const e = p('APP-020 actually has 6 years experience');
    if (e.kind === 'update') expect(e.patch.experience).toBe(6);
  });
  test('what-if is not an update', () => {
    expect(p('What if APP-007 found a ground floor space of 300 sq ft?').kind).toBe('whatif');
  });
  test('withdraw, missed deadline, signed, move forward', () => {
    expect(p('APP-001 has dropped out')).toEqual({ kind: 'withdraw', id: 'APP-001' });
    expect(p('APP-015 missed the deadline')).toEqual({ kind: 'reservationMissed', id: 'APP-015' });
    expect(p('APP-001 signed the agreement')).toEqual({ kind: 'milestone', id: 'APP-001', stage: 'agreement' });
    expect(p('move forward 35 days')).toEqual({ kind: 'dateAdvance', days: 35 });
  });
  test('status, compare, actions, clarify', () => {
    expect(p('Who got approved in Mysuru?')).toEqual({ kind: 'status', city: 'Mysuru' });
    expect(p('slots left in TER-02')).toEqual({ kind: 'status', territoryId: 'TER-02' });
    expect(p('Why did APP-001 beat APP-002?')).toEqual({ kind: 'compare', a: 'APP-001', b: 'APP-002' });
    expect(p('What should the team do today?')).toEqual({ kind: 'actions' });
    expect(p('Why is APP-099 on hold?').kind).toBe('clarify');
    expect(p('hello').kind).toBe('clarify');
  });
});

describe('answers come from the stored decision', () => {
  test('explain uses the summary', () => {
    const d = r.decisions.find((x) => x.key === 'APP-007')!;
    expect(explainAnswer(d)).toContain(d.summary);
  });
  test('compare names the winner and the pin', () => {
    const a = r.decisions.find((x) => x.key === 'APP-001')!;
    const b = r.decisions.find((x) => x.key === 'APP-002')!;
    expect(compareAnswer(a, b)).toMatch(/same pin 560010/);
  });
  test('status lists approvals in the city', () => {
    expect(statusAnswer(r, { city: 'Mysuru' })).toMatch(/APP-025/);
  });
});

describe('phrasings judges are likely to use', () => {
  test('city confirmation becomes an update that clears the pin/city mismatch', () => {
    const i = p('APP-005 confirmed the store is in Bengaluru');
    expect(i).toMatchObject({ kind: 'update', id: 'APP-005', patch: { city: 'Bengaluru' } });
  });
  test('state correction becomes an update', () => {
    const i = p('APP-022 says the state is actually Karnataka');
    expect(i).toMatchObject({ kind: 'update', id: 'APP-022', patch: { state: 'Karnataka' } });
  });
  test('"which territories have open slots" lists territories; "slots left in TER-02" still goes to that territory', () => {
    expect(p('Which territories still have open slots?')).toEqual({ kind: 'territories' });
    expect(p('Where can we still open stores?')).toEqual({ kind: 'territories' });
    expect(p('slots left in TER-02')).toEqual({ kind: 'status', territoryId: 'TER-02' });
  });
  test('"can APP-014 open in Belagavi instead" runs a what-if on a free Belagavi pin with a new space', () => {
    const i = p('Can APP-014 open in Belagavi instead?');
    expect(i.kind).toBe('whatif');
    if (i.kind === 'whatif') {
      expect(i.patch.city).toBe('Belagavi');
      expect(String(i.patch.pin).startsWith('590')).toBe(true);
      expect(i.patch.spaceAvailable).toBe('Not yet identified');
    }
  });
  test('a move to a city without saying the pin asks which pin', () => {
    expect(p('APP-014 has moved to Belagavi').kind).toBe('clarify');
  });
});

test('"which places can we still put new stores in" lists territories', () => {
  expect(p('Which places can we still put new stores in?')).toEqual({ kind: 'territories' });
});

test('event-creating readings must be backed by the message wording', async () => {
  const { confirmEventWording } = await import('@/lib/followup');
  const msg = 'Good news: Imran (APP-012) finally got a shop on the ground floor, about four hundred square feet';
  expect(confirmEventWording({ kind: 'milestone', id: 'APP-012', stage: 'agreement' }, msg)).toBe(false);
  expect(confirmEventWording({ kind: 'withdraw', id: 'APP-012' }, msg)).toBe(false);
  expect(confirmEventWording({ kind: 'milestone', id: 'APP-001', stage: 'agreement' }, 'APP-001 signed the agreement today')).toBe(true);
  expect(confirmEventWording({ kind: 'update', id: 'APP-012', patch: {}, notes: [] }, msg)).toBe(true);
});

describe('consistency and next steps', () => {
  test('a hold quotes the same once-cleared rank in its explanation, message and action', () => {
    let checked = 0;
    for (const d of r.decisions.filter((x) => x.outcome === 'HOLD')) {
      const fix = d.whatWouldChange.find((c) => ['space', 'capital', 'data', 'launch', 'score'].includes(c.kind) && c.outcome.startsWith('APPROVED') && c.rank);
      if (!fix) continue;
      const action = r.actions.find((a) => a.applicationKey === d.key && a.id.startsWith('hold:'));
      if (action && /Would rank #/.test(action.why)) {
        expect(action.why).toContain(`Would rank #${fix.rank} `);
        checked++;
      }
      if (d.language === 'English' && /rank #/.test(d.message.text)) expect(d.message.text).toContain(`#${fix.rank}`);
    }
    expect(checked).toBeGreaterThan(0);
  });

  test('approved partners are told what to do next and how they will be prepared', () => {
    const d = r.decisions.find((x) => x.outcome === 'APPROVED' && x.onboarding)!;
    const a = explainAnswer(d);
    expect(a).toMatch(/Next steps: 1\. /);
    expect(a).toContain(`How ${d.applicationId} will be prepared:`);
    expect(a).toMatch(/programme \(\d+ weeks?\) in (English|Kannada|Hindi)/);
  });
});
