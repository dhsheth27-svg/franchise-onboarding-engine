// Layer 5: post-decision outputs per applicant: gap-based onboarding plan, documents, readiness
// check, drop-off risk and the applicant message. Statuses come from checklist events.

import { isApproved, type CoreResult, type Work } from './decide';
import { buildMessage } from './messages';
import { addDays, daysBetween, fmtDate, fmtNum } from './normalize';
import { hasSpace } from './score';
import type { ChecklistItem, ChecklistStatus, Counterfactual, Decision, OnboardingPlan, PlanStep, Redirect, Risk } from './types';

type Post = Pick<Decision, 'onboarding' | 'documents' | 'readiness' | 'risk' | 'message'>;

export function buildPost(w: Work, core: CoreResult, redirects: Redirect[], whatWouldChange: Counterfactual[]): Post {
  const checks = core.events.checklist.get(w.app.key) ?? {};
  const status = (id: string): ChecklistStatus => (checks[id]?.status as ChecklistStatus) ?? 'Not started';
  const approved = isApproved(w.outcome) && !w.withdrawn;

  let documents: ChecklistItem[] | undefined;
  let readiness: Decision['readiness'];
  let onboarding: OnboardingPlan | null = null;
  if (approved) {
    documents = buildDocuments(w, status);
    readiness = buildReadiness(status);
    onboarding = buildPlan(w, core, status, readiness.percent);
  }
  const risk = w.outcome === 'HOLD' || approved ? buildRisk(w, core, documents) : undefined;
  const message = buildMessage({ w, cfg: core.cfg, asOf: core.asOf, redirects, whatWouldChange });
  return { onboarding, documents, readiness, risk, message };
}

function buildDocuments(w: Work, status: (id: string) => ChecklistStatus): ChecklistItem[] {
  const docs: [string, string][] = [
    ['doc-id', 'ID proof (Aadhaar / passport / voter ID)'],
    ['doc-address', 'Address proof'],
    ['doc-pan', 'PAN card'],
    ['doc-space', w.app.space === 'Owned' ? 'Space proof: ownership document' : 'Space proof: rental agreement'],
    ['doc-bank', 'Bank account details (cancelled cheque)'],
    ['doc-gst', 'GST registration'],
    ['doc-shop', 'Shop & establishment registration'],
    ['doc-trade', 'Trade licence'],
  ];
  return docs.map(([id, label]) => ({ id, label, status: status(id) }));
}

const READINESS: [string, string][] = [
  ['ready-training', 'Training completed and certified'],
  ['ready-staff', 'Staff hired and trained'],
  ['ready-inventory', 'Opening inventory received'],
  ['ready-pos', 'Billing / POS working'],
  ['ready-signage', 'Signage and brand standards verified'],
  ['ready-opening', 'Opening-day plan agreed'],
];

function buildReadiness(status: (id: string) => ChecklistStatus): NonNullable<Decision['readiness']> {
  const items = READINESS.map(([id, label]) => ({ id, label, status: status(id) }));
  const percent = Math.round((items.filter((i) => i.status === 'Done').length / items.length) * 100);
  return { items, percent, readyToOpen: percent === 100 };
}

