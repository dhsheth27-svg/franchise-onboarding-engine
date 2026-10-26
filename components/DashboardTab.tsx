'use client';

import { useMemo, type ReactNode } from 'react';
import type { Config } from '@/lib/config';
import type { EngineEvent, Outcome, RunResult } from '@/lib/engine/types';
import { computeInsights, monthLabel } from '@/lib/insights';
import { IconArrow } from './icons';
import { CountUp, GrowBar, OUTCOME_DOT, OUTCOME_LABEL, fmtDate } from './ui';

function Tile({ title, children, className = '', delay = 0, action }: { title: string; children: ReactNode; className?: string; delay?: number; action?: ReactNode }) {
  return (
    <section
      className={`group animate-fade-up rounded-3xl border border-slate-200 bg-surface/75 p-5 shadow-card backdrop-blur-xl transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function Kpi({ label, value, of, accent, delay, sub }: { label: string; value: number; of?: number; accent?: boolean; delay: number; sub?: string }) {
  return (
    <div
      className={`animate-fade-up rounded-3xl border p-5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-lift ${accent ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-surface/75 backdrop-blur-xl hover:border-slate-300'}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent ? 'text-white/80' : 'text-slate-500'}`}>{label}</div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className={`text-4xl font-display tracking-tight sm:text-5xl ${accent ? 'text-white' : 'text-ink'}`}>
          <CountUp value={value} />
        </span>
        {of !== undefined && <span className={`text-lg ${accent ? 'text-white/70' : 'text-slate-500'}`}>/ {of}</span>}
      </div>
      {sub && <div className={`mt-1 text-xs ${accent ? 'text-white/80' : 'text-slate-500'}`}>{sub}</div>}
    </div>
  );
}

const OUTCOMES: Outcome[] = ['APPROVED', 'APPROVED_WITH_CONDITIONS', 'HOLD', 'WAITLISTED', 'REJECTED'];

export default function DashboardTab({
  result,
  config,
  events,
  onOpen,
  onTab,
}: {
  result: RunResult;
  config: Config;
  events: EngineEvent[];
  onOpen: (key: string) => void;
  onTab: (tab: string) => void;
}) {
  const ins = useMemo(() => computeInsights(result, config, events), [result, config, events]);
  const r = result;
  const total = r.decisions.length || 1;
  const approved = r.counts.APPROVED + r.counts.APPROVED_WITH_CONDITIONS;
  const capacity = r.territories.reduce((n, t) => n + t.realCapacity, 0);
  const openActions = r.actions.filter((a) => !a.done);
  const risks = { High: 0, Medium: 0, Low: 0 };
  for (const d of r.decisions) if (d.risk) risks[d.risk.level]++;
  const maxOpen = Math.max(1, ...ins.openings.map((o) => o.n));
  const langTotals = { Kannada: 0, English: 0, Hindi: 0 } as Record<string, number>;
  for (const t of ins.trainingLoad) for (const [l, n] of Object.entries(t.byLanguage)) langTotals[l] = (langTotals[l] ?? 0) + n;
  const maxLang = Math.max(1, ...Object.values(langTotals));

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Applications decided" value={r.decisions.length} delay={0} sub="in this run" />
        <Kpi label="Slots filled" value={approved} of={capacity} delay={60} sub="usable slots (free pins)" />
        <Kpi label="Open actions" value={openActions.length} accent delay={120} sub="for the team today" />
        <Kpi label="Info requests to send" value={ins.impact.holds} delay={180} sub="holds with a ready message" />
      </div>

      <ImpactStrip result={r} />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        {/* Outcome mix */}
        <Tile title="Outcome mix" className="lg:col-span-2" delay={220} action={<button onClick={() => onTab('decisions')} className="text-xs text-slate-500 transition hover:text-brand-700">All decisions →</button>}>
          <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Outcome mix">
            {OUTCOMES.map((o, i) =>
              r.counts[o] ? (
                <span
                  key={o}
                  title={`${OUTCOME_LABEL[o]}: ${r.counts[o]}`}
                  className={`h-full origin-left animate-grow-x border-r-2 border-surface transition-opacity last:border-r-0 hover:opacity-80 ${OUTCOME_DOT[o]}`}
                  style={{ width: `${(r.counts[o] / total) * 100}%`, animationDelay: `${300 + i * 80}ms` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5 [&>*]:min-w-0">
            {OUTCOMES.map((o) => (
              <li key={o}>
                <button onClick={() => onTab('decisions')} className="w-full rounded-2xl p-2 text-left transition hover:bg-slate-100">
                  <div className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${OUTCOME_DOT[o]}`} />
                    {OUTCOME_LABEL[o]}
                  </div>
                  <div className="mt-1 text-2xl font-semibold tabular-nums text-ink">{r.counts[o]}</div>
                  <div className="text-xs text-slate-500">{Math.round((r.counts[o] / total) * 100)}%</div>
                </button>
              </li>
            ))}
          </ul>
        </Tile>

        {/* Funnel */}
        <Tile title="Funnel" delay={280}>
          <ul className="space-y-3">
            {ins.funnel.map((f, i) => (
              <li key={f.label} title={`${f.label}: ${f.n}`}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{f.label}</span>
                  <span className="tabular-nums text-slate-900">{f.n}</span>
                </div>
                <GrowBar pct={(f.n / (ins.funnel[0].n || 1)) * 100} className={i === ins.funnel.length - 1 ? 'bg-brand-600' : 'bg-slate-600'} delay={350 + i * 70} />
              </li>
            ))}
          </ul>
        </Tile>

        {/* Territory capacity */}
        <Tile title="Territory capacity" className="lg:col-span-2" delay={340} action={<button onClick={() => onTab('territories')} className="text-xs text-slate-500 transition hover:text-brand-700">Territories →</button>}>
          <ul className="space-y-3">
            {r.territories.map((t, i) => (
              <li key={t.id} className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-3 rounded-xl px-1 py-0.5 transition hover:bg-slate-100" title={`${t.id}: ${t.approved.length} approved of ${t.realCapacity} usable slots; ${t.waitlisted.length} waitlisted`}>
                <div>
                  <div className="text-sm font-medium text-slate-900">{t.id}</div>
                  <div className="text-xs text-slate-500">
                    {t.city} · {t.priority}
                  </div>
                </div>
                <GrowBar pct={t.realCapacity ? (t.approved.length / t.realCapacity) * 100 : 0} className={t.priority === 'High' && t.unfilled > 0 ? 'bg-brand-600' : 'bg-slate-600'} delay={400 + i * 60} height="h-2.5" />
                <div className="w-24 text-right text-xs tabular-nums text-slate-600">
                  <span className="text-sm text-slate-900">{t.approved.length}</span> / {t.realCapacity}
                  {t.waitlisted.length > 0 && <span className="block text-xs text-slate-500">+{t.waitlisted.length} waiting</span>}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Violet bars: high-priority territories that still have empty slots.</p>
        </Tile>

        {/* Top actions */}
        <Tile title="Top actions today" delay={400} action={<button onClick={() => onTab('today')} className="text-xs text-slate-500 transition hover:text-brand-700">All →</button>}>
          {openActions.length ? (
            <ol className="space-y-2">
              {openActions.slice(0, 5).map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={() => (a.applicationKey ? onOpen(a.applicationKey) : onTab('today'))}
                    className="group/item flex w-full items-start gap-3 rounded-2xl border border-transparent p-2 text-left transition hover:border-slate-200 hover:bg-slate-100"
                  >
                    <span className="mt-0.5 font-mono text-xs text-brand-700">0{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-slate-900">{a.what}</span>
                      <span className="block truncate text-xs text-slate-500">{a.deadline ? `By ${fmtDate(a.deadline)}` : a.who}</span>
                    </span>
                    <span className="mt-1 text-slate-500 transition group-hover/item:translate-x-0.5 group-hover/item:text-brand-700">
                      <IconArrow />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-500">Nothing open.</p>
          )}
        </Tile>

        {/* Openings */}
        <Tile title="Expected openings" delay={460}>
          {ins.openings.length ? (
            <div className="flex h-36 items-end justify-center gap-3">
              {ins.openings.map((o, i) => (
                <div key={o.month} className="flex w-full max-w-[72px] flex-1 flex-col items-center gap-1.5" title={`${monthLabel(o.month)}: ${o.n}`}>
                  <span className="text-xs tabular-nums text-slate-700">{o.n}</span>
                  <span className="w-full animate-fade-up rounded-xl bg-brand-600 transition hover:bg-brand-500" style={{ height: `${(o.n / maxOpen) * 96}px`, animationDelay: `${520 + i * 80}ms` }} />
                  <span className="text-[11px] uppercase tracking-wide text-slate-500">{monthLabel(o.month).split(' ')[0]}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No approved partners yet.</p>
          )}
        </Tile>

        {/* Training load */}
        <Tile title="Training load by language" delay={520}>
          <ul className="space-y-3">
            {Object.entries(langTotals).map(([l, n], i) => (
              <li key={l} title={`${l}: ${n} partner(s)`}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-700">{l}</span>
                  <span className="tabular-nums text-slate-900">{n}</span>
                </div>
                <GrowBar pct={(n / maxLang) * 100} className="bg-slate-600" delay={580 + i * 70} />
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-slate-500">Trainers needed per language for approved partners.</p>
        </Tile>

        {/* Risk */}
        <Tile title="Drop-off risk" delay={580}>
          <div className="grid grid-cols-3 gap-2">
            {(['High', 'Medium', 'Low'] as const).map((lvl) => (
              <div key={lvl} className={`rounded-2xl border p-3 transition ${lvl === 'High' ? 'border-rose-300 bg-rose-50' : lvl === 'Medium' ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
                <div className={`text-2xl font-semibold tabular-nums ${lvl === 'High' ? 'text-rose-800' : lvl === 'Medium' ? 'text-amber-800' : 'text-slate-900'}`}>
                  <CountUp value={risks[lvl]} />
                </div>
                <div className="text-xs uppercase tracking-wide text-slate-500">{lvl}</div>
              </div>
            ))}
          </div>
          <ul className="mt-3 space-y-1">
            {r.decisions
              .filter((d) => d.risk?.level === 'High')
              .slice(0, 3)
              .map((d) => (
                <li key={d.key}>
                  <button onClick={() => onOpen(d.key)} className="w-full truncate rounded-lg px-1 py-0.5 text-left text-xs text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
                    <span className="font-mono text-slate-900">{d.applicationId}</span> · {d.risk!.reasons[0]}
                  </button>
                </li>
              ))}
          </ul>
        </Tile>
      </div>

      {ins.concentrationWarning && <p className="animate-fade-up rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">⚠ {ins.concentrationWarning}</p>}
    </div>
  );
}

/** "Without vs with" strip: what this run did that a manual process usually does not. Every number is counted from the run. */
function ImpactStrip({ result }: { result: RunResult }) {
  const ds = result.decisions.filter((d) => !d.withdrawn);
  const holds = ds.filter((d) => d.outcome === 'HOLD').length;
  const redirected = ds.filter((d) => (d.outcome === 'WAITLISTED' || d.outcome === 'REJECTED') && d.redirects.length).length;
  const reserved = ds.filter((d) => d.reservation && d.reservation.status !== 'Expired').length;
  const plans = ds.filter((d) => d.onboarding).length;
  const caught = ds.reduce((n, d) => n + d.flags.filter((f) => f.severity !== 'INFO').length, 0) + result.dataIssues.filter((i) => i.scope !== 'application' && i.severity !== 'INFO').length;
  const langs = new Set(ds.map((d) => d.language)).size;
  const items = [
    { n: ds.length, label: 'applications decided with reasons', usually: 'reviewed one by one, often over days', now: `each with a traceable reason, in ${result.durationMs < 1000 ? 'under a second' : `${(result.durationMs / 1000).toFixed(1)} s`}` },
    { n: holds, label: 'holds with a specific ask', usually: '"on hold" with no clear ask, and applicants drift away', now: `exactly what is missing, a deadline, and a message in ${langs} language${langs === 1 ? '' : 's'}` },
    { n: redirected, label: 'strong applicants redirected', usually: 'rejected or left waiting when their pin was taken', now: 'offered a free slot elsewhere, with where they would rank' },
    { n: reserved, label: 'slots protected by reservations', usually: 'approved partners stall and block slots for months', now: '30-day reservations; lapsed slots pass to the waitlist automatically' },
    { n: plans, label: 'dated onboarding plans', usually: 'partners open unprepared', now: 'training matched to experience, documents and a readiness check before opening' },
    { n: caught, label: 'data problems caught', usually: 'contradictions slip through to the agreement stage', now: 'flagged up front: pin/city mismatches, missing sizes, duplicates, timeline conflicts' },
  ];
  return (
    <section className="animate-fade-up rounded-3xl border border-slate-200 bg-surface/75 p-5 shadow-card backdrop-blur-xl" style={{ animationDelay: '200ms' }}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Impact on this run · without vs with Opsmith</h3>
        <span className="text-xs text-slate-500">Every number is counted from this run</span>
      </div>
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((it, i) => (
          <li key={it.label} className="group rounded-2xl border border-slate-200 bg-canvas/40 p-4 transition duration-300 hover:-translate-y-0.5 hover:border-brand-400" style={{ animationDelay: `${260 + i * 60}ms` }}>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-display text-ink">
                <CountUp value={it.n} />
              </span>
              <span className="text-sm text-slate-700">{it.label}</span>
            </div>
            <div className="mt-2 text-xs leading-relaxed text-slate-500">
              <span className="line-through decoration-rose-500/60">{it.usually}</span>
            </div>
            <div className="mt-1 text-xs leading-relaxed text-slate-800">
              <span className="font-semibold text-brand-700">Now: </span>
              {it.now}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
