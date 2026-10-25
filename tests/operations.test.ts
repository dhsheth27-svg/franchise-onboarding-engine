import { describe, expect, test } from 'vitest';
import { runEngine, type EngineEvent, type EngineInput, type RunResult } from '@/lib/engine';
import { effectiveConfig, effectiveInput, mergePolicy, type Policy } from '@/lib/policy';
import { sampleInput } from '@/lib/sample';

const TODAY = '2026-10-25';
const runP = (input: EngineInput, policy?: Policy) => runEngine(effectiveInput({ ...input, policy }), effectiveConfig(policy), TODAY);
const d = (r: RunResult, k: string) => r.decisions.find((x) => x.key === k)!;
const ev = (type: EngineEvent['type'], applicationId: string | undefined, payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent => ({ id: Math.random().toString(36), type, applicationId, payload, at: TODAY, ...extra });
const base = runP(sampleInput());

describe('policy simulator', () => {
  test('raising the approval bar rejects or holds weaker approvals; hard rules hold', () => {
    const r = runP(sampleInput(), { MIN_SCORE_TO_APPROVE: 75 });
    expect(d(r, 'APP-024').outcome).not.toMatch(/APPROVED/); // scored 68.5
    expect(d(r, 'APP-026').outcome).toBe('APPROVED'); // scored 95.4
    expect(r.assertions.ok).toBe(true);
  });
  test('adding a slot to a territory promotes its waitlist', () => {
    expect(d(base, 'APP-018').outcome).toBe('WAITLISTED');
    const r = runP(sampleInput(), { territorySlots: { 'TER-04': 2 } });
    expect(d(r, 'APP-018').outcome).toBe('APPROVED');
    expect(r.assertions.ok).toBe(true);
  });
  test('lowering the Tier 2 minimum investment clears a small capital gap', () => {
    expect(d(base, 'APP-011').primaryReason).toBe('CAPITAL_SHORTFALL_SMALL');
    const r = runP(sampleInput(), { minInvestmentLakh: { 'Tier 2': 18 } });
    expect(d(r, 'APP-011').outcome).toMatch(/APPROVED/);
  });
  test('effective config marks changed values and merges policies', () => {
    const c = effectiveConfig({ reservationDays: 45 });
    expect(c.reservationDays.value).toBe(45);
    expect(c.reservationDays.rationale).toMatch(/^Team policy/);
    expect(mergePolicy({ territorySlots: { 'TER-01': 5 } }, { territorySlots: { 'TER-02': 1 } }).territorySlots).toEqual({ 'TER-01': 5, 'TER-02': 1 });
  });
});

describe('journey and outbox', () => {
  test('marking the agreement step done fulfils the reservation', () => {
    const r = runP({ ...sampleInput(), events: [ev('checklist', 'APP-001', { kind: 'onboarding', item: 'agreement', status: 'Done' })], priorApprovals: base.approvalDates });
    expect(d(r, 'APP-001').reservation?.status).toBe('Fulfilled');
    expect(d(r, 'APP-001').onboarding!.steps[0].status).toBe('Done');
  });
  test('a message marked sent completes the hold task, and goes stale when the decision changes', () => {
    const sent = ev('checklist', 'APP-007', { kind: 'message', item: 'message', status: 'Sent', channel: 'WhatsApp', outcome: 'HOLD' }, { by: 'Asha' });
    const r1 = runP({ ...sampleInput(), events: [sent], priorApprovals: base.approvalDates });
    expect(d(r1, 'APP-007').message.sent).toMatchObject({ channel: 'WhatsApp', by: 'Asha', current: true });
    expect(r1.actions.find((a) => a.id === 'hold:APP-007')!.done).toBe(true);
    const r2 = runP({ ...sampleInput(), events: [sent, ev('update', 'APP-007', { spaceAvailable: 'Rented', spaceSize: 300, floor: 'Ground' })], priorApprovals: base.approvalDates });
    expect(d(r2, 'APP-007').outcome).toMatch(/APPROVED/);
    expect(d(r2, 'APP-007').message.sent?.current).toBe(false);
  });
});
