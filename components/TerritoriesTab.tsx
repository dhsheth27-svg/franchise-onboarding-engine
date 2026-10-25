'use client';

import type { RunResult } from '@/lib/engine/types';
import { Card } from './ui';

export default function TerritoriesTab({ result, onOpen }: { result: RunResult; onOpen: (key: string) => void }) {
  const byKey = new Map(result.decisions.map((d) => [d.key, d]));
  const link = (k: string) => (
    <button key={k} onClick={() => onOpen(k)} className="font-mono text-[13px] text-indigo-700 hover:underline">
      {byKey.get(k)?.applicationId ?? k}
    </button>
  );
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {result.territories.map((t) => {
        const unfilledHigh = t.priority === 'High' && t.unfilled > 0;
        return (
          <Card key={t.id} className={`p-4 ${unfilledHigh ? 'ring-2 ring-amber-400' : ''}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="text-base font-semibold text-stone-900">
                  {t.id} <span className="font-normal text-stone-500">· {t.city}</span>
                </h3>
                <p className="text-sm text-stone-500">
                  {t.tier} · {t.priority} priority
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-semibold tabular-nums text-stone-900">
                  {t.approved.length}
                  <span className="text-base font-normal text-stone-400"> / {t.realCapacity}</span>
                </div>
                <div className="text-xs text-stone-500">approved / real capacity</div>
              </div>
            </div>
            {unfilledHigh && (
              <p className="mt-2 rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-950">
                High priority with {t.unfilled} unfilled slot{t.unfilled === 1 ? '' : 's'}: worth recruiting here.
              </p>
            )}
            {t.realCapacity < t.openSlots && (
              <p className="mt-2 text-sm text-stone-600">
                {t.openSlots} open slots but only {t.freePinsAtStart.length} pin{t.freePinsAtStart.length === 1 ? '' : 's'} without a store, so at most {t.realCapacity} new store{t.realCapacity === 1 ? '' : 's'} can open.
              </p>
            )}
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
              <dt className="text-stone-500">Open slots</dt>
              <dd className="text-stone-800">
                {t.openSlots} ({t.slotsLeft} left)
              </dd>
              <dt className="text-stone-500">Pins</dt>
              <dd className="flex flex-wrap gap-1">
                {t.pins.map((p) => {
                  const store = t.existingStorePins.includes(p);
                  const used = t.pinsUsed[p];
                  return (
                    <span
                      key={p}
                      title={store ? 'Existing store' : used ? `Approved: ${used}` : 'Free'}
                      className={`rounded px-1.5 py-0.5 font-mono text-xs ${store ? 'bg-stone-200 text-stone-500 line-through' : used ? 'bg-emerald-100 text-emerald-900' : 'bg-white text-stone-700 ring-1 ring-inset ring-stone-300'}`}
                    >
                      {p}
                      {used ? ` · ${used}` : ''}
                    </span>
                  );
                })}
              </dd>
              <dt className="text-stone-500">Approved</dt>
              <dd className="flex flex-wrap gap-x-2">{t.approved.length ? t.approved.map(link) : <span className="text-stone-400">none</span>}</dd>
              <dt className="text-stone-500">Waitlisted</dt>
              <dd className="flex flex-wrap gap-x-2">{t.waitlisted.length ? t.waitlisted.map(link) : <span className="text-stone-400">none</span>}</dd>
              <dt className="text-stone-500">On hold</dt>
              <dd className="flex flex-wrap gap-x-2">{t.held.length ? t.held.map(link) : <span className="text-stone-400">none</span>}</dd>
            </dl>
            {t.issues.length > 0 && <p className="mt-2 text-xs text-amber-800">{t.issues.join(' ')}</p>}
          </Card>
        );
      })}
      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold text-stone-900">Existing stores</h3>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          {result.stores.map((s) => (
            <span key={s.storeId} className="rounded-md bg-stone-100 px-2 py-1 text-stone-700">
              {s.storeId} · {s.city} · <span className="font-mono text-xs">{s.pin}</span> · {s.openedYear}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">Legend: struck-out pins have an existing store; green pins are taken by an approval in this run; outlined pins are free.</p>
      </Card>
    </div>
  );
}
