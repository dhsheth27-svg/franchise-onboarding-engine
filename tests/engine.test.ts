import { describe, expect, test } from 'vitest';
import { config, configValues } from '@/lib/config';
import { runEngine, type EngineEvent, type EngineInput, type RunResult } from '@/lib/engine';
import { diffRuns } from '@/lib/engine/diff';
import { parseNumber, parsePin } from '@/lib/engine/normalize';
import { extractSignals } from '@/lib/engine/signals';
import { sampleInput } from '@/lib/sample';

const TODAY = '2026-10-25';
const run = (input: EngineInput = sampleInput(), today = TODAY) => runEngine(input, config, today);
const d = (r: RunResult, key: string) => {
  const x = r.decisions.find((y) => y.key === key);
  if (!x) throw new Error(`no decision ${key}`);
  return x;
};
const ev = (type: EngineEvent['type'], applicationId: string | undefined, payload: Record<string, unknown> = {}, extra: Partial<EngineEvent> = {}): EngineEvent => ({
  id: `${type}-${applicationId}-${Math.random()}`,
  type,
  applicationId,
  payload,
  at: TODAY,
  ...extra,
});
const withEvents = (events: EngineEvent[], prior?: RunResult): EngineInput => ({ ...sampleInput(), events, priorApprovals: prior?.approvalDates });

const base = run();

