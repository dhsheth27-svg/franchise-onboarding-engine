'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { Decision, Outcome, RunResult } from '@/lib/engine/types';
import type { NewEvent } from '@/lib/runs';
import { Button, OUTCOME_LABEL, Spinner } from './ui';

const CHOICES: { value: Outcome | 'ENGINE'; label: string }[] = [
  { value: 'APPROVED', label: 'Approve' },
  { value: 'APPROVED_WITH_CONDITIONS', label: 'Approve with conditions' },
  { value: 'HOLD', label: 'Hold' },
  { value: 'WAITLISTED', label: 'Waitlist' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'ENGINE', label: 'Remove override (use engine decision)' },
];

export default function OverrideDialog({
  d,
  decisions,
  onCancel,
  onSubmit,
}: {
  d: Decision;
  decisions: Decision[];
  onCancel: () => void;
  onSubmit: (ev: NewEvent) => Promise<{ ok: boolean; error?: string }>;
}) {
  const { id } = useParams<{ id: string }>();
  const [outcome, setOutcome] = useState<Outcome | 'ENGINE'>(d.outcome === 'APPROVED' || d.outcome === 'APPROVED_WITH_CONDITIONS' ? 'HOLD' : 'APPROVED');
  const [reason, setReason] = useState('');
  const [by, setBy] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [conflict, setConflict] = useState<{ text: string; options: Decision[] } | null>(null);
  const [release, setRelease] = useState<string>('');

  const valid = reason.trim().length >= 10 && by.trim().length > 0;
  const event = (rel?: string): NewEvent => ({
    type: 'override',
    applicationId: d.key,
    payload: { outcome, ...(rel ? { releaseApplicationId: rel } : {}) },
    reason: reason.trim(),
    by: by.trim(),
  });

  async function submit() {
    setError(null);
    if (!valid) {
      setError('Please give your name and a reason of at least 10 characters.');
      return;
    }
    // Forced approvals are checked first against the hard rules (dry run), so a conflict can be shown here.
    if ((outcome === 'APPROVED' || outcome === 'APPROVED_WITH_CONDITIONS') && !conflict) {
      setChecking(true);
      try {
        const r = await fetch(`/api/runs/${id}/events`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: [event()], dryRun: true }) });
        const body = (await r.json()) as { result?: RunResult; error?: string };
        const after = body.result?.decisions.find((x) => x.key === d.key);
        if (after?.override?.status === 'refused') {
          const sameTerritory = decisions.filter((x) => (x.outcome === 'APPROVED' || x.outcome === 'APPROVED_WITH_CONDITIONS') && x.territoryId && x.territoryId === d.territoryId && x.key !== d.key);
          const pinHolder = sameTerritory.filter((x) => x.pin === d.pin);
          const releasable = after.override.conflict?.includes('existing store') || after.override.conflict?.includes('outside every territory') || after.override.conflict?.includes('no valid pin') ? [] : pinHolder.length ? pinHolder : sameTerritory;
          setConflict({ text: after.override.conflict ?? 'This override would break a hard rule.', options: releasable });
          setRelease(releasable[0]?.key ?? '');
          return;
        }
      } catch {
        // fall through: the engine re-checks on save anyway
      } finally {
        setChecking(false);
      }
    }
    const res = await onSubmit(event(conflict && release ? release : undefined));
    if (!res.ok) setError(res.error ?? 'Could not save the override.');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={`Override ${d.applicationId}`}>
      <button aria-label="Cancel" className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-lg animate-scale-in rounded-t-3xl border border-slate-200 bg-surface p-6 shadow-2xl sm:rounded-3xl">
        <h2 className="text-lg font-semibold text-slate-900">Override {d.applicationId}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Engine decision: <strong>{OUTCOME_LABEL[d.engineOutcome]}</strong>. Your override is logged with your name and reason. The three hard rules still apply: one store per pin, never more approvals than slots, never outside the territories.
        </p>

        {!conflict ? (
          <div className="mt-4 space-y-3">
            <fieldset>
              <legend className="text-sm font-medium text-slate-800">New decision</legend>
              <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                {CHOICES.filter((c) => c.value !== 'ENGINE' || d.override).map((c) => (
                  <label key={c.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${outcome === c.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                    <input type="radio" name="outcome" checked={outcome === c.value} onChange={() => setOutcome(c.value)} />
                    {c.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Reason (at least 10 characters)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="e.g. Met the applicant; strong local reputation" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-800">Your name</span>
              <input value={by} onChange={(e) => setBy(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none" placeholder="e.g. Asha (Expansion)" />
            </label>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
              <strong>This override would break a hard rule.</strong> {conflict.text}
            </div>
            {conflict.options.length > 0 ? (
              <fieldset>
                <legend className="text-sm font-medium text-slate-800">To go ahead, release one approval (it is also logged):</legend>
                <div className="mt-1.5 space-y-1.5">
                  {conflict.options.map((o) => (
                    <label key={o.key} className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm ${release === o.key ? 'border-brand-500 bg-brand-50' : 'border-slate-200'}`}>
                      <input type="radio" name="release" checked={release === o.key} onChange={() => setRelease(o.key)} />
                      <span>
                        Release <strong>{o.applicationId}</strong> (pin {o.pin}, score {o.score?.toFixed(1)}) — they move to the waitlist
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : (
              <p className="text-sm text-slate-700">This conflict cannot be resolved by releasing another applicant. You can cancel, or log the refused attempt so the decision history shows it.</p>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-sm text-rose-700">{error}</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={onCancel}>Cancel</Button>
          {conflict && conflict.options.length === 0 && (
            <Button variant="secondary" onClick={() => onSubmit(event()).then((r) => !r.ok && setError(r.error ?? 'Failed'))}>
              Log refused attempt
            </Button>
          )}
          {conflict && conflict.options.length > 0 ? (
            <Button variant="danger" disabled={!release} onClick={submit}>
              Release and approve
            </Button>
          ) : !conflict ? (
            <Button variant="primary" disabled={!valid || checking} onClick={submit}>
              {checking ? (
                <>
                  <Spinner /> Checking rules…
                </>
              ) : (
                'Apply override'
              )}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
