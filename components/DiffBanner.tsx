'use client';

import { useEffect, useState } from 'react';
import type { DiffEntry } from '@/lib/client-types';
import { Button } from './ui';

export function DiffList({ diff, onOpen, max = 12 }: { diff: DiffEntry[]; onOpen?: (key: string) => void; max?: number }) {
  const moved = diff.filter((d) => d.outcomeFrom !== d.outcomeTo);
  const other = diff.filter((d) => d.outcomeFrom === d.outcomeTo);
  if (!diff.length) return <p className="text-sm text-stone-600">No decision changed.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {[...moved, ...other].slice(0, max).map((d) => (
        <li key={d.key} className="flex gap-2">
          <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 flex-none rounded-full ${d.outcomeFrom !== d.outcomeTo ? 'bg-indigo-600' : 'bg-stone-300'}`} />
          <span className="text-stone-800">
            {onOpen ? (
              <button className="font-mono font-medium text-indigo-700 hover:underline" onClick={() => onOpen(d.key)}>
                {d.applicationId}
              </button>
            ) : (
              <span className="font-mono font-medium">{d.applicationId}</span>
            )}
            : {d.changes.map((c) => `${c.field} ${c.from} → ${c.to}`).join('; ')}
          </span>
        </li>
      ))}
      {diff.length > max && <li className="text-xs text-stone-500">…and {diff.length - max} more changes.</li>}
    </ul>
  );
}

export default function DiffBanner({ runId, onOpen, onClose }: { runId: string; onOpen: (key: string) => void; onClose: () => void }) {
  const [state, setState] = useState<{ from: { version: number; label: string } | null; diff: DiffEntry[] } | null>(null);
  useEffect(() => {
    fetch(`/api/runs/${runId}/diff`)
      .then((r) => r.json())
      .then(setState)
      .catch(() => setState(null));
  }, [runId]);
  if (!state?.from) return null;
  return (
    <div className="mt-4 rounded-lg border border-indigo-200 bg-indigo-50/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-sm font-semibold text-indigo-950">
          What changed since v{state.from.version} ({state.diff.filter((d) => d.outcomeFrom !== d.outcomeTo).length} decision{state.diff.filter((d) => d.outcomeFrom !== d.outcomeTo).length === 1 ? '' : 's'} moved)
        </h2>
        <Button variant="ghost" className="!py-0.5 text-xs" onClick={onClose}>
          Dismiss
        </Button>
      </div>
      <div className="mt-2">
        <DiffList diff={state.diff} onOpen={onOpen} />
      </div>
    </div>
  );
}
