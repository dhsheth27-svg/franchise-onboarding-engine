'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { RunPayload } from '@/lib/client-types';
import type { ChecklistStatus, Decision, Outcome } from '@/lib/engine/types';
import type { NewEvent } from '@/lib/runs';
import ApplicantDrawer from './ApplicantDrawer';
import AskPanel from './AskPanel';
import DataQualityTab from './DataQualityTab';
import DecisionsTable from './DecisionsTable';
import DiffBanner from './DiffBanner';
import HistoryPanel, { ApplicantHistory } from './HistoryPanel';
import InsightsTab from './InsightsTab';
import OverrideDialog from './OverrideDialog';
import RulesTab from './RulesTab';
import TerritoriesTab from './TerritoriesTab';
import TodayTab from './TodayTab';
import { Button, fmtDate, Logo, OUTCOME_DOT, OUTCOME_LABEL, Spinner } from './ui';

const TABS = [
  { id: 'today', label: 'Today' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'territories', label: 'Territories' },
  { id: 'insights', label: 'Insights' },
  { id: 'rules', label: 'Rules in use' },
  { id: 'data', label: 'Data quality' },
] as const;
type TabId = (typeof TABS)[number]['id'];

export default function RunView({ id }: { id: string }) {
  return (
    <Suspense fallback={<Skeleton />}>
      <RunViewInner id={id} />
    </Suspense>
  );
}

function Skeleton() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6">
      <div className="h-6 w-64 rounded bg-slate-200" />
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-slate-200" />
        ))}
      </div>
      <div className="mt-6 h-96 rounded-lg bg-slate-200" />
    </div>
  );
}

