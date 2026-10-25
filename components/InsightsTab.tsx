'use client';

import { useMemo, type ReactNode } from 'react';
import type { Config } from '@/lib/config';
import type { EngineEvent, RunResult } from '@/lib/engine/types';
import { computeInsights, monthLabel } from '@/lib/insights';
import { Card, Empty } from './ui';

function Panel({ title, children, note, className = '' }: { title: string; children: ReactNode; note?: string; className?: string }) {
  return (
    <Card className={`p-4 ${className}`}>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {note && <p className="mt-0.5 text-xs text-slate-500">{note}</p>}
      <div className="mt-3">{children}</div>
    </Card>
  );
}

/** Single-series horizontal bars: one accent colour, value labels beside the bar, title tooltip on hover. */
function Bars({ rows, max, unit = '' }: { rows: { label: ReactNode; n: number; hint?: string }[]; max?: number; unit?: string }) {
  const m = max ?? Math.max(1, ...rows.map((r) => r.n));
  return (
    <ul className="space-y-2">
      {rows.map((r, i) => (
        <li key={i} className="grid grid-cols-[minmax(7rem,40%)_1fr_auto] items-center gap-3 text-sm" title={`${typeof r.label === 'string' ? r.label : ''}: ${r.n}${unit}`}>
          <span className="truncate text-slate-700">{r.label}</span>
          <span className="h-2.5 rounded-r bg-slate-100">
            <span className="block h-full rounded-r bg-brand-600" style={{ width: `${(r.n / m) * 100}%` }} />
          </span>
          <span className="w-10 text-right tabular-nums text-slate-900">
            {r.n}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Stat({ value, label, sub }: { value: ReactNode; label: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-surface/75 shadow-card backdrop-blur-xl px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      <div className="text-xs font-medium text-slate-600">{label}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

const OUTCOME_TITLE = { HOLD: 'Why applications are on hold', WAITLISTED: 'Why qualified applicants are waiting', REJECTED: 'Why applications are rejected' } as const;

export default function InsightsTab({ result, config, events, onOpen }: { result: RunResult; config: Config; events: EngineEvent[]; onOpen: (key: string) => void }) {
  const ins = useMemo(() => computeInsights(result, config, events), [result, config, events]);
  const langs = ['Kannada', 'English', 'Hindi'];

  return (
    <div className="space-y-5">
      <section aria-label="Impact" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
        <Stat value={ins.impact.decided} label="Applications decided" sub={ins.impact.seconds < 1 ? `in ${Math.max(1, Math.round(ins.impact.seconds * 1000))} ms` : `in ${ins.impact.seconds.toFixed(1)} seconds`} />
        <Stat value={`${ins.impact.holdsWithAsk}/${ins.impact.holds}`} label="Holds with a specific ask" sub="ready to send" />
        <Stat value={`${ins.impact.slotsFilled}/${ins.impact.slotsAvailable}`} label="Usable slots filled" sub="slots limited by free pins" />
        <Stat value={ins.impact.withMessage} label="Messages prepared" sub="in each applicant's language" />
        <Stat value={ins.impact.redirectsOffered} label="Redirects offered" sub="instead of plain rejections" />
        <Stat value={ins.openings.reduce((n, o) => n + o.n, 0)} label="Expected openings" sub={ins.openings.length ? `${monthLabel(ins.openings[0].month)} onward` : '—'} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Funnel" note="How many applications survive each stage.">
          <Bars rows={ins.funnel.map((f) => ({ label: f.label, n: f.n }))} max={ins.funnel[0].n} />
        </Panel>

        <Panel title="Near-misses and the cheapest fix" note="Not approved today, but one change would get them there.">
          {ins.nearMisses.length ? (
            <ul className="space-y-2 text-sm">
              {ins.nearMisses.map((n) => (
                <li key={n.key}>
                  <button onClick={() => onOpen(n.key)} className="font-mono font-medium text-brand-700 hover:underline">
                    {n.id}
                  </button>{' '}
                  <span className="text-slate-500">({n.score ?? '—'})</span> <span className="text-slate-700">{n.fix}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>No near-misses.</Empty>
          )}
        </Panel>

        {ins.leakage
          .filter((l) => l.total > 0)
          .map((l) => (
            <Panel key={l.outcome} title={OUTCOME_TITLE[l.outcome]} note={`${l.total} application${l.total === 1 ? '' : 's'}`}>
              <Bars rows={l.rows.map((x) => ({ label: x.label, n: x.n }))} />
              {l.rows[0] && (
                <p className="mt-3 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  <span className="font-medium text-slate-900">So what: </span>
                  {Math.round(l.rows[0].share * 100)}% of these are &ldquo;{l.rows[0].label.toLowerCase()}&rdquo;: {l.rows[0].soWhat}.
                </p>
              )}
            </Panel>
          ))}

        <Panel title="Underserved territories" note="Slots that can still be filled (free pins exist).">
          {ins.underserved.length ? (
            <ul className="space-y-1.5 text-sm">
              {ins.underserved.map((t) => (
                <li key={t.id} className="flex justify-between gap-3">
                  <span className="text-slate-800">
                    {t.id} · {t.city} <span className="text-slate-500">({t.priority})</span>
                  </span>
                  <span className="text-slate-600">
                    {t.unfilled} open · pins {t.freePins.slice(0, 3).join(', ')}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Every usable slot is filled.</Empty>
          )}
        </Panel>

        <Panel title="Close calls" note={`Contested slots decided by ${config.closeCallMargin.value} points or less.`}>
          {ins.closeCalls.length ? (
            <ul className="space-y-1.5 text-sm">
              {ins.closeCalls.map((c) => (
                <li key={c.key}>
                  <button onClick={() => onOpen(c.key)} className="font-mono font-medium text-brand-700 hover:underline">
                    {c.id}
                  </button>{' '}
                  lost to {c.winner} by {c.margin.toFixed(1)} points in {c.territory}: worth a second look.
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-600">No contested slot was decided by {config.closeCallMargin.value} points or less.</p>
          )}
        </Panel>

        <Panel title="Where approvals land" note="Approvals by city.">
          {ins.concentration.length ? <Bars rows={ins.concentration.map((c) => ({ label: c.city, n: c.n }))} /> : <Empty>No approvals yet.</Empty>}
          <p className={`mt-3 text-sm ${ins.concentrationWarning ? 'rounded-md bg-amber-50 px-3 py-2 text-amber-950' : 'text-slate-600'}`}>
            {ins.concentrationWarning ? <>⚠ {ins.concentrationWarning}</> : `No city has more than ${Math.round(config.concentrationWarningShare.value * 100)}% of approvals.`}
          </p>
        </Panel>

        <Panel title="Training load" note="Partners finishing training, by month and language (plan trainers accordingly).">
          {ins.trainingLoad.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-1 pr-4 font-medium">Month</th>
                    {langs.map((l) => (
                      <th key={l} className="py-1 pr-4 text-right font-medium">
                        {l}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ins.trainingLoad.map((t) => (
                    <tr key={t.month}>
                      <td className="py-1.5 pr-4 text-slate-800">{monthLabel(t.month)}</td>
                      {langs.map((l) => (
                        <td key={l} className="py-1.5 pr-4 text-right tabular-nums text-slate-800">
                          {t.byLanguage[l] ?? 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty>No approved partners in training.</Empty>
          )}
        </Panel>

        <Panel title="Opening timeline" note="Earliest realistic opening month for approved partners.">
          {ins.openings.length ? <Bars rows={ins.openings.map((o) => ({ label: monthLabel(o.month), n: o.n }))} /> : <Empty>No openings planned yet.</Empty>}
        </Panel>

        <Panel title="Overrides" note="Human overrides by the engine reason they went against.">
          {ins.overrides.total ? (
            <>
              <Bars rows={ins.overrides.byReason.map((x) => ({ label: x.reason, n: x.n }))} />
              <p className="mt-2 text-sm text-slate-600">
                {ins.overrides.total} override{ins.overrides.total === 1 ? '' : 's'} logged; {ins.overrides.refused} refused for breaking a hard rule.
              </p>
              {ins.overrides.warning && <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">⚠ {ins.overrides.warning}</p>}
            </>
          ) : (
            <p className="text-sm text-slate-600">No overrides yet. Every override is logged with a name and reason; if one rule keeps being overridden, it is flagged here for review.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
