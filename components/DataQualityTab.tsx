'use client';

import type { RunResult } from '@/lib/engine/types';
import { Card, Empty } from './ui';

const SEV = {
  BLOCKING: 'bg-rose-100 text-rose-800',
  WARNING: 'bg-amber-100 text-amber-900',
  INFO: 'bg-stone-100 text-stone-600',
} as const;

export default function DataQualityTab({ result, importNotes, onOpen }: { result: RunResult; importNotes: string[]; onOpen: (key: string) => void }) {
  const fileIssues = result.dataIssues.filter((i) => i.scope !== 'application');
  const apps = result.decisions.filter((d) => d.flags.length || d.cleaning.length);
  const counts = { BLOCKING: 0, WARNING: 0, INFO: 0 };
  for (const d of result.decisions) for (const f of d.flags) counts[f.severity]++;
  const cleaned = result.decisions.reduce((n, d) => n + d.cleaning.length, 0);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Blocking (on hold)', counts.BLOCKING, 'text-rose-800'],
          ['Warnings (conditions)', counts.WARNING, 'text-amber-900'],
          ['Info notes', counts.INFO, 'text-stone-700'],
          ['Values cleaned', cleaned, 'text-stone-700'],
        ].map(([l, n, c]) => (
          <Card key={l as string} className="px-3 py-2">
            <div className={`text-2xl font-semibold tabular-nums ${c}`}>{n as number}</div>
            <div className="text-xs text-stone-500">{l as string}</div>
          </Card>
        ))}
      </div>

      {(fileIssues.length > 0 || importNotes.length > 0) && (
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-stone-900">File and territory issues</h3>
          <ul className="mt-2 space-y-1.5 text-sm">
            {importNotes.map((n) => (
              <li key={n} className="flex gap-2">
                <span className={`mt-0.5 h-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEV.INFO}`}>Info</span>
                <span className="text-stone-700">{n}</span>
              </li>
            ))}
            {fileIssues.map((i, idx) => (
              <li key={idx} className="flex gap-2">
                <span className={`mt-0.5 h-fit rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEV[i.severity]}`}>{i.severity === 'WARNING' ? 'Warning' : i.severity === 'BLOCKING' ? 'Blocking' : 'Info'}</span>
                <span className="text-stone-700">
                  <span className="font-mono text-xs text-stone-500">{i.ref}</span> {i.message}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="px-4 pt-4">
          <h3 className="text-sm font-semibold text-stone-900">Per applicant: what was cleaned, inferred, missing or contradictory</h3>
        </div>
        {apps.length === 0 ? (
          <div className="p-4">
            <Empty>No data problems found.</Empty>
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-stone-100">
            {apps.map((d) => (
              <li key={d.key} className="px-4 py-3">
                <button onClick={() => onOpen(d.key)} className="font-mono text-sm font-medium text-indigo-700 hover:underline">
                  {d.applicationId}
                  {d.rowNumber ? <span className="ml-1 font-sans text-xs font-normal text-stone-500">row {d.rowNumber}</span> : null}
                </button>
                <ul className="mt-1 space-y-1 text-sm">
                  {d.flags.map((f, i) => (
                    <li key={i} className="flex gap-2">
                      <span className={`mt-0.5 h-fit flex-none rounded px-1.5 py-0.5 text-[10px] font-semibold ${SEV[f.severity]}`}>{f.severity === 'WARNING' ? 'Warning' : f.severity === 'BLOCKING' ? 'Blocking' : 'Info'}</span>
                      <span className="text-stone-700">{f.message}</span>
                    </li>
                  ))}
                  {d.cleaning.map((c, i) => (
                    <li key={`c${i}`} className="flex gap-2">
                      <span className="mt-0.5 h-fit flex-none rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-800">Cleaned</span>
                      <span className="text-stone-700">
                        {c.field}: {c.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