describe('sample dataset: section 20 cases', () => {
  test('hard rules hold on the sample', () => {
    expect(base.assertions.violations).toEqual([]);
  });

  test('1. two applicants on the same pin: higher score wins, other waitlisted naming the winner, with redirects', () => {
    const winner = d(base, 'APP-001');
    const loser = d(base, 'APP-002');
    expect(winner.outcome).toBe('APPROVED');
    expect(loser.outcome).toBe('WAITLISTED');
    expect(loser.primaryReason).toBe('PIN_TAKEN_BY_HIGHER_RANK');
    expect(loser.competitor?.id).toBe('APP-001');
    expect(winner.score!).toBeGreaterThan(loser.score!);
    expect(loser.summary).toContain('APP-001');
    expect(loser.redirects.length).toBeGreaterThan(0);
    expect(loser.redirects[0].freePins).toContain('560103');
  });

  test('2. pin with an existing store: rejected with redirect to free pins', () => {
    const x = d(base, 'APP-003');
    expect(x.outcome).toBe('REJECTED');
    expect(x.primaryReason).toBe('PIN_HAS_STORE');
    expect(x.summary).toContain('ST-02');
    expect(x.redirects[0].territoryId).toBe('TER-01');
    expect(x.redirects[0].freePins.length).toBeGreaterThan(0);
  });

  test('3. pin outside every territory (Tumakuru): rejected', () => {
    const x = d(base, 'APP-004');
    expect(x.outcome).toBe('REJECTED');
    expect(x.primaryReason).toBe('OUTSIDE_TERRITORIES');
    expect(x.territoryId).toBeNull();
  });

  test('4. pin prefix does not match the stated city: hold, asks to confirm', () => {
    const x = d(base, 'APP-005');
    expect(x.outcome).toBe('HOLD');
    expect(x.flags.map((f) => f.code)).toContain('PIN_CITY_MISMATCH');
    expect(x.flags.find((f) => f.code === 'PIN_CITY_MISMATCH')!.message).toMatch(/belongs to Bengaluru/);
  });

  test('5. rented with blank size: hold', () => {
    const x = d(base, 'APP-006');
    expect(x.outcome).toBe('HOLD');
    expect(x.primaryReason).toBe('SPACE_SIZE_MISSING');
  });

  test('6. "Not yet identified" with a size: treated as no space, warning', () => {
    const x = d(base, 'APP-007');
    expect(x.outcome).toBe('HOLD');
    expect(x.primaryReason).toBe('SPACE_NOT_IDENTIFIED');
    expect(x.flags.find((f) => f.code === 'SPACE_SIZE_WITHOUT_SPACE')?.severity).toBe('WARNING');
    expect(x.application.spaceSqft).toBeNull();
    expect(x.provisionalRank).toBe(2);
    expect(x.summary).toMatch(/would rank #2 for 2 slots in TER-03/);
  });

  test('7. no space (hold), then "found a ground-floor space of 400 sq ft" flips it to approved', () => {
    expect(d(base, 'APP-012').outcome).toBe('HOLD');
    const after = run(withEvents([ev('update', 'APP-012', { spaceAvailable: 'Rented', spaceSize: 400, floor: 'Ground' })], base));
    expect(['APPROVED', 'APPROVED_WITH_CONDITIONS']).toContain(d(after, 'APP-012').outcome);
    expect(after.assertions.ok).toBe(true);
  });

  test('8. target launch of 1 month with no space: unrealistic flag plus hold', () => {
    const x = d(base, 'APP-008');
    expect(x.outcome).toBe('HOLD');
    expect(x.flags.map((f) => f.code)).toContain('LAUNCH_UNREALISTIC');
  });

  test('9. "before Diwali" with target 3 months: conflict flag, conditional approval', () => {
    const x = d(base, 'APP-009');
    expect(x.flags.map((f) => f.code)).toContain('NOTE_TIMELINE_CONFLICT');
    expect(x.outcome).toBe('APPROVED_WITH_CONDITIONS');
    expect(x.conditions[0].text).toMatch(/Diwali/);
  });

  test('10. Tier 3 applicant with Tier 1 money: checked against the Tier 3 minimum, high financial score', () => {
    const x = d(base, 'APP-010');
    expect(x.tier).toBe('Tier 3');
    expect(x.pillars!.financial.raw).toBe(100);
    expect(x.pillars!.financial.explanation).toMatch(/Tier 3 minimum of ₹12 lakh/);
  });

  test('11. capital shortfall 10% holds, 60% rejects', () => {
    const small = d(base, 'APP-011');
    const big = d(base, 'APP-013');
    expect(small.outcome).toBe('HOLD');
    expect(small.primaryReason).toBe('CAPITAL_SHORTFALL_SMALL');
    expect(small.summary).toMatch(/₹2 lakh/);
    expect(big.outcome).toBe('REJECTED');
    expect(big.primaryReason).toBe('CAPITAL_INSUFFICIENT');
  });

  test('12. territory with 0 open slots: waitlist with redirects (named cities first)', () => {
    const x = d(base, 'APP-014');
    expect(x.outcome).toBe('WAITLISTED');
    expect(x.primaryReason).toBe('NO_SLOTS');
    expect(x.redirects.length).toBeGreaterThan(0);
    expect(['Belagavi', 'Mysuru']).toContain(x.redirects[0].city);
    expect(x.redirects[0].projectedRank).not.toBeNull();
  });

  test('13. slots exceed free pins: capacity = free pins', () => {
    const t = base.territories.find((x) => x.id === 'TER-02')!;
    expect(t.openSlots).toBe(2);
    expect(t.freePinsAtStart).toEqual(['560078']);
    expect(t.realCapacity).toBe(1);
    expect(t.approved.length).toBe(1);
    expect(d(base, 'APP-017').outcome).toBe('WAITLISTED');
  });

  test('14. duplicate application ID and the same person under two IDs', () => {
    const dupId = d(base, 'APP-017#2');
    expect(dupId.outcome).toBe('HOLD');
    expect(dupId.primaryReason).toBe('DUPLICATE_ID');
    expect(d(base, 'APP-017').flags.map((f) => f.code)).not.toContain('DUPLICATE_ID');
    const kept = d(base, 'APP-018');
    const dup = d(base, 'APP-019');
    expect(kept.flags.map((f) => f.code)).not.toContain('DUPLICATE_APPLICANT');
    expect(dup.outcome).toBe('HOLD');
    expect(dup.primaryReason).toBe('DUPLICATE_APPLICANT');
    expect(dup.summary).toContain('APP-018');
  });

  test('15. zero experience + low-relevance business is below the bar; zero experience + relevant business gets approved', () => {
    const low = d(base, 'APP-020');
    expect(low.outcome).toBe('REJECTED');
    expect(low.primaryReason).toBe('SCORE_BELOW_BAR');
    expect(low.summary).toMatch(/operator capability/);
    expect(['APPROVED', 'APPROVED_WITH_CONDITIONS']).toContain(d(base, 'APP-024').outcome);
  });

  test('near miss is held with what would lift it', () => {
    const x = d(base, 'APP-021');
    expect(x.outcome).toBe('HOLD');
    expect(x.primaryReason).toBe('SCORE_NEAR_MISS');
    expect(x.whatWouldChange.length).toBeGreaterThan(0);
  });

  test('19. pins as 570001.0, with spaces, and as numbers are normalised', () => {
    expect(parsePin(570001.0).value).toBe('570001');
    expect(parsePin('570001.0').value).toBe('570001');
    expect(parsePin(' 560 010 ').value).toBe('560010');
    expect(parsePin('5600').error).toBeTruthy();
    expect(d(base, 'APP-006').pin).toBe('570001');
    expect(d(base, 'APP-002').pin).toBe('560010');
    expect(d(base, 'APP-015').pin).toBe('560078');
  });

  test('20. more applicants than slots: allocation never exceeds slots or reuses a pin', () => {
    const totalSlots = base.territories.reduce((n, t) => n + t.openSlots, 0);
    expect(base.decisions.length).toBeGreaterThan(totalSlots);
    for (const t of base.territories) expect(t.approved.length).toBeLessThanOrEqual(Math.min(t.openSlots, t.freePinsAtStart.length));
  });

  test('data quality: overlap, blank rows and messy values are reported, never thrown', () => {
    expect(base.dataIssues.some((i) => i.code === 'TERRITORY_OVERLAP' && i.message.includes('570002'))).toBe(true);
    expect(base.decisions.some((x) => x.rowNumber === 32)).toBe(false);
    expect(d(base, 'APP-028').outcome).toBe('HOLD');
    expect(d(base, 'APP-023').flags.map((f) => f.code)).toContain('NEGATIVE_OR_IMPOSSIBLE_VALUE');
    expect(d(base, 'APP-022').flags.map((f) => f.code)).toContain('STATE_NOT_KARNATAKA');
  });

  test('every decision has a trace, a summary and gate steps', () => {
    for (const x of base.decisions) {
      expect(x.summary.length).toBeGreaterThan(20);
      expect(x.trace.filter((t) => t.step === 'gate').length).toBe(7);
      expect(x.summary).not.toMatch(/[A-Z]{3,}_[A-Z_]{3,}/); // no reason codes in sentences
    }
  });

  test('applicant name never affects the score', () => {
    const input = sampleInput();
    input.applications = input.applications.map((a) => ({ ...a, applicantName: a.applicantName ? 'Someone Else' : a.applicantName }));
    const r = run(input);
    for (const x of base.decisions) if (!['APP-018', 'APP-019'].includes(x.key)) expect(d(r, x.key).score).toBe(x.score);
  });
});

describe('events, reservations and overrides', () => {
  test('16. withdrawal of an approved applicant promotes the top waitlisted one; diff shows both', () => {
    const after = run(withEvents([ev('withdraw', 'APP-001', {}, { reason: 'Family reasons' })], base));
    expect(d(after, 'APP-001').outcome).toBe('REJECTED');
    expect(d(after, 'APP-001').withdrawn).toBe(true);
    expect(d(after, 'APP-002').outcome).toBe('APPROVED');
    expect(d(after, 'APP-027').outcome).toBe('WAITLISTED');
    const diff = diffRuns(base, after);
    const keys = diff.filter((x) => x.outcomeFrom !== x.outcomeTo).map((x) => x.key);
    expect(keys).toEqual(expect.arrayContaining(['APP-001', 'APP-002']));
  });

  test('17. date advanced 35 days with no milestone: reservations expire and slots pass to the waitlist', () => {
    const after = run(withEvents([ev('dateAdvance', undefined, { days: 35 })], base));
    expect(after.asOf).toBe('2026-11-29');
    expect(d(after, 'APP-001').outcome).toBe('HOLD');
    expect(d(after, 'APP-001').primaryReason).toBe('RESERVATION_EXPIRED');
    expect(d(after, 'APP-002').outcome).toBe('APPROVED');
    expect(d(after, 'APP-002').reservation?.approvedOn).toBe('2026-11-29');
    expect(after.assertions.ok).toBe(true);
  });

  test('17b. a signed agreement keeps the reservation through a date advance', () => {
    const after = run(withEvents([ev('milestone', 'APP-001', { stage: 'agreement' }, { at: '2026-11-01' }), ev('dateAdvance', undefined, { days: 35 })], base));
    expect(d(after, 'APP-001').outcome).toBe('APPROVED');
    expect(d(after, 'APP-001').reservation?.status).toBe('Fulfilled');
  });

  test('missed deadline event releases the slot', () => {
    const after = run(withEvents([ev('reservationMissed', 'APP-015')], base));
    expect(d(after, 'APP-015').outcome).toBe('HOLD');
    expect(d(after, 'APP-017').outcome).toBe('APPROVED');
  });

  test('18. override that would break the pin rule is refused with a conflict explanation', () => {
    const storePin = run(withEvents([ev('override', 'APP-003', { outcome: 'APPROVED' }, { reason: 'Strong local operator', by: 'Asha' })], base));
    const x = d(storePin, 'APP-003');
    expect(x.outcome).toBe('REJECTED');
    expect(x.override?.status).toBe('refused');
    expect(x.override?.conflict).toMatch(/ST-02/);
    expect(storePin.assertions.ok).toBe(true);

    const taken = run(withEvents([ev('override', 'APP-002', { outcome: 'APPROVED' }, { reason: 'Better location fit', by: 'Asha' })], base));
    expect(d(taken, 'APP-002').outcome).toBe('WAITLISTED');
    expect(d(taken, 'APP-002').override?.conflict).toMatch(/APP-001/);
    expect(d(taken, 'APP-001').outcome).toBe('APPROVED');
  });

  test('18b. override with an explicit release swaps the approval and stays within the rules', () => {
    const r = run(withEvents([ev('override', 'APP-002', { outcome: 'APPROVED', releaseApplicationId: 'APP-001' }, { reason: 'Better location fit', by: 'Asha' })], base));
    expect(d(r, 'APP-002').outcome).toBe('APPROVED');
    expect(d(r, 'APP-002').override?.status).toBe('applied');
    expect(d(r, 'APP-002').engineOutcome).toBe('WAITLISTED');
    expect(d(r, 'APP-001').outcome).toBe('WAITLISTED');
    expect(d(r, 'APP-001').primaryReason).toBe('RELEASED_BY_OVERRIDE');
    expect(r.assertions.ok).toBe(true);
  });

  test('forced hold frees the slot for the next applicant; engine decision stays visible', () => {
    const r = run(withEvents([ev('override', 'APP-015', { outcome: 'HOLD' }, { reason: 'Background check pending', by: 'Ravi' })], base));
    expect(d(r, 'APP-015').outcome).toBe('HOLD');
    expect(d(r, 'APP-015').engineOutcome).toBe('APPROVED');
    expect(d(r, 'APP-017').outcome).toBe('APPROVED');
  });
});

describe('parsing and signals', () => {
  test('numbers with units and words', () => {
    expect(parseNumber('₹25 lakh', 'lakh').value).toBe(25);
    expect(parseNumber('1.2 crore', 'lakh').value).toBe(120);
    expect(parseNumber('1,200 sq ft', 'sqft').value).toBe(1200);
    expect(parseNumber('6 months', 'years').value).toBe(0.5);
    expect(parseNumber('twenty', 'lakh').error).toBeTruthy();
    expect(parseNumber('20-25', 'lakh').value).toBe(20);
  });

  test('signals from free text', () => {
    const cfg = configValues();
    const s = extractSignals('IT job', 'Will hire a manager; loan pending; open to Mysuru', cfg, TODAY);
    expect(s.relevance).toBe('low');
    expect(s.hiresManager).toBe(true);
    expect(s.loanPending).toBe(true);
    expect(s.preferredCities).toEqual(['Mysuru']);
    const f = extractSignals('Runs a footwear store', 'Wants to open before Diwali', cfg, TODAY);
    expect(f.relevance).toBe('high');
    expect(f.deadlineDate).toBe('2026-11-08');
  });
});

// ---------- Property-style tests: the three hard rules always hold ----------

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function randomInput(seed: number): EngineInput {
  const r = rng(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(r() * xs.length)];
  const cities = [
    ['Bengaluru', '560'],
    ['Mysuru', '570'],
    ['Belagavi', '590'],
    ['Tumakuru', '572'],
  ];
  const territories = Array.from({ length: 4 }, (_, i) => {
    const [city, prefix] = cities[i % 3];
    const pins = Array.from({ length: 2 + Math.floor(r() * 4) }, () => `${prefix}${String(Math.floor(r() * 40)).padStart(3, '0')}`);
    return { territoryId: `TER-${i + 1}`, city, state: 'Karnataka', pins: pins.join(', '), tier: pick(['Tier 1', 'Tier 2', 'Tier 3']), openSlots: Math.floor(r() * 4), priority: pick(['High', 'Medium', 'Low']) };
  });
  const applications = Array.from({ length: 20 + Math.floor(r() * 40) }, (_, i) => {
    const [city, prefix] = pick(cities);
    return {
      rowNumber: i + 4,
      applicationId: `APP-${String(1 + Math.floor(r() * 70)).padStart(3, '0')}`,
      applicantName: `Person ${Math.floor(r() * 30)}`,
      city: r() < 0.1 ? pick(cities)[0] : city,
      state: r() < 0.05 ? 'Goa' : 'Karnataka',
      pin: r() < 0.05 ? 'abc' : `${prefix}${String(Math.floor(r() * 40)).padStart(3, '0')}`,
      investment: r() < 0.05 ? '' : Math.round(r() * 70),
      experience: Math.floor(r() * 12),
      business: pick(['Runs a footwear store', 'IT job', 'Cafe owner', '', 'Kirana shop for 10 years']),
      spaceAvailable: pick(['Owned', 'Rented', 'Not yet identified', '']),
      spaceSize: r() < 0.2 ? '' : Math.round(100 + r() * 900),
      floor: pick(['Ground', 'Upper', 'Mall unit', 'Not known', '']),
      targetLaunch: Math.floor(r() * 14),
      language: pick(['Kannada', 'English', 'Hindi', '']),
      notes: pick(['', 'before Diwali', 'open to Mysuru', 'loan pending']),
    };
  });
  return { applications, territories, existingStores: undefined, events: [] };
}

describe('property: hard rules hold for random inputs, events and overrides', () => {
  test('random runs', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const input = randomInput(seed);
      const first = runEngine(input, config, TODAY, { shallow: seed % 2 === 0 });
      expect(first.assertions.violations, `seed ${seed}`).toEqual([]);
      const r = rng(seed * 7);
      const ids = first.decisions.map((x) => x.key);
      const events: EngineEvent[] = [];
      for (let i = 0; i < 8; i++) {
        const id = ids[Math.floor(r() * ids.length)];
        const kind = Math.floor(r() * 6);
        if (kind === 0) events.push(ev('withdraw', id));
        else if (kind === 1) events.push(ev('override', id, { outcome: 'APPROVED', releaseApplicationId: r() < 0.5 ? ids[Math.floor(r() * ids.length)] : undefined }, { reason: 'random override', by: 'test' }));
        else if (kind === 2) events.push(ev('override', id, { outcome: 'HOLD' }, { reason: 'random override', by: 'test' }));
        else if (kind === 3) events.push(ev('update', id, { spaceAvailable: 'Rented', spaceSize: 400, floor: 'Ground' }));
        else if (kind === 4) events.push(ev('dateAdvance', undefined, { days: 20 }));
        else events.push(ev('reservationMissed', id));
      }
      const second = runEngine({ ...input, events, priorApprovals: first.approvalDates }, config, TODAY, { shallow: true });
      expect(second.assertions.violations, `seed ${seed} after events`).toEqual([]);
    }
  });

  test('500 rows decide in a few seconds', () => {
    const input = randomInput(999);
    const big = { ...input, applications: Array.from({ length: 500 }, (_, i) => ({ ...input.applications[i % input.applications.length], applicationId: `APP-${i + 1}` })) };
    const t = Date.now();
    const r = runEngine(big, config, TODAY);
    expect(r.decisions.length).toBe(500);
    expect(Date.now() - t).toBeLessThan(5000);
  });
});

