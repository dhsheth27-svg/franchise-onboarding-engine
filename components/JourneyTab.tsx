'use client';

import { useMemo } from 'react';
import type { ChecklistStatus, Decision, PlanStep } from '@/lib/engine/types';
import { Empty, RiskLabel, fmtDate } from './ui';

// Journey columns, in order. A partner sits in the first column that still has an unfinished step.
const STAGES: { id: string; label: string; steps: string[] }[] = [
  { id: 'agreement', label: 'Agreement & KYC', steps: ['agreement'] },
  { id: 'site', label: 'Site', steps: ['space', 'site-visit', 'footfall', 'layout'] },
  { id: 'build', label: 'Fit-out & stock', steps: ['fitout', 'inventory'] },
  { id: 'people', label: 'People & training', steps: ['hiring', 'training', 'modules'] },
  { id: 'ready', label: 'Readiness', steps: ['readiness'] },
  { id: 'launch', label: 'Launch', steps: ['soft-launch', 'opening'] },
  { id: 'open', label: 'Open', steps: [] },
];

const days = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86400000);

interface Card {
  d: Decision;
  stage: (typeof STAGES)[number];
  pending: PlanStep[];
  due: string | null;
  overdue: number;
}

function place(d: Decision, asOf: string): Card {
  const steps = d.onboarding!.steps;
  for (const stage of STAGES) {
    const pending = steps.filter((s) => stage.steps.includes(s.id) && s.status !== 'Done');
    if (pending.length) {
      const due = pending.map((s) => s.dueDate).sort()[0];
      return { d, stage, pending, due, overdue: Math.max(0, days(due, asOf)) };
    }
  }
  return { d, stage: STAGES[STAGES.length - 1], pending: [], due: null, overdue: 0 };
}

