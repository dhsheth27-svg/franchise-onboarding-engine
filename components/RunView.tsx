'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import type { RunPayload } from '@/lib/client-types';
import type { ChecklistStatus, Decision, Outcome } from '@/lib/engine/types';
import type { NewEvent } from '@/lib/runs';
import ApplicantDrawer from './ApplicantDrawer';
import AskPanel from './AskPanel';
import DashboardTab from './DashboardTab';
import DemoGuide, { type DemoNav } from './DemoGuide';
import JourneyTab from './JourneyTab';
import OutboxTab from './OutboxTab';
import PolicyPanel from './PolicyPanel';
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
  { id: 'overview', label: 'Overview' },
  { id: 'today', label: 'Today' },
  { id: 'outbox', label: 'Outbox' },
  { id: 'decisions', label: 'Decisions' },
  { id: 'journey', label: 'Journey' },
  { id: 'territories', label: 'Territories' },
  { id: 'insights', label: 'Insights' },
  { id: 'rules', label: 'Rules & policy' },
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
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="skeleton h-4 w-48 animate-shimmer rounded-full" />
      <div className="skeleton mt-3 h-10 w-80 animate-shimmer rounded-2xl" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 animate-shimmer rounded-3xl" />
        ))}
      </div>
      <div className="skeleton mt-4 h-80 animate-shimmer rounded-3xl" />
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

  const tab = (params.get('tab') as TabId) || 'overview';
  const demoStep = params.get('demo') ? Math.max(1, parseInt(params.get('demo')!, 10) || 1) : null;
  const demoNav = useCallback(
    (step: number, nav: DemoNav) => {
      const q = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(nav.query)) v === null ? q.delete(k) : q.set(k, v);
      q.set('demo', String(step));
      router.push(`/run/${nav.runId ?? id}?${q.toString()}`, { scroll: false });
    },
    [id, params, router],
  );
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
  const onMarkSent = useCallback(
    (d: Decision, channel: string, by: string) =>
      postEvents([{ type: 'checklist', applicationId: d.key, payload: { kind: 'message', item: 'message', status: 'Sent', channel, outcome: d.outcome }, by }], `${d.applicationId}: message sent via ${channel}`),
    [postEvents],
  );
  const onAdvance = useCallback(
    (d: Decision, stepIds: string[], status: ChecklistStatus) =>
      postEvents(
        stepIds.map((item) => ({ type: 'checklist' as const, applicationId: d.key, payload: { kind: 'onboarding', item, status } })),
        `${d.applicationId}: ${stepIds.length} onboarding step(s) → ${status}`,
      ),
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
      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-canvas/60 backdrop-blur-xl">
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
          <Button variant="secondary" className="hidden sm:inline-flex" onClick={() => setQuery({ demo: '1', tab: 'overview', a: null, changed: null })} title="A guided walkthrough of the key features">
            ▶ Demo
          </Button>
          <Button variant="ghost" className="hidden sm:inline-flex" onClick={() => setShowHistory(true)}>
            History
          </Button>
          <a className="hidden rounded-md px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100 sm:inline-flex" href={`/api/runs/${id}/export`}>
            Export Excel
          </a>
          <Button variant="primary" className="xl:hidden" onClick={() => setAskOpen(true)}>
            Ask
          </Button>
        </div>
      </header>

      {busy && (
        <div className="fixed left-1/2 top-16 z-50 flex -translate-x-1/2 items-center gap-2 animate-scale-in rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-btn" role="status">
          <Spinner /> Re-deciding: {busy}
        </div>
      )}
      {!r.assertions.ok && (
        <div role="alert" className="border-b border-rose-300 bg-rose-50 px-6 py-2 text-sm text-rose-900">
          <strong>Hard rule check failed.</strong> {r.assertions.violations.join(' ')}
        </div>
      )}

      <div className="flex flex-1">
        <main className="relative isolate min-w-0 flex-1 px-4 pb-16 pt-4 sm:px-6">
          <div className="bg-dots pointer-events-none absolute inset-x-0 top-0 -z-10 h-64 [mask-image:linear-gradient(to_bottom,black,transparent)]" aria-hidden />
          {/* Title */}
          <div className="flex flex-wrap items-end justify-between gap-4 pt-4">
            <div className="animate-fade-up">
              <div className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                {data.source ?? data.label} · as of {fmtDate(r.asOf)}
              </div>
              <h1 className="mt-2 text-3xl font-bold uppercase leading-none tracking-tight text-ink sm:text-4xl">
                Expansion <span className="text-slate-500">control room</span>
              </h1>
            </div>
            <div className="flex animate-fade-up flex-wrap items-center gap-2 text-xs text-slate-500" style={{ animationDelay: '80ms' }}>
              <span className="rounded-full border border-slate-200 px-3 py-1">
                v{data.version} {data.version > 1 ? `· ${data.label}` : ''}
              </span>
            </div>
          </div>

          {params.get('changed') && data.parentRunId && <DiffBanner runId={id} onOpen={(k) => setQuery({ a: k })} onClose={() => setQuery({ changed: null })} />}

          {/* Tabs: segmented control */}
          <nav className="mt-6 flex w-fit max-w-full gap-1 overflow-x-auto rounded-full border border-slate-200 bg-surface/75 p-1 shadow-card backdrop-blur-xl" aria-label="Sections">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setQuery({ tab: t.id })}
                aria-current={tab === t.id ? 'page' : undefined}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition duration-200 ${tab === t.id ? 'bg-[#F4F4F6] text-black shadow' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}
              >
                {t.label}
                {t.id === 'today' && openActions > 0 && <span className={`ml-1.5 rounded-full px-1.5 text-xs ${tab === t.id ? 'bg-brand-600 text-white' : 'bg-brand-200 text-brand-800'}`}>{openActions}</span>}
              </button>
            ))}
          </nav>

          {/* Outcome chips (filters) on every tab except the dashboard */}
          {tab !== 'overview' && (
            <div className="mt-4 flex flex-wrap gap-2">
              {outcomes.map((o) => (
                <button
                  key={o}
                  onClick={() => {
                    setOutcomeFilter(outcomeFilter === o ? null : o);
                    setQuery({ tab: 'decisions' });
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition duration-200 hover:border-slate-400 hover:bg-slate-100 ${outcomeFilter === o ? 'border-brand-600 bg-brand-50 text-slate-900' : 'border-slate-200 text-slate-600'}`}
                >
                  <span aria-hidden className={`h-2 w-2 rounded-full ${OUTCOME_DOT[o]}`} />
                  {OUTCOME_LABEL[o]} <span className="font-semibold tabular-nums text-slate-900">{r.counts[o]}</span>
                </button>
              ))}
              <button onClick={() => setQuery({ tab: 'data' })} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-slate-400 hover:bg-slate-100">
                Data issues <span className="font-semibold tabular-nums text-slate-900">{issues}</span>
              </button>
            </div>
          )}

          <div key={tab} className="animate-fade-up pt-5">
            {tab === 'overview' && <DashboardTab result={r} config={data.config} events={data.events} onOpen={(k) => setQuery({ a: k })} onTab={(t) => setQuery({ tab: t })} />}
            {tab === 'today' && <TodayTab result={r} onOpen={(k) => setQuery({ a: k })} onDone={(itemId, label) => postEvents([{ type: 'checklist', payload: { kind: 'action', item: itemId, status: 'Done' } }], `Done: ${label}`)} busy={!!busy} />}
            {tab === 'decisions' && <DecisionsTable decisions={r.decisions} outcomeFilter={outcomeFilter} onOutcomeFilter={setOutcomeFilter} onOpen={(k) => setQuery({ a: k })} selectedKey={selectedKey} />}
            {tab === 'territories' && <TerritoriesTab result={r} onOpen={(k) => setQuery({ a: k })} />}
            {tab === 'insights' && <InsightsTab result={r} config={data.config} events={data.events} onOpen={(k) => setQuery({ a: k })} />}
            {tab === 'rules' && (
              <div className="space-y-6">
                <PolicyPanel runId={id} config={data.config} territories={r.territories} onApplied={(next) => router.push(`/run/${next}?tab=rules&changed=1`, { scroll: false })} />
                <RulesTab config={data.config} />
              </div>
            )}
            {tab === 'journey' && <JourneyTab decisions={r.decisions} asOf={r.asOf} onOpen={(k) => setQuery({ a: k })} onAdvance={onAdvance} onTab={(t) => setQuery({ tab: t })} busy={!!busy} />}
            {tab === 'outbox' && <OutboxTab decisions={r.decisions} onOpen={(k) => setQuery({ a: k })} onMarkSent={onMarkSent} busy={!!busy} />}
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
            onMarkSent,
            printHref: `/run/${id}/print/${encodeURIComponent(decision.key)}`,
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
      {demoStep && <DemoGuide id={id} data={data} step={demoStep} onNav={demoNav} onExit={() => setQuery({ demo: null })} />}
      {showHistory && <HistoryPanel runId={id} currentId={id} onClose={() => setShowHistory(false)} />}
    </div>
  );
}