describe('post-decision layer', () => {
  test('every applicant gets a message in their language, with no reason codes or scores', () => {
    for (const x of base.decisions) {
      expect(x.message.text.length).toBeGreaterThan(50);
      expect(x.message.language).toBe(x.language);
      expect(x.message.text).not.toMatch(/[A-Z]{3,}_[A-Z_]{3,}/);
      if (x.score !== null) expect(x.message.text).not.toContain(String(x.score));
    }
    expect(d(base, 'APP-007').message.text).toMatch(/ಅಂಗಡಿ/); // Kannada
    expect(d(base, 'APP-002').message.text).toMatch(/प्रतीक्षा सूची/); // Hindi waitlist
  });

  test('approved partners get a dated onboarding plan, documents and readiness; others do not', () => {
    for (const x of base.decisions) {
      const approved = x.outcome === 'APPROVED' || x.outcome === 'APPROVED_WITH_CONDITIONS';
      expect(!!x.onboarding).toBe(approved);
      if (approved) {
        expect(x.onboarding!.steps.map((s) => s.stage)).toEqual(expect.arrayContaining(['Agreement and KYC', 'Fit-out and signage', 'Training', 'Grand opening']));
        expect(x.documents!.length).toBe(8);
        expect(x.readiness!.percent).toBe(0);
      }
    }
  });

  test('training depth follows experience; conditions appear as preconditions', () => {
    expect(d(base, 'APP-024').onboarding!.trainingTrack).toBe('Extended');
    expect(d(base, 'APP-026').onboarding!.trainingTrack).toBe('Compressed');
    expect(d(base, 'APP-009').onboarding!.preconditions.length).toBeGreaterThan(0);
  });

  test('drop-off risk flags loan and part-time commitment', () => {
    const r = d(base, 'APP-025').risk!;
    expect(r.level).toBe('High');
    expect(r.actions.join(' ')).toMatch(/loan/);
  });

  test('opening cannot be marked done while readiness is below 100%', () => {
    const after = run(withEvents([ev('checklist', 'APP-001', { kind: 'onboarding', item: 'opening', status: 'Done' })], base));
    expect(d(after, 'APP-001').onboarding!.steps.find((s) => s.id === 'opening')!.status).toBe('Blocked');
  });
});