function buildPlan(w: Work, core: CoreResult, status: (id: string) => ChecklistStatus, readinessPct: number): OnboardingPlan {
  const cfg = core.cfg;
  const W = cfg.onboardingWeeks;
  const a = w.app;
  const approvedOn = w.reservation?.approvedOn ?? core.asOf;
  const exp = a.experienceYears ?? 0;
  const track: OnboardingPlan['trainingTrack'] = exp < 2 ? 'Extended' : exp >= 5 ? 'Compressed' : 'Standard';
  const trainWeeks = cfg.trainingWeeks[track];
  const steps: PlanStep[] = [];
  const milestones = core.events.milestones.get(a.key) ?? [];
  const add = (id: string, stage: string, detail: string, owner: PlanStep['owner'], start: number, end: number, added?: string) => {
    let st = status(id);
    if (id === 'agreement' && milestones.some((m) => m.stage === 'agreement')) st = 'Done';
    steps.push({ id, stage, detail, owner, startWeek: start, endWeek: end, dueDate: addDays(approvedOn, end * 7), status: st, added });
  };

  add('agreement', 'Agreement and KYC', `Sign the franchise agreement, complete KYC and collect documents.${w.conditions.length ? ' Conditions must be cleared first.' : ''}`, 'Both', 0, W.agreement);
  add('space', 'Space verification and approval', `Brand team visits ${a.space === 'Owned' ? 'the owned' : 'the rented'} space (${fmtNum(a.spaceSqft ?? 0)} sq ft, ${a.floor ?? 'floor not known'}) and approves the layout.`, 'Brand', 1, 1 + W.spaceVerification);
  let prep = 1 + W.spaceVerification;
  if (!a.floor || a.floor === 'Not known') {
    add('site-visit', 'Site visit to confirm the floor', 'Floor was not stated: confirm access, visibility and frontage on site.', 'Brand', 1, 2, 'the floor of the space is not known');
  }
  if (a.floor === 'Upper') {
    add('footfall', 'Footfall and signage review', 'Upper-floor space: check walk-in visibility, staircase access and plan extra street-level signage.', 'Brand', 2, 3, 'the space is on an upper floor');
    prep = Math.max(prep, 3);
  }
  if (w.tier && a.spaceSqft !== null && a.spaceSqft < cfg.idealSpaceSqft[w.tier][0]) {
    add('layout', 'Compact layout review', `${fmtNum(a.spaceSqft)} sq ft is near the ${cfg.minSpaceSqft[w.tier]} sq ft minimum: design a compact layout and fixture plan.`, 'Brand', 2, 3, 'the space is close to the minimum size');
    prep = Math.max(prep, 3);
  }
  const fitStart = prep;
  const fitEnd = fitStart + W.fitOut;
  add('fitout', 'Fit-out and signage', 'Interiors, fixtures, lighting and brand signage to the standard design.', 'Partner', fitStart, fitEnd);
  const hireStart = fitStart + 1;
  add('hiring', 'Staff hiring', 'Hire the store team (typically 2–4 people).', 'Partner', hireStart, hireStart + W.staffHiring);
  const invStart = fitEnd - 1;
  add('inventory', 'Inventory and billing system setup', 'Opening stock order, POS / billing installation and test transactions.', 'Both', invStart, invStart + W.inventorySetup);
  const trainStart = hireStart + 1;
  const trainEnd = trainStart + trainWeeks;
  const trainDetail = {
    Extended: `Extended programme (${trainWeeks} weeks) in ${a.language}: store operations from the ground up, an assigned operations mentor, and supervised pilot weeks at an existing store.`,
    Standard: `Standard programme (${trainWeeks} weeks) in ${a.language}: brand processes, product range, POS and customer service.`,
    Compressed: `Compressed programme (${trainWeeks} week) in ${a.language}: brand processes and systems only, building on ${fmtNum(exp)} years of retail experience.`,
  }[track];
  add('training', 'Training', trainDetail, 'Both', trainStart, trainEnd, exp < 2 ? `the partner has ${fmtNum(exp)} year(s) of retail experience` : undefined);
  if (a.signals.relevance === 'low' || a.signals.relevance === 'unknown') {
    add('modules', 'Product knowledge and customer handling', `Extra modules in ${a.language} because the partner's background (${a.signals.businessCategory}) is outside retail.`, 'Brand', trainStart, trainStart + 2, 'the business background has low retail relevance');
  }
  const readyStart = Math.max(fitEnd, invStart + W.inventorySetup, trainEnd);
  add('readiness', 'Readiness check', 'All readiness items ticked: training certified, staff, stock, POS, signage, opening-day plan.', 'Brand', readyStart, readyStart + W.readinessCheck);
  const softWeeks = track === 'Extended' ? 2 : W.softLaunch;
  const softStart = readyStart + W.readinessCheck;
  add('soft-launch', 'Soft launch', track === 'Extended' ? 'Two supervised pilot weeks with the operations mentor on site.' : 'One week of trading before the public opening.', 'Both', softStart, softStart + softWeeks);
  const openWeek = softStart + softWeeks;
  add('opening', 'Grand opening', 'Public opening with local promotion.', 'Both', openWeek, openWeek);
  const opening = steps[steps.length - 1];
  if (opening.status === 'Done' && readinessPct < 100) {
    opening.status = 'Blocked';
    opening.detail += ` Cannot be marked done: readiness is ${readinessPct}%.`;
  }

  const earliestOpening = addDays(approvedOn, openWeek * 7);
  const targetOpening = addDays(approvedOn, Math.round(a.effectiveLaunchMonths * cfg.monthDays));
  const gapDays = daysBetween(targetOpening, earliestOpening);
  const timelineNote =
    gapDays > 7
      ? `The earliest realistic opening is ${fmtDate(earliestOpening)}, about ${Math.round(gapDays / 7)} weeks after the applicant's target of ${fmtDate(targetOpening)}: ${W.agreement} weeks of agreement and KYC, ${W.fitOut} weeks of fit-out and ${trainWeeks} week(s) of ${track.toLowerCase()} training cannot be compressed further. Agree the realistic date now.`
      : `On track: the plan reaches opening by ${fmtDate(earliestOpening)}, within the applicant's target of ${fmtDate(targetOpening)}.`;

  return {
    trainingTrack: track,
    trainingLanguage: a.language,
    steps,
    preconditions: w.conditions,
    earliestOpening,
    targetOpening,
    timelineNote,
    weeksToOpen: openWeek,
  };
}

