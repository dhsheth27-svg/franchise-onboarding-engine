// The daily action queue for the expansion team ("Today"), ranked by value:
// 1 expiring deadlines, 2 holds closest to approval, 3 high-risk approvals, 4 redirectable
// waitlisted/rejected applicants, 5 high-priority territories to recruit in, 6 data to confirm.

import type { ConfigValues } from '../config';
import { rankOnceCleared } from './rank';
import { addDays, daysBetween, fmtDate } from './normalize';
import type { ActionItem, DataIssue, Decision, TerritorySummary } from './types';

export function buildActions(decisions: Decision[], territories: TerritorySummary[], dataIssues: DataIssue[], cfg: ConfigValues, asOf: string, done: Set<string>): ActionItem[] {
  const items: ActionItem[] = [];
  const messaged = new Set(decisions.filter((d) => d.message.sent?.current).map((d) => d.key));
  const push = (x: Omit<ActionItem, 'done' | 'priority'>, priority: number) =>
    items.push({ ...x, priority, done: done.has(x.id) || (!!x.applicationKey && (x.category === 'hold' || x.category === 'redirect') && messaged.has(x.applicationKey)) });
  const live = decisions.filter((d) => !d.withdrawn);

  // 1. Reservations and condition deadlines within the due-soon window
  for (const d of live) {
    if (d.reservation && d.reservation.status !== 'Fulfilled' && d.reservation.daysLeft <= cfg.dueSoonDays) {
      push(
        {
          id: `deadline:${d.key}`,
          category: 'deadline',
          who: 'Partner manager',
          what: `Close the agreement with ${d.applicationId} (${d.applicantName})`,
          why: `The slot reservation for pin ${d.reservation.pin} lapses in ${d.reservation.daysLeft} day(s); if it lapses the slot goes to the waitlist.`,
          deadline: d.reservation.deadline,
          applicationKey: d.key,
        },
        100 + d.reservation.daysLeft,
      );
    }
    for (const c of d.conditions) {
      const left = daysBetween(asOf, c.deadline);
      if (left <= cfg.dueSoonDays && d.reservation?.status !== 'Fulfilled')
        push(
          {
            id: `condition:${d.key}:${c.code}`,
            category: 'deadline',
            who: 'Partner manager',
            what: `Clear a condition with ${d.applicationId}: ${c.text.split(':')[0]}`,
            why: `${c.text} Due in ${left} day(s).`,
            deadline: c.deadline,
            applicationKey: d.key,
          },
          110 + left,
        );
    }
  }

  // 2. Holds closest to approval: send the info request
  const holds = live
    .filter((d) => d.outcome === 'HOLD' && d.score !== null && !['DUPLICATE_ID', 'DUPLICATE_APPLICANT'].includes(d.primaryReason))
    .sort((a, b) => (rankOnceCleared(a.provisionalRank, a.whatWouldChange) ?? 99) - (rankOnceCleared(b.provisionalRank, b.whatWouldChange) ?? 99) || (b.score ?? 0) - (a.score ?? 0));
  for (const d of holds) {
    const rank = rankOnceCleared(d.provisionalRank, d.whatWouldChange);
    const wouldGetSlot = !d.pinTakenBy && rank && d.territorySlots && rank <= d.territorySlots;
    push(
      {
        id: `hold:${d.key}`,
        category: 'hold',
        who: 'Expansion team',
        what: `Send ${d.applicationId} the info request (${d.language})`,
        why: `${d.oneLine}.${wouldGetSlot ? ` Would rank #${rank} for ${d.territorySlots} slot(s) in ${d.territoryId} once this is cleared.` : ''}${d.pinTakenBy ? ` Pin ${d.pin} is already taken by ${d.pinTakenBy}, so suggest another pin.` : ''}`,
        deadline: addDays(asOf, 2),
        applicationKey: d.key,
      },
      200 + (wouldGetSlot ? 0 : 50) + (rank ?? 40),
    );
  }

  // 3. High drop-off risk approvals and holds
  for (const d of live) {
    if (d.risk?.level !== 'High' || d.outcome === 'HOLD') continue;
    push(
      {
        id: `risk:${d.key}`,
        category: 'risk',
        who: 'Partner manager',
        what: `Call ${d.applicationId} (${d.applicantName}) this week`,
        why: `High drop-off risk: ${d.risk.reasons.join(' ')} Suggested: ${d.risk.actions.join('; ')}.`,
        deadline: addDays(asOf, 5),
        applicationKey: d.key,
      },
      300,
    );
  }

  // 4. Waitlisted / rejected applicants who could be redirected to free capacity
  for (const d of live) {
    if (!(d.outcome === 'WAITLISTED' || d.outcome === 'REJECTED') || !d.redirects.length) continue;
    const r = d.redirects[0];
    push(
      {
        id: `redirect:${d.key}`,
        category: 'redirect',
        who: 'Expansion team',
        what: `Offer ${d.applicationId} a slot in ${r.territoryId} (${r.city})`,
        why: `${d.oneLine}. ${r.sentence}`,
        deadline: addDays(asOf, 7),
        applicationKey: d.key,
      },
      400 - (d.score ?? 0) / 10,
    );
  }

  // 5. High-priority territories with unfilled slots and no qualified applicants in line
  for (const t of territories) {
    if (t.priority !== 'High' || t.unfilled <= 0) continue;
    const inLine = live.filter((d) => d.territoryId === t.id && (d.outcome === 'WAITLISTED' || (d.outcome === 'HOLD' && d.provisionalRank && d.provisionalRank <= t.openSlots))).length;
    const redirected = live.filter((d) => d.redirects.some((r) => r.territoryId === t.id)).length;
    if (inLine >= t.unfilled) continue;
    push(
      {
        id: `recruit:${t.id}`,
        category: 'recruit',
        who: 'Expansion lead',
        what: `Recruit partners in ${t.id} (${t.city})`,
        why: `High priority with ${t.unfilled} unfilled slot(s) and free pins ${t.freePinsNow.slice(0, 4).join(', ')}; ${inLine ? `only ${inLine} applicant(s) in line` : 'no qualified applicant in line'}${redirected ? `, ${redirected} redirect candidate(s) suggested` : ''}.`,
        deadline: null,
        territoryId: t.id,
      },
      500,
    );
  }

  // 6. Data to confirm
  for (const d of live) {
    const f = d.flags.find((x) => ['PIN_CITY_MISMATCH', 'DUPLICATE_ID', 'DUPLICATE_APPLICANT', 'NEGATIVE_OR_IMPOSSIBLE_VALUE', 'STATE_NOT_KARNATAKA'].includes(x.code));
    if (!f) continue;
    push(
      {
        id: `data:${d.key}:${f.code}`,
        category: 'data',
        who: 'Ops analyst',
        what: `Confirm ${d.applicationId}'s data`,
        why: f.message,
        deadline: addDays(asOf, 3),
        applicationKey: d.key,
      },
      600,
    );
  }
  for (const i of dataIssues.filter((x) => x.code === 'TERRITORY_OVERLAP' || x.code === 'NO_FREE_PINS')) {
    push({ id: `data:${i.ref}:${i.code}:${i.message.slice(4, 10)}`, category: 'data', who: 'Ops analyst', what: `Fix territory data for ${i.ref}`, why: i.message, deadline: null, territoryId: i.ref }, 650);
  }

  return items.sort((a, b) => Number(a.done) - Number(b.done) || a.priority - b.priority);
}

export function fmtDeadline(iso: string | null): string {
  return iso ? fmtDate(iso) : 'no deadline';
}
