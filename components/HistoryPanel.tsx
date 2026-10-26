'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { VersionSummary } from '@/lib/client-types';
import type { ApplicantVersion } from '@/lib/store';
import { Button, Collapsible, OUTCOME_LABEL } from './ui';
import type { Outcome } from '@/lib/engine/types';

export default function HistoryPanel({ runId, currentId, onClose }: { runId: string; currentId: string; onClose: () => void }) {
  const [versions, setVersions] = useState<VersionSummary[] | null>(null);
  useEffect(() => {
    fetch(`/api/runs/${runId}/history`)
      .then((r) => r.json())
      .then((b) => setVersions(b.versions ?? []))
      .catch(() => setVersions([]));
  }, [runId]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Run history">
      <button aria-label="Close" className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative h-full w-full max-w-md animate-slide-in overflow-y-auto overscroll-contain border-l border-slate-200 bg-surface p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Run history</h2>
          <Button variant="ghost" onClick={onClose}>
            ✕<span className="sr-only">Close</span>
          </Button>
        </div>
        <p className="mt-1 text-sm text-slate-500">Every update, override and checklist change creates a new version. Nothing is overwritten.</p>
        {!versions ? (
          <p className="mt-6 text-sm text-slate-500">Loading…</p>
        ) : (
          <ol className="mt-4 space-y-2">
            {[...versions].reverse().map((v) => (
              <li key={v.id} className={`rounded-md border p-3 text-sm ${v.id === currentId ? 'border-brand-400 bg-brand-50' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/run/${v.id}`} className="font-semibold text-brand-700 hover:underline" onClick={onClose}>
                    v{v.version}
                  </Link>
                  <span className="text-xs text-slate-500">{new Date(v.createdAt).toLocaleString('en-IN')}</span>
                </div>
                <div className="mt-0.5 text-slate-800">{v.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {v.counts.APPROVED + v.counts.APPROVED_WITH_CONDITIONS} approved · {v.counts.HOLD} hold · {v.counts.WAITLISTED} waitlisted · {v.counts.REJECTED} rejected
                </div>
                {v.parentRunId && v.id !== currentId && (
                  <Link href={`/run/${v.id}?changed=1`} className="mt-1 inline-block text-xs text-brand-700 hover:underline" onClick={onClose}>
                    Open with before/after
                  </Link>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

export function ApplicantHistory({ runId, rootKey }: { runId: string; rootKey: string }) {
  const [rows, setRows] = useState<ApplicantVersion[] | null>(null);
  useEffect(() => {
    setRows(null);
    fetch(`/api/runs/${runId}/history?key=${encodeURIComponent(rootKey)}`)
      .then((r) => r.json())
      .then((b) => setRows(b.history ?? []))
      .catch(() => setRows([]));
  }, [runId, rootKey]);
  if (!rows || rows.length < 2) return null;
  return (
    <Collapsible title="History" summary={`${rows.length} versions`}>
      <ol className="space-y-1 text-sm">
        {rows.map((r, i) => {
          const changed = i > 0 && rows[i - 1].outcome !== r.outcome;
          return (
            <li key={r.runId} className="flex gap-2">
              <span className="w-8 flex-none text-xs tabular-nums text-slate-500">v{r.version}</span>
              <span className={changed ? 'font-medium text-brand-800' : 'text-slate-700'}>
                {r.outcome ? OUTCOME_LABEL[r.outcome as Outcome] : '—'}
                {r.score !== null ? ` · ${r.score.toFixed(1)}` : ''}
              </span>
              <span className="truncate text-xs text-slate-500">{r.label}</span>
            </li>
          );
        })}
      </ol>
    </Collapsible>
  );
}
