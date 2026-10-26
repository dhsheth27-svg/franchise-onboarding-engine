'use client';

import { useState } from 'react';
import type { RunPayload } from '@/lib/client-types';
import type { Decision } from '@/lib/engine/types';
import { Spinner } from './ui';

export interface DemoNav {
  runId?: string;
  query: Record<string, string | null>;
  note?: string;
  link?: { href: string; label: string };
}

interface Step {
  title: string;
  caption: string;
  /** Performs the step (may create a new run version) and says where to look. */
  run: (ctx: Ctx) => Promise<DemoNav>;
}

interface Ctx {
  id: string;
  data: RunPayload;
  d: (key: string) => Decision | undefined;
  ask: (message: string) => Promise<{ newRunId?: string }>;
  events: (events: unknown[]) => Promise<{ runId?: string }>;
  policyPreview: (change: unknown) => Promise<{ diff: { key: string; applicationId: string; outcomeFrom: string | null; outcomeTo: string | null }[] }>;
}

const OUT: Record<string, string> = { APPROVED: 'Approved', APPROVED_WITH_CONDITIONS: 'Approved with conditions', HOLD: 'On hold', WAITLISTED: 'Waitlisted', REJECTED: 'Rejected' };

export const DEMO_STEPS: Step[] = [
  {
    title: 'The control room',
    caption: 'All 29 messy applications were decided in under a second, each with its reasons. The impact strip shows what this run did that a manual process usually misses.',
    run: async () => ({ query: { tab: 'overview', a: null, changed: null } }),
  },
  {
    title: 'What the team does today',
    caption: 'A ranked to-do list: deadlines, info requests closest to approval, partners at risk of dropping out, redirects and recruiting. Each item has who, what, why, a deadline and a ready message.',
    run: async () => ({ query: { tab: 'today', a: null, changed: null } }),
  },
  {
    title: 'A hold, explained',
    caption: 'APP-007 is on hold because no shop space has been found. The drawer leads with the reason, what would change it, and a ready-to-send message in Kannada, with WhatsApp and email buttons.',
    run: async () => ({ query: { tab: 'decisions', a: 'APP-007', changed: null } }),
  },
  {
    title: 'New information re-decides (the brief’s example)',
    caption: '“APP-012 has now found a ground-floor space.” It moves from On hold to Approved with conditions: the slot is reserved and the size becomes a condition. The banner lists every applicant affected.',
    run: async (c) => {
      const x = c.d('APP-012');
      if (x && x.outcome === 'HOLD') {
        const r = await c.ask('APP-012 has now found a ground-floor space');
        return { runId: r.newRunId, query: { tab: 'decisions', a: 'APP-012', changed: '1' } };
      }
      return { query: { tab: 'decisions', a: 'APP-012', changed: null } };
    },
  },
  {
    title: 'A withdrawal ripples through',
    caption: '“APP-001 has withdrawn.” Its pin and slot are released and APP-002, next on the waitlist for that pin, is promoted automatically, with a fresh 30-day reservation and a new message.',
    run: async (c) => {
      const x = c.d('APP-001');
      if (x && !x.withdrawn) {
        const r = await c.ask('APP-001 has withdrawn');
        return { runId: r.newRunId, query: { tab: 'decisions', a: 'APP-002', changed: '1' } };
      }
      return { query: { tab: 'decisions', a: 'APP-002', changed: null } };
    },
  },
  {
    title: 'Overrides can’t break the hard rules',
    caption: 'A manager tries to force-approve APP-003. It is refused: store ST-02 already operates in that pin, and the brand never opens two stores in one pin. The attempt is logged with the name and reason.',
    run: async (c) => {
      const x = c.d('APP-003');
      if (x && !x.override) {
        const r = await c.events([{ type: 'override', applicationId: 'APP-003', payload: { outcome: 'APPROVED' }, reason: 'Demo: strong local operator, worth an exception', by: 'Demo manager' }]);
        return { runId: r.runId, query: { tab: 'decisions', a: 'APP-003', changed: null } };
      }
      return { query: { tab: 'decisions', a: 'APP-003', changed: null } };
    },
  },
  {
    title: 'From approval to an open store',
    caption: 'Approved partners move across the Journey board stage by stage, with due dates, overdue flags and the bottleneck. APP-026 has just signed its agreement and moved on to Site; the grand opening stays blocked until the readiness checklist is complete.',
    run: async (c) => {
      const x = c.d('APP-026');
      if (x && x.reservation && x.reservation.status !== 'Fulfilled') {
        const r = await c.events([{ type: 'checklist', applicationId: 'APP-026', payload: { kind: 'onboarding', item: 'agreement', status: 'Done' } }]);
        return { runId: r.runId, query: { tab: 'journey', a: null, changed: null } };
      }
      return { query: { tab: 'journey', a: null, changed: null } };
    },
  },
  {
    title: 'Calibrate the policy, safely',
    caption: 'Thresholds are the brand’s call. The simulator previews exactly who would change before anything is saved; applying it creates a logged version. The hard rules cannot be changed.',
    run: async (c) => {
      const t = c.data.result.territories.find((x) => x.id === 'TER-04');
      if (!t) return { query: { tab: 'rules', a: null, changed: null } };
      const p = await c.policyPreview({ territorySlots: { 'TER-04': t.openSlots + 1 } });
      const moved = p.diff.filter((x) => x.outcomeFrom !== x.outcomeTo);
      const note = moved.length
        ? `Preview: one more slot in TER-04 would change ${moved.map((x) => `${x.applicationId} (${OUT[x.outcomeFrom ?? ''] ?? '—'} → ${OUT[x.outcomeTo ?? ''] ?? '—'})`).join(', ')}. Nothing was saved.`
        : 'Preview: one more slot in TER-04 would change no decision. Nothing was saved.';
      return { query: { tab: 'rules', a: null, changed: null }, note };
    },
  },
  {
    title: 'Committee-ready one-pager',
    caption: 'Every applicant has a printable summary with the decision, reasons, checks, next steps and sign-off lines, ready for an approval committee or the partner file.',
    run: async (c) => ({ query: { tab: 'decisions', a: 'APP-009', changed: null }, link: { href: `/run/${c.id}/print/APP-009`, label: 'Open the APP-009 one-pager ↗' } }),
  },
  {
    title: 'That’s Opsmith',
    caption: 'Instant explained decisions, specific asks in the applicant’s language, redirects instead of rejections, reservations that stop stalled slots, a daily action list, a journey to opening day, and human overrides that can never break the three hard rules.',
    run: async () => ({ query: { tab: 'overview', a: null, changed: null } }),
  },
];