export default function JourneyTab({
  decisions,
  asOf,
  onOpen,
  onAdvance,
  onTab,
  busy,
}: {
  decisions: Decision[];
  asOf: string;
  onOpen: (key: string) => void;
  onAdvance: (d: Decision, stepIds: string[], status: ChecklistStatus) => void;
  onTab: (tab: string) => void;
  busy: boolean;
}) {
  const cards = useMemo(() => decisions.filter((d) => d.onboarding && !d.withdrawn).map((d) => place(d, asOf)), [decisions, asOf]);
  const byStage = new Map(STAGES.map((s) => [s.id, cards.filter((c) => c.stage.id === s.id)]));
  const overdue = cards.filter((c) => c.overdue > 0);
  const bottleneck = [...STAGES.slice(0, -1)].sort((a, b) => (byStage.get(b.id)!.filter((c) => c.overdue).length - byStage.get(a.id)!.filter((c) => c.overdue).length) || (byStage.get(b.id)!.length - byStage.get(a.id)!.length))[0];
  const nextOpenings = cards
    .filter((c) => c.stage.id !== 'open')
    .map((c) => ({ d: c.d, date: c.d.onboarding!.earliestOpening }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3);
  const holds = decisions.filter((d) => d.outcome === 'HOLD' && !d.withdrawn).length;
  const waiting = decisions.filter((d) => d.outcome === 'WAITLISTED').length;

  if (!cards.length) return <Empty>No approved partners yet. Approvals appear here and move across the board as their onboarding steps are completed.</Empty>;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-3xl border border-slate-200 bg-surface/75 p-4 shadow-card backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">In onboarding</div>
          <div className="mt-2 text-3xl font-semibold italic text-ink">{cards.filter((c) => c.stage.id !== 'open').length}</div>
          <div className="text-xs text-slate-500">{byStage.get('open')!.length} open so far</div>
        </div>
        <div className={`rounded-3xl border p-4 shadow-card backdrop-blur-xl ${overdue.length ? 'border-rose-300 bg-rose-50' : 'border-slate-200 bg-surface/75'}`}>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Overdue</div>
          <div className={`mt-2 text-3xl font-semibold italic ${overdue.length ? 'text-rose-800' : 'text-ink'}`}>{overdue.length}</div>
          <div className="text-xs text-slate-500">partners behind plan</div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-surface/75 p-4 shadow-card backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Bottleneck</div>
          <div className="mt-2 text-lg font-semibold text-ink">{bottleneck.label}</div>
          <div className="text-xs text-slate-500">
            {byStage.get(bottleneck.id)!.length} partner(s){byStage.get(bottleneck.id)!.filter((c) => c.overdue).length ? `, ${byStage.get(bottleneck.id)!.filter((c) => c.overdue).length} overdue` : ''}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-surface/75 p-4 shadow-card backdrop-blur-xl">
          <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Next openings</div>
          <ul className="mt-2 space-y-0.5 text-sm">
            {nextOpenings.map((o) => (
              <li key={o.d.key} className="flex justify-between gap-2">
                <button onClick={() => onOpen(o.d.key)} className="font-mono text-slate-900 hover:text-brand-700">
                  {o.d.applicationId}
                </button>
                <span className="text-slate-600">{fmtDate(o.date)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="text-xs text-slate-500">
        Before approval: <button className="underline hover:text-brand-700" onClick={() => onTab('outbox')}>{holds} on hold waiting for information</button> and{' '}
        <button className="underline hover:text-brand-700" onClick={() => onTab('decisions')}>{waiting} on the waitlist</button>. Partners move right as their onboarding steps are marked done.
      </p>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {STAGES.map((stage, si) => {
          const list = byStage.get(stage.id)!;
          return (
            <section key={stage.id} className="flex w-64 flex-none flex-col rounded-3xl border border-slate-200 bg-slate-50/60 p-3 backdrop-blur-xl">
              <header className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{stage.label}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs tabular-nums ${list.length ? 'bg-brand-200 text-brand-900' : 'bg-slate-100 text-slate-500'}`}>{list.length}</span>
              </header>
              <ul className="flex-1 space-y-2">
                {list.length === 0 && <li className="rounded-2xl border border-dashed border-slate-300 px-3 py-4 text-center text-xs text-slate-500">Nobody here</li>}
                {list.map((c, i) => (
                  <li
                    key={c.d.key}
                    className={`group animate-fade-up rounded-2xl border bg-surface/90 p-3 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-lift ${c.overdue ? 'border-rose-300' : 'border-slate-200 hover:border-slate-300'}`}
                    style={{ animationDelay: `${si * 60 + i * 40}ms` }}
                  >
                    <button onClick={() => onOpen(c.d.key)} className="block w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-slate-900">{c.d.applicationId}</span>
                        {c.d.risk && <RiskLabel level={c.d.risk.level} />}
                      </div>
                      <div className="truncate text-xs text-slate-600">
                        {c.d.applicantName} · {c.d.city} · {c.d.pin}
                      </div>
                      {c.pending.length > 0 && <div className="mt-2 text-xs text-slate-700">Next: {c.pending.map((s) => s.stage).join(', ')}</div>}
                      {stage.id === 'agreement' && c.d.reservation && (
                        <div className={`mt-1 text-xs ${c.d.reservation.status === 'Due soon' ? 'text-amber-800' : 'text-slate-500'}`}>Slot held until {fmtDate(c.d.reservation.deadline)}</div>
                      )}
                      {stage.id === 'ready' && c.d.readiness && <div className="mt-1 text-xs text-slate-600">Readiness {c.d.readiness.percent}%</div>}
                      {c.due && (
                        <div className={`mt-1 text-xs ${c.overdue ? 'font-medium text-rose-700' : 'text-slate-500'}`}>{c.overdue ? `Overdue by ${c.overdue} day${c.overdue === 1 ? '' : 's'}` : `Due ${fmtDate(c.due)}`}</div>
                      )}
                      {stage.id === 'open' && <div className="mt-1 text-xs text-emerald-800">Opened</div>}
                    </button>
                    {c.pending.length > 0 && (
                      <button
                        disabled={busy}
                        onClick={() => onAdvance(c.d, c.pending.map((s) => s.id), 'Done')}
                        className="mt-2 w-full rounded-full py-1 text-xs font-medium text-slate-700 opacity-80 ring-1 ring-slate-300 transition hover:bg-brand-600 hover:text-white hover:opacity-100 hover:ring-brand-600 disabled:opacity-40"
                      >
                        Mark {stage.label.toLowerCase()} done →
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <p className="text-xs text-slate-500">The grand opening cannot be marked done until the readiness checklist is complete; it shows as Blocked until then.</p>
    </div>
  );
}