function RunViewInner({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [data, setData] = useState<RunPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [outcomeFilter, setOutcomeFilter] = useState<Outcome | null>(null);
  const [overrideFor, setOverrideFor] = useState<Decision | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [askOpen, setAskOpen] = useState(false);

  const tab = (params.get('tab') as TabId) || 'today';
  const selectedKey = params.get('a');

  const setQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const q = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) v === null ? q.delete(k) : q.set(k, v);
      router.replace(`${pathname}?${q.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/runs/${id}`)
      .then(async (r) => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error ?? 'Could not load this run.');
        return body as RunPayload;
      })
      .then((b) => alive && setData(b))
      .catch((e) => alive && setError(e.message));
    return () => {
      alive = false;
    };
  }, [id]);

  const decision = useMemo(() => data?.result.decisions.find((d) => d.key === selectedKey) ?? null, [data, selectedKey]);
  const openActions = data ? data.result.actions.filter((a) => !a.done).length : 0;
  const issues = data ? data.result.dataIssues.filter((i) => i.severity !== 'INFO').length : 0;

  /** Post events, then navigate to the new run version (keeping tab and open applicant). */
  const postEvents = useCallback(
    async (events: NewEvent[], label: string): Promise<{ ok: boolean; error?: string }> => {
      setBusy(label);
      try {
        const r = await fetch(`/api/runs/${id}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, label }) });
        const body = await r.json();
        if (!r.ok) return { ok: false, error: body.error ?? 'Could not save the change.' };
        const q = new URLSearchParams(params.toString());
        q.set('changed', '1');
        router.push(`/run/${body.runId}?${q.toString()}`, { scroll: false });
        return { ok: true };
      } catch {
        return { ok: false, error: 'Could not reach the server.' };
      } finally {
        setBusy(null);
      }
    },
    [id, params, router],
  );

  const onChecklist = useCallback(
    (d: Decision, kind: 'onboarding' | 'document' | 'readiness', item: string, status: ChecklistStatus) =>
      postEvents([{ type: 'checklist', applicationId: d.key, payload: { kind, item, status } }], `${d.applicationId}: ${item} → ${status}`),
    [postEvents],
  );
  const onMilestone = useCallback((d: Decision, stage: string) => postEvents([{ type: 'milestone', applicationId: d.key, payload: { stage } }], `${d.applicationId}: agreement signed`), [postEvents]);

  if (error)
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="text-xl font-semibold text-slate-900">This run could not be opened</h1>
        <p className="mt-2 text-slate-600">{error}</p>
        <Link href="/" className="mt-6 inline-block text-brand-700 underline">
          Start a new run
        </Link>
      </div>
    );
  if (!data) return <Skeleton />;

  const r = data.result;
  const outcomes = Object.keys(OUTCOME_LABEL) as Outcome[];

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 sm:px-6">
          <Link href="/" aria-label="Home" className="flex items-center">
            <span className="sm:hidden">
              <Logo compact />
            </span>
            <span className="hidden sm:inline">
              <Logo />
            </span>
          </Link>
          <div className="min-w-0 flex-1 truncate text-sm text-slate-500">
            <span className="hidden sm:inline">{data.source ?? data.label} · </span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-bold text-brand-700">v{data.version}</span>
            {data.version > 1 && <span className="hidden md:inline"> · {data.label}</span>}
          </div>
          <SimulateDate asOf={r.asOf} today={data.today} busy={!!busy} onApply={(days) => postEvents([{ type: 'dateAdvance', payload: { days } }], `Moved the date forward ${days} days`)} />
          <Button variant="ghost" onClick={() => setShowHistory(true)}>
            History
          </Button>
          <a className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex" href={`/api/runs/${id}/export`}>
            Export Excel
          </a>
          <a className="hidden rounded-md px-2 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-100 lg:inline-flex" href={`/api/runs/${id}/export?format=csv`}>
            CSV
          </a>
          <Button variant="primary" className="xl:hidden" onClick={() => setAskOpen(true)}>
            Ask
          </Button>
        </div>
      </header>

      {busy && (
        <div className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm text-white shadow-lg" role="status">
          <Spinner /> Re-deciding: {busy}
        </div>
      )}
      {!r.assertions.ok && (
        <div role="alert" className="border-b border-rose-300 bg-rose-50 px-6 py-2 text-sm text-rose-900">
          <strong>Hard rule check failed.</strong> {r.assertions.violations.join(' ')}
        </div>
      )}

      <div className="flex flex-1">
        <main className="min-w-0 flex-1 px-4 pb-16 pt-4 sm:px-6">
          {/* Stats strip */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
            {outcomes.map((o) => (
              <button
                key={o}
                onClick={() => {
                  setOutcomeFilter(outcomeFilter === o ? null : o);
                  setQuery({ tab: 'decisions' });
                }}
                className={`rounded-2xl border bg-white px-3.5 py-3 text-left shadow-card transition hover:shadow-lift ${outcomeFilter === o ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-200/70'}`}
              >
                <div className="text-xl font-extrabold tabular-nums text-ink sm:text-2xl">{r.counts[o]}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span aria-hidden className={`h-2 w-2 rounded-full ${OUTCOME_DOT[o]}`} />
                  {OUTCOME_LABEL[o]}
                </div>
              </button>
            ))}
            <button onClick={() => setQuery({ tab: 'today' })} className="rounded-2xl border border-brand-600 bg-brand-600 px-3.5 py-3 text-left text-white shadow-lift transition hover:bg-brand-700">
              <div className="text-xl font-extrabold tabular-nums sm:text-2xl">{openActions}</div>
              <div className="mt-0.5 text-xs font-semibold text-brand-50">Open actions</div>
            </button>
            <button onClick={() => setQuery({ tab: 'data' })} className="rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 text-left shadow-card transition hover:shadow-lift">
              <div className="text-xl font-extrabold tabular-nums text-ink sm:text-2xl">{issues}</div>
              <div className="mt-0.5 text-xs font-semibold text-slate-600">Data issues</div>
            </button>
            <div className="hidden flex-col justify-center rounded-2xl border border-slate-200/70 bg-white px-3.5 py-3 text-xs text-slate-500 shadow-card sm:col-span-4 sm:flex lg:col-span-1">
              <span>
                As of <span className="font-medium text-slate-800">{fmtDate(r.asOf)}</span>
              </span>
              <span>
                {r.decisions.length} decided in {r.durationMs < 1000 ? `${Math.max(1, r.durationMs)} ms` : `${(r.durationMs / 1000).toFixed(1)} s`}
              </span>
            </div>
          </div>

          {params.get('changed') && data.parentRunId && <DiffBanner runId={id} onOpen={(k) => setQuery({ a: k })} onClose={() => setQuery({ changed: null })} />}

          {/* Tabs */}
          <nav className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200/70 bg-white p-1 shadow-card" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setQuery({ tab: t.id })}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${tab === t.id ? 'bg-brand-600 text-white shadow-btn' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'}`}
              >
                {t.label}
                {t.id === 'today' && openActions > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.id ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-800'}`}>{openActions}</span>}
              </button>
            ))}
          </nav>

          <div className="pt-5">
            {tab === 'today' && <TodayTab result={r} onOpen={(k) => setQuery({ a: k })} onDone={(itemId, label) => postEvents([{ type: 'checklist', payload: { kind: 'action', item: itemId, status: 'Done' } }], `Done: ${label}`)} busy={!!busy} />}
            {tab === 'decisions' && <DecisionsTable decisions={r.decisions} outcomeFilter={outcomeFilter} onOutcomeFilter={setOutcomeFilter} onOpen={(k) => setQuery({ a: k })} selectedKey={selectedKey} />}
            {tab === 'territories' && <TerritoriesTab result={r} onOpen={(k) => setQuery({ a: k })} />}
            {tab === 'insights' && <InsightsTab result={r} config={data.config} events={data.events} onOpen={(k) => setQuery({ a: k })} />}
            {tab === 'rules' && <RulesTab config={data.config} />}
            {tab === 'data' && <DataQualityTab result={r} importNotes={data.importNotes} onOpen={(k) => setQuery({ a: k })} />}
          </div>
        </main>

        <AskPanel runId={id} decisions={r.decisions} open={askOpen} onClose={() => setAskOpen(false)} onOpen={(k) => setQuery({ a: k })} />
      </div>

      {decision && (
        <ApplicantDrawer
          d={decision}
          actions={{
            onClose: () => setQuery({ a: null }),
            onOverride: setOverrideFor,
            onChecklist,
            onMilestone,
            busy: !!busy,
            history: <ApplicantHistory runId={id} rootKey={decision.key} />,
          }}
        />
      )}
      {overrideFor && (
        <OverrideDialog
          d={overrideFor}
          decisions={r.decisions}
          onCancel={() => setOverrideFor(null)}
          onSubmit={async (ev) => {
            const res = await postEvents([ev], `Override ${overrideFor.applicationId} → ${OUTCOME_LABEL[ev.payload.outcome as Outcome] ?? 'engine decision'}`);
            if (res.ok) setOverrideFor(null);
            return res;
          }}
        />
      )}
      {showHistory && <HistoryPanel runId={id} currentId={id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}

function SimulateDate({ asOf, today, busy, onApply }: { asOf: string; today: string; busy: boolean; onApply: (days: number) => void }) {
  const [value, setValue] = useState(asOf);
  useEffect(() => {
    setValue(asOf);
  }, [asOf]);
  const days = Math.round((Date.parse(value) - Date.parse(asOf)) / 86400000);
  return (
    <div className="flex items-center gap-1.5 text-sm">
      <label htmlFor="simdate" className="hidden text-slate-500 lg:inline">
        Simulate date
      </label>
      <input
        id="simdate"
        type="date"
        min={asOf}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        title={asOf !== today ? `Simulated: real date is ${fmtDate(today)}` : 'Move the date forward to see reservations expire and the waitlist promote'}
      />
      {days > 0 && (
        <Button variant="secondary" disabled={busy} onClick={() => onApply(days)}>
          +{days}d
        </Button>
      )}
    </div>
  );
}