function buildRisk(w: Work, core: CoreResult, documents?: ChecklistItem[]): Risk {
  const cfg = core.cfg;
  const a = w.app;
  const reasons: string[] = [];
  const actions: string[] = [];
  let pts = 0;
  const add = (n: number, reason: string, action?: string) => {
    pts += n;
    reasons.push(reason);
    if (action && !actions.includes(action)) actions.push(action);
  };
  if (!hasSpace(a)) add(2, 'No shop space identified yet.', 'help shortlist spaces in the pin');
  if (a.signals.loanPending) add(2, 'Part of the investment depends on a pending loan.', 'confirm loan status with the bank');
  if (a.signals.commitment === 'partial' || a.signals.hiresManager) add(1, a.signals.hiresManager ? 'Plans to hire a manager rather than run the store.' : 'Running it part-time or as a side business.', 'call this week to confirm commitment');
  if (a.effectiveLaunchMonths > cfg.riskThresholds.longGapMonths) add(1, `Target launch is ${a.effectiveLaunchMonths} months away (over ${cfg.riskThresholds.longGapMonths}).`, 'agree an earlier opening date or release the slot');
  if (a.flags.some((f) => f.code === 'NOTE_TIMELINE_CONFLICT' || f.code === 'LAUNCH_UNREALISTIC')) add(2, 'Expected opening date conflicts with a realistic timeline.', 'agree a realistic opening date');
  if (w.confidence === 'Low') add(1, 'Application data is thin or contradictory.', 'verify the application details by phone');
  if (w.sr && w.sr.investmentRatio < cfg.riskThresholds.thinCapitalRatio) add(1, `Capital is within ${Math.round((cfg.riskThresholds.thinCapitalRatio - 1) * 100)}% of the minimum, leaving no buffer for overruns.`, 'discuss a contingency fund');
  if (w.reservation && w.reservation.status === 'Due soon') add(2, `Reservation deadline in ${w.reservation.daysLeft} days (${fmtDate(w.reservation.deadline)}) and the agreement is not signed.`, 'call this week to close the agreement');
  if (documents && w.reservation && w.reservation.status !== 'Fulfilled' && w.reservation.daysLeft <= 14 && !documents.some((d) => d.status === 'Done'))
    add(1, 'No documents received yet with the reservation deadline two weeks away.', 'chase documents');
  const level: Risk['level'] = pts >= 3 ? 'High' : pts >= 2 ? 'Medium' : 'Low';
  return { level, reasons, actions };
}
