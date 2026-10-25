'use client';

import { useState } from 'react';
import type { ActionItem, RunResult } from '@/lib/engine/types';
import { Button, Empty, fmtDate } from './ui';

const CATEGORIES: { id: ActionItem['category']; title: string; hint: string }[] = [
  { id: 'deadline', title: 'Deadlines this week', hint: 'Reservations and conditions that lapse within 7 days' },
  { id: 'hold', title: 'Send info requests', hint: 'Holds closest to an approval first; the message is ready in their language' },
  { id: 'risk', title: 'Call this week', hint: 'Approved partners at high risk of dropping off' },
  { id: 'redirect', title: 'Redirect instead of losing them', hint: 'Waitlisted or rejected applicants who fit a free slot elsewhere' },
  { id: 'recruit', title: 'Recruit', hint: 'High-priority territories with empty slots and nobody in line' },
  { id: 'data', title: 'Confirm data', hint: 'Contradictions and duplicates to check' },
];

export default function TodayTab({ result, onOpen, onDone, busy }: { result: RunResult; onOpen: (key: string) => void; onDone: (id: string, label: string) => void; busy: boolean }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const byKey = new Map(result.decisions.map((d) => [d.key, d]));
  const open = result.actions.filter((a) => !a.done);
  const done = result.actions.filter((a) => a.done);

  if (!result.actions.length) return <Empty>Nothing to do: no open actions.</Empty>;

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        <span className="font-semibold text-slate-900">{open.length} open action{open.length === 1 ? '' : 's'}</span>, ranked by value. Each comes with the reason and, where relevant, a ready-to-send message.
      </p>
      {CATEGORIES.map((c) => {
        const items = open.filter((a) => a.category === c.id);
        if (!items.length) return null;
        return (
          <section key={c.id}>
            <div className="mb-2 flex items-baseline gap-2">
              <h2 className="text-sm font-semibold text-slate-900">
                {c.title} <span className="font-normal text-slate-500">({items.length})</span>
              </h2>
              <span className="hidden text-xs text-slate-500 sm:inline">{c.hint}</span>
            </div>
            <ol className="space-y-2">
              {items.map((a) => {
                const d = a.applicationKey ? byKey.get(a.applicationKey) : undefined;
                return (
                  <li key={a.id} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900">{a.what}</div>
                        <p className="mt-0.5 text-sm text-slate-600">{a.why}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                          <span>Who: {a.who}</span>
                          <span className={a.deadline && a.deadline <= result.asOf ? 'font-medium text-rose-700' : ''}>By: {a.deadline ? fmtDate(a.deadline) : 'when possible'}</span>
                        </div>
                      </div>
                      <div className="flex flex-none flex-wrap gap-1.5">
                        {d && (
                          <Button variant="secondary" className="!py-1 text-xs" onClick={() => onOpen(d.key)}>
                            Open {d.applicationId}
                          </Button>
                        )}
                        {d?.message.text && (a.category === 'hold' || a.category === 'redirect' || a.category === 'deadline') && (
                          <Button
                            variant="secondary"
                            className="!py-1 text-xs"
                            onClick={() => navigator.clipboard?.writeText(d.message.text).then(() => setCopied(a.id))}
                            title={`Copy the ${d.message.language} message`}
                          >
                            {copied === a.id ? 'Copied' : `Copy message (${d.message.language})`}
                          </Button>
                        )}
                        <Button variant="ghost" className="!py-1 text-xs" disabled={busy} onClick={() => onDone(a.id, a.what)}>
                          Mark done
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      {done.length > 0 && (
        <section>
          <button className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setShowDone((v) => !v)}>
            {showDone ? 'Hide' : 'Show'} {done.length} completed
          </button>
          {showDone && (
            <ul className="mt-2 space-y-1 text-sm text-slate-500">
              {done.map((a) => (
                <li key={a.id} className="line-through">
                  {a.what}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
