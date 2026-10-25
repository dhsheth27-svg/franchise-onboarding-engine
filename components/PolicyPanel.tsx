'use client';

import { useState } from 'react';
import type { DiffEntry } from '@/lib/client-types';
import type { Config, Tier } from '@/lib/config';
import type { Outcome, TerritorySummary } from '@/lib/engine/types';
import type { Policy } from '@/lib/policy';
import { DiffList } from './DiffBanner';
import { Button, OUTCOME_LABEL, Spinner } from './ui';

const TIERS: Tier[] = ['Tier 1', 'Tier 2', 'Tier 3'];
const WEIGHTS = ['financial', 'operator', 'site', 'launch', 'territory'] as const;

interface Preview {
  label: string;
  diff: DiffEntry[];
  counts: Record<Outcome, number>;
  before: Record<Outcome, number>;
}

function Num({ label, value, onChange, step = 1, suffix, min = 0 }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string; min?: number }) {
  return (
    <label className="block text-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="mt-1 flex items-center gap-1.5">
        <input
          type="number"
          step={step}
          min={min}
          value={Number.isFinite(value) ? value : ''}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="w-24 rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm tabular-nums transition focus:border-brand-500 focus:outline-none"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}

export default function PolicyPanel({ runId, config, territories, onApplied }: { runId: string; config: Config; territories: TerritorySummary[]; onApplied: (runId: string) => void }) {
  const [bar, setBar] = useState(config.MIN_SCORE_TO_APPROVE.value);
  const [near, setNear] = useState(config.nearMissMargin.value);
  const [gap, setGap] = useState(Math.round(config.capitalShortfallHoldThreshold.value * 100));
  const [resv, setResv] = useState(config.reservationDays.value);
  const [cond, setCond] = useState(config.conditionDays.value);
  const [inv, setInv] = useState({ ...config.minInvestmentLakh.value });
  const [space, setSpace] = useState({ ...config.minSpaceSqft.value });
  const [weights, setWeights] = useState({ ...config.weights.value });
  const [slots, setSlots] = useState(Object.fromEntries(territories.map((t) => [t.id, t.openSlots])));
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [by, setBy] = useState('');

  const wSum = WEIGHTS.reduce((n, k) => n + (weights[k] || 0), 0);

  // Only send what changed, so the version label reads cleanly.
  const change = (): Policy => {
    const c: Policy = {};
    if (bar !== config.MIN_SCORE_TO_APPROVE.value) c.MIN_SCORE_TO_APPROVE = bar;
    if (near !== config.nearMissMargin.value) c.nearMissMargin = near;
    if (gap / 100 !== config.capitalShortfallHoldThreshold.value) c.capitalShortfallHoldThreshold = gap / 100;
    if (resv !== config.reservationDays.value) c.reservationDays = resv;
    if (cond !== config.conditionDays.value) c.conditionDays = cond;
    const tierDiff = (now: Record<Tier, number>, was: Record<Tier, number>) => Object.fromEntries(TIERS.filter((t) => now[t] !== was[t]).map((t) => [t, now[t]]));
    const i = tierDiff(inv, config.minInvestmentLakh.value);
    if (Object.keys(i).length) c.minInvestmentLakh = i;
    const s = tierDiff(space, config.minSpaceSqft.value);
    if (Object.keys(s).length) c.minSpaceSqft = s;
    const w = Object.fromEntries(WEIGHTS.filter((k) => weights[k] !== config.weights.value[k]).map((k) => [k, weights[k]]));
    if (Object.keys(w).length) c.weights = { ...config.weights.value, ...w };
    const sl = Object.fromEntries(territories.filter((t) => slots[t.id] !== t.openSlots).map((t) => [t.id, slots[t.id]]));
    if (Object.keys(sl).length) c.territorySlots = sl;
    return c;
  };
  const changed = Object.keys(change()).length > 0;

  async function call(dryRun: boolean) {
    setError(null);
    setBusy(dryRun ? 'preview' : 'apply');
    try {
      const r = await fetch(`/api/runs/${runId}/policy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ change: change(), dryRun, by }) });
      const body = await r.json();
      if (!r.ok) return setError(body.error ?? 'Could not run the simulation.');
      if (dryRun) setPreview(body);
      else onApplied(body.runId);
    } catch {
      setError('Could not reach the server.');
    } finally {
      setBusy(null);
    }
  }

  const reset = () => {
    setBar(config.MIN_SCORE_TO_APPROVE.value);
    setNear(config.nearMissMargin.value);
    setGap(Math.round(config.capitalShortfallHoldThreshold.value * 100));
    setResv(config.reservationDays.value);
    setCond(config.conditionDays.value);
    setInv({ ...config.minInvestmentLakh.value });
    setSpace({ ...config.minSpaceSqft.value });
    setWeights({ ...config.weights.value });
    setSlots(Object.fromEntries(territories.map((t) => [t.id, t.openSlots])));
    setPreview(null);
  };

  return (
    <section className="rounded-3xl border border-brand-300 bg-surface/75 p-5 shadow-card backdrop-blur-xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold uppercase tracking-tight text-ink">
            Policy simulator <span className="text-slate-500">calibrate before you commit</span>
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Change a threshold or a territory&apos;s slots and preview exactly who would change. Applying it saves a new version with your name, so every policy change is on record. The three hard rules never change.</p>
        </div>
        <Button variant="ghost" onClick={reset}>
          Reset
        </Button>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Decision thresholds</h3>
          <div className="grid grid-cols-2 gap-3">
            <Num label="Approval bar (score)" value={bar} onChange={setBar} />
            <Num label="Near-miss margin" value={near} onChange={setNear} suffix="pts" />
            <Num label="Capital gap still held" value={gap} onChange={setGap} suffix="%" />
            <Num label="Reservation window" value={resv} onChange={setResv} suffix="days" />
            <Num label="Condition deadline" value={cond} onChange={setCond} suffix="days" />
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Minimums by city tier</h3>
          <div className="grid grid-cols-2 gap-3">
            {TIERS.map((t) => (
              <Num key={`i${t}`} label={`${t} investment`} value={inv[t]} onChange={(n) => setInv({ ...inv, [t]: n })} suffix="lakh" />
            ))}
            {TIERS.map((t) => (
              <Num key={`s${t}`} label={`${t} space`} value={space[t]} onChange={(n) => setSpace({ ...space, [t]: n })} step={10} suffix="sq ft" />
            ))}
          </div>
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            Score weights <span className={wSum === 100 ? 'text-slate-500' : 'text-rose-700'}>· total {wSum}/100</span>
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {WEIGHTS.map((k) => (
              <Num key={k} label={k} value={weights[k]} onChange={(n) => setWeights({ ...weights, [k]: n })} />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Open slots by territory</h3>
          <div className="grid grid-cols-2 gap-3">
            {territories.map((t) => (
              <Num key={t.id} label={`${t.id} · ${t.city}`} value={slots[t.id]} onChange={(n) => setSlots({ ...slots, [t.id]: Math.max(0, Math.round(n || 0)) })} />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button variant="primary" disabled={!changed || !!busy || wSum !== 100} onClick={() => call(true)}>
          {busy === 'preview' ? (
            <>
              <Spinner /> Simulating…
            </>
          ) : (
            'Preview impact'
          )}
        </Button>
        {!changed && <span className="text-xs text-slate-500">Change a value to preview its impact.</span>}
        {wSum !== 100 && <span className="text-xs text-rose-700">Weights must add up to 100.</span>}
      </div>
      {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

      {preview && (
        <div className="mt-5 animate-fade-up rounded-3xl border border-slate-200 bg-canvas/40 p-4">
          <div className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">With {preview.label}:</span>{' '}
            {preview.diff.filter((d) => d.outcomeFrom !== d.outcomeTo).length} decision(s) would change.
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 text-center text-xs">
            {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => {
              const delta = preview.counts[o] - preview.before[o];
              return (
                <div key={o} className="rounded-2xl border border-slate-200 p-2">
                  <div className="text-slate-500">{OUTCOME_LABEL[o]}</div>
                  <div className="text-lg font-semibold text-ink">
                    {preview.counts[o]} {delta !== 0 && <span className={delta > 0 ? 'text-emerald-700' : 'text-rose-700'}>({delta > 0 ? '+' : ''}{delta})</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3">
            <DiffList diff={preview.diff} max={15} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <input value={by} onChange={(e) => setBy(e.target.value)} placeholder="Your name" aria-label="Your name" className="rounded-full border border-slate-300 px-3 py-1.5 text-sm" />
            <Button variant="primary" disabled={by.trim().length < 2 || !!busy} onClick={() => call(false)}>
              {busy === 'apply' ? (
                <>
                  <Spinner /> Applying…
                </>
              ) : (
                'Apply as a new version'
              )}
            </Button>
            <span className="text-xs text-slate-500">Previous versions stay in History.</span>
          </div>
        </div>
      )}
    </section>
  );
}