describe('follow-up space without a size', () => {
  test('"found a ground-floor space" (no size) gives a conditional approval asking for the size, not a hold', () => {
    const after = run(withEvents([ev('update', 'APP-012', { spaceAvailable: 'Rented', floor: 'Ground' })], base));
    const x = d(after, 'APP-012');
    expect(x.outcome).toBe('APPROVED_WITH_CONDITIONS');
    expect(x.conditions.map((c) => c.code)).toContain('SPACE_SIZE_UNCONFIRMED');
    expect(x.conditions.find((c) => c.code === 'SPACE_SIZE_UNCONFIRMED')!.text).toMatch(/250 sq ft/);
    expect(x.message.text).toMatch(/250/);
    expect(after.assertions.ok).toBe(true);
  });
  test('then sending the size clears the condition', () => {
    const after = run(withEvents([ev('update', 'APP-012', { spaceAvailable: 'Rented', floor: 'Ground' }), ev('update', 'APP-012', { spaceSize: 400 })], base));
    expect(d(after, 'APP-012').outcome).toBe('APPROVED');
  });
  test('an uploaded row with Rented and a blank size is still held (case 5)', () => {
    expect(d(base, 'APP-006').outcome).toBe('HOLD');
    expect(d(base, 'APP-006').primaryReason).toBe('SPACE_SIZE_MISSING');
  });
});

