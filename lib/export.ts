// Excel / CSV export of a run: decisions with reasons and summaries, messages, territories,
// onboarding plans, action queue, data quality and the assumptions in use.

import { config, HARD_RULES } from './config';
import type { RunResult } from './engine/types';
import { XLSX } from './excel';

const OUT: Record<string, string> = { APPROVED: 'Approved', APPROVED_WITH_CONDITIONS: 'Approved with conditions', HOLD: 'On hold', WAITLISTED: 'Waitlisted', REJECTED: 'Rejected' };

function decisionRows(r: RunResult) {
  return r.decisions.map((d) => ({
    'Application ID': d.applicationId,
    'Applicant name': d.applicantName,
    City: d.city ?? '',
    'Pin code': d.pin ?? '',
    Territory: d.territoryId ?? 'Outside territories',
    Outcome: d.withdrawn ? 'Withdrawn' : OUT[d.outcome],
    'Engine outcome': OUT[d.engineOutcome],
    Override: d.override ? `${d.override.status === 'applied' ? 'Applied' : 'Refused'} by ${d.override.by}: ${d.override.reason}` : '',
    Score: d.score ?? '',
    'Provisional score': d.provisionalScore ? 'Yes' : '',
    Confidence: d.confidence,
    'Drop-off risk': d.risk?.level ?? '',
    'Rank / position': d.slotRank ? `Slot #${d.slotRank} of ${d.territorySlots}` : d.provisionalRank ? `Would rank #${d.provisionalRank} of ${d.territorySlots}` : d.waitlistPosition ? `Waitlist #${d.waitlistPosition}` : '',
    'Main reason': d.oneLine,
    Summary: d.summary,
    'What would change it': d.whatWouldChange.map((c) => c.sentence).join(' '),
    Redirects: d.redirects.map((x) => x.sentence).join(' '),
    Conditions: d.conditions.map((c) => `${c.text} (by ${c.deadline})`).join(' '),
    'Reservation until': d.reservation?.deadline ?? '',
    'Reason codes': d.reasons.join(', '),
    'Est. payback (months, illustrative)': d.estimatedPaybackMonths ?? '',
  }));
}

export function exportCsv(r: RunResult): string {
  const ws = XLSX.utils.json_to_sheet(decisionRows(r));
  return XLSX.utils.sheet_to_csv(ws);
}

export function exportWorkbook(r: RunResult): Buffer {
  const wb = XLSX.utils.book_new();
  const add = (name: string, rows: Record<string, unknown>[], widths?: number[]) => {
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Note: 'Nothing to show' }]);
    if (widths) ws['!cols'] = widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, name);
  };
  add('Decisions', decisionRows(r), [12, 18, 14, 9, 11, 22, 22, 30, 7, 8, 10, 10, 18, 40, 80, 60, 60, 50, 12, 30, 12]);
  add(
    'Messages',
    r.decisions.map((d) => ({ 'Application ID': d.applicationId, Name: d.applicantName, Language: d.message.language, Message: d.message.text, 'English version': d.message.english })),
    [12, 18, 10, 80, 80],
  );
  add(
    'Territories',
    r.territories.map((t) => ({
      Territory: t.id,
      City: t.city,
      Tier: t.tier,
      Priority: t.priority,
      'Open slots': t.openSlots,
      'Free pins at start': t.freePinsAtStart.join(', '),
      'Real capacity': t.realCapacity,
      Approved: t.approved.join(', '),
      Waitlisted: t.waitlisted.join(', '),
      'On hold': t.held.join(', '),
      'Slots left': t.slotsLeft,
      'Free pins now': t.freePinsNow.join(', '),
      Issues: t.issues.join(' '),
    })),
  );
  add(
    'Onboarding plans',
    r.decisions.flatMap((d) =>
      (d.onboarding?.steps ?? []).map((s) => ({
        'Application ID': d.applicationId,
        Training: `${d.onboarding!.trainingTrack} (${d.onboarding!.trainingLanguage})`,
        Stage: s.stage,
        Owner: s.owner,
        Weeks: `${s.startWeek}-${s.endWeek}`,
        Due: s.dueDate,
        Status: s.status,
        Detail: s.detail,
        'Added because': s.added ?? '',
        'Earliest opening': d.onboarding!.earliestOpening,
      })),
    ),
    [12, 22, 32, 9, 8, 11, 12, 70, 40, 12],
  );
  add(
    'Action queue',
    r.actions.map((a, i) => ({ '#': i + 1, Category: a.category, Who: a.who, What: a.what, Why: a.why, Deadline: a.deadline ?? '', Done: a.done ? 'Yes' : '' })),
    [4, 10, 16, 45, 90, 12, 6],
  );
  add(
    'Data quality',
    [
      ...r.dataIssues.map((i) => ({ Scope: i.scope, Reference: i.ref, Code: i.code, Severity: i.severity, Detail: i.message })),
      ...r.decisions.flatMap((d) => d.cleaning.map((c) => ({ Scope: 'cleaning', Reference: d.applicationId, Code: c.field, Severity: 'INFO', Detail: c.note }))),
    ],
    [12, 12, 26, 10, 100],
  );
  add(
    'Assumptions',
    [
      ...HARD_RULES.map((h, i) => ({ Setting: `Hard rule ${i + 1}`, Value: h, Rationale: 'Never breakable, not even by an override.' })),
      ...Object.values(config).map((a) => ({ Setting: a.label, Value: JSON.stringify(a.value), Rationale: a.rationale })),
    ],
    [36, 60, 100],
  );
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