const NEEDED = ['APP-001', 'APP-003', 'APP-007', 'APP-012', 'APP-026'];

export default function DemoGuide({ id, data, step, onNav, onExit }: { id: string; data: RunPayload; step: number; onNav: (step: number, nav: DemoNav) => void; onExit: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [link, setLink] = useState<DemoNav['link'] | null>(null);
  const [min, setMin] = useState(false);
  const isSample = NEEDED.every((k) => data.result.decisions.some((d) => d.key === k));
  const s = DEMO_STEPS[Math.min(Math.max(step, 1), DEMO_STEPS.length) - 1];

  const ctx: Ctx = {
    id,
    data,
    d: (key) => data.result.decisions.find((x) => x.key === key),
    ask: async (message) => {
      const r = await fetch(`/api/runs/${id}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Request failed');
      return r.json();
    },
    events: async (events) => {
      const r = await fetch(`/api/runs/${id}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events, label: 'Guided demo' }) });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Request failed');
      return r.json();
    },
    policyPreview: async (change) => {
      const r = await fetch(`/api/runs/${id}/policy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ change, dryRun: true }) });
      if (!r.ok) throw new Error((await r.json()).error ?? 'Request failed');
      return r.json();
    },
  };

  async function go(n: number) {
    if (n < 1 || n > DEMO_STEPS.length) return;
    setBusy(true);
    setError(null);
    try {
      const nav = await DEMO_STEPS[n - 1].run(ctx);
      setNote(nav.note ?? null);
      setLink(nav.link ?? null);
      onNav(n, nav);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function startOnSample() {
    setBusy(true);
    try {
      const r = await fetch('/api/sample', { method: 'POST' });
      const b = await r.json();
      onNav(1, { runId: b.runId, query: { tab: 'overview', a: null, changed: null } });
    } finally {
      setBusy(false);
    }
  }

  if (min)
    return (
      <button
        onClick={() => setMin(false)}
        aria-label="Show the guided demo"
        className="fixed bottom-5 left-5 z-50 inline-flex animate-scale-in items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-lift transition hover:-translate-y-px hover:bg-brand-500"
      >
        ▶ Demo {isSample ? `${step}/${DEMO_STEPS.length}` : ''}
      </button>
    );

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 animate-scale-in sm:inset-x-auto sm:bottom-5 sm:left-5 sm:w-[400px]" role="region" aria-label="Guided demo">
      <div className="rounded-3xl border border-brand-400 bg-surface p-4 shadow-paper">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-700">
            Guided demo · {isSample ? `${step} / ${DEMO_STEPS.length}` : 'sample data needed'}
          </span>
          <span className="flex gap-1">
            <button onClick={() => setMin(true)} aria-label="Minimise" className="rounded-full px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              Minimise –
            </button>
            <button onClick={onExit} className="rounded-full px-2 py-0.5 text-xs text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              Exit ✕
            </button>
          </span>
        </div>
        {isSample ? (
          <>
            <div className="mt-2 flex gap-1" aria-hidden>
              {DEMO_STEPS.map((_, i) => (
                <span key={i} className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i < step ? 'bg-brand-600' : 'bg-slate-200'}`} />
              ))}
            </div>
            <h3 className="mt-3 font-display text-2xl leading-tight text-ink">{s.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{s.caption}</p>
            {note && <p className="mt-2 rounded-2xl border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-slate-800">{note}</p>}
            {link && (
              <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex rounded-full px-3 py-1 text-sm font-medium text-brand-800 ring-1 ring-brand-400 transition hover:bg-brand-600 hover:text-white">
                {link.label}
              </a>
            )}
            {error && <p className="mt-2 text-sm text-rose-700">{error}</p>}
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => go(step - 1)}
                disabled={busy || step <= 1}
                className="rounded-full px-3 py-1.5 text-sm text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-100 disabled:opacity-40"
              >
                ← Back
              </button>
              {step < DEMO_STEPS.length ? (
                <button onClick={() => go(step + 1)} disabled={busy} className="ml-auto inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:-translate-y-px hover:bg-brand-500 disabled:opacity-60">
                  {busy ? <Spinner /> : null} Next: {DEMO_STEPS[step].title.split(' (')[0]} →
                </button>
              ) : (
                <button onClick={startOnSample} disabled={busy} className="ml-auto rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-500">
                  Restart on fresh data
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-700">The guided demo walks through the built-in sample data (29 messy applications). Your uploaded run is not changed.</p>
            <button onClick={startOnSample} disabled={busy} className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand-600 px-4 py-1.5 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-500">
              {busy ? <Spinner /> : null} Start the demo on sample data
            </button>
          </>
        )}
      </div>
    </div>
  );
}