describe('duplicate applicant detection', () => {
  const mk = (id: string, name: string) => ({ ...sampleInput().applications[0], rowNumber: 100, applicationId: id, applicantName: name, pin: '560103' });
  const runWith = (rows: ReturnType<typeof mk>[]) => run({ ...sampleInput(), applications: [...sampleInput().applications, ...rows] });
  test('names differing only by digits are different people', () => {
    const r = runWith([mk('APP-901', 'Person 1'), mk('APP-902', 'Person 321')]);
    expect(d(r, 'APP-901').flags.map((f) => f.code)).not.toContain('DUPLICATE_APPLICANT');
    expect(d(r, 'APP-902').flags.map((f) => f.code)).not.toContain('DUPLICATE_APPLICANT');
  });
  test('names in Kannada or Hindi script are compared properly', () => {
    const r = runWith([mk('APP-903', 'ರವಿ ಕುಮಾರ್'), mk('APP-904', 'ಸುಮಾ ಭಟ್'), mk('APP-905', 'रवि  कुमार'), mk('APP-906', 'रवि कुमार')]);
    expect(d(r, 'APP-903').flags.map((f) => f.code)).not.toContain('DUPLICATE_APPLICANT');
    expect(d(r, 'APP-904').flags.map((f) => f.code)).not.toContain('DUPLICATE_APPLICANT');
    const hindi = [d(r, 'APP-905'), d(r, 'APP-906')].filter((x) => x.flags.some((f) => f.code === 'DUPLICATE_APPLICANT'));
    expect(hindi.length).toBe(1); // same Hindi name + same pin, spacing ignored
  });
  test('same name with different spacing/punctuation is still caught', () => {
    const r = runWith([mk('APP-907', 'Ravi  K. Murthy'), mk('APP-908', 'ravi k murthy')]);
    expect([d(r, 'APP-907'), d(r, 'APP-908')].filter((x) => x.flags.some((f) => f.code === 'DUPLICATE_APPLICANT')).length).toBe(1);
  });
});
