'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { DiffEntry } from '@/lib/client-types';
import type { Decision } from '@/lib/engine/types';
import { DiffList } from './DiffBanner';
import { Button, Spinner } from './ui';

interface Msg {
  role: 'user' | 'assistant';
  text: string;
  focus?: string[];
  diff?: DiffEntry[];
  kind?: string;
  newRunId?: string;
  parsedBy?: string;
}

function linkify(text: string, keys: Map<string, string>, onOpen: (k: string) => void): ReactNode[] {
  const parts = text.split(/(\bAPP-\d{1,4}(?:#\d)?\b)/g);
  return parts.map((p, i) => {
    const key = keys.get(p.toUpperCase());
    return key ? (
      <button key={i} onClick={() => onOpen(key)} className="font-mono font-medium text-brand-700 underline-offset-2 hover:underline">
        {p}
      </button>
    ) : (
      <Fragment key={i}>{p}</Fragment>
    );
  });
}

function suggestions(decisions: Decision[]): string[] {
  const out: string[] = [];
  const noSpace = decisions.find((d) => d.outcome === 'HOLD' && d.primaryReason === 'SPACE_NOT_IDENTIFIED' && d.provisionalRank);
  const hold = decisions.find((d) => d.outcome === 'HOLD' && d !== noSpace) ?? noSpace;
  if (hold) out.push(`Why is ${hold.applicationId} on hold?`);
  const city = decisions.find((d) => d.outcome === 'APPROVED' || d.outcome === 'APPROVED_WITH_CONDITIONS')?.city;
  if (city) out.push(`Who got approved in ${city}?`);
  const target = decisions.find((d) => d.applicationId === 'APP-012' && d.primaryReason === 'SPACE_NOT_IDENTIFIED') ?? noSpace;
  if (target) out.push(`${target.applicationId} has found a ground-floor space of 400 sq ft`);
  const contested = decisions.find((d) => d.primaryReason === 'PIN_TAKEN_BY_HIGHER_RANK' && d.competitor);
  if (contested) out.push(`Why did ${contested.competitor!.id} beat ${contested.applicationId}?`);
  out.push('What should the team do today?');
  if (contested) out.push(`${contested.competitor!.id} has withdrawn`);
  out.push('Move forward 35 days');
  return out;
}

export default function AskPanel({ runId, decisions, open, onClose, onOpen }: { runId: string; decisions: Decision[]; open: boolean; onClose: () => void; onOpen: (key: string) => void }) {
  const router = useRouter();
  const params = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  const keys = useMemo(() => new Map(decisions.map((d) => [d.applicationId.toUpperCase(), d.key])), [decisions]);
  const prompts = useMemo(() => suggestions(decisions), [decisions]);

  useEffect(() => {
    fetch(`/api/runs/${runId}/followup`)
      .then((r) => r.json())
      .then((b: { messages?: { role: 'user' | 'assistant'; content: string }[] }) => {
        if (!b.messages) return;
        setMsgs((prev) => {
          const loaded: Msg[] = b.messages!.map((m) => {
            if (m.role === 'user') return { role: 'user', text: m.content };
            try {
              const j = JSON.parse(m.content);
              return { role: 'assistant', text: j.text, focus: j.focus, newRunId: j.newRunId };
            } catch {
              return { role: 'assistant', text: m.content };
            }
          });
          // keep a just-received diff on the last message
          const last = prev[prev.length - 1];
          if (last?.diff && loaded.length && loaded[loaded.length - 1].role === 'assistant') loaded[loaded.length - 1].diff = last.diff;
          return loaded.length >= prev.length ? loaded : prev;
        });
      })
      .catch(() => {});
  }, [runId]);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setInput('');
    setMsgs((m) => [...m, { role: 'user', text: message }]);
    setPending(true);
    try {
      const r = await fetch(`/api/runs/${runId}/followup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message }) });
      const body = await r.json();
      if (!r.ok) {
        setMsgs((m) => [...m, { role: 'assistant', text: body.error ?? 'Something went wrong.', kind: 'error' }]);
        return;
      }
      setMsgs((m) => [...m, { role: 'assistant', text: body.answerText, focus: body.focus, diff: body.diff, kind: body.kind, newRunId: body.newRunId, parsedBy: body.parsedBy }]);
      if (body.newRunId) {
        const q = new URLSearchParams(params.toString());
        q.set('changed', '1');
        if (body.focus?.[0]) q.set('a', body.focus[0]);
        router.push(`/run/${body.newRunId}?${q.toString()}`, { scroll: false });
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', text: 'Could not reach the server.', kind: 'error' }]);
    } finally {
      setPending(false);
    }
  }

  const panel = (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Ask or update</h2>
          <p className="text-xs text-slate-500">Questions are answered from the decision traces. Updates re-decide everyone and show what changed.</p>
        </div>
        <Button variant="ghost" className="xl:hidden" onClick={onClose}>
          ✕<span className="sr-only">Close</span>
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">Try one of these:</p>
            {prompts.map((p) => (
              <button key={p} onClick={() => send(p)} className="block w-full rounded-md border border-slate-200 px-3 py-2 text-left text-sm text-slate-800 transition hover:border-brand-300 hover:bg-brand-50">
                {p}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="ml-8 rounded-lg bg-brand-700 px-3 py-2 text-sm text-white">
              {m.text}
            </div>
          ) : (
            <div key={i} className={`mr-2 rounded-lg border px-3 py-2 text-sm ${m.kind === 'error' ? 'border-rose-200 bg-rose-50 text-rose-900' : m.kind === 'update' ? 'border-brand-200 bg-brand-50/50 text-slate-800' : 'border-slate-200 bg-slate-50 text-slate-800'}`}>
              {m.kind === 'update' && <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-700">Update saved as a new version</div>}
              <div className="whitespace-pre-wrap leading-relaxed">{linkify(m.text, keys, onOpen)}</div>
              {m.diff && m.diff.length > 0 && m.kind === 'answer' && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs font-medium text-slate-600">Would-be changes ({m.diff.length})</summary>
                  <div className="mt-1">
                    <DiffList diff={m.diff} onOpen={onOpen} max={8} />
                  </div>
                </details>
              )}
              {m.focus && m.focus.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {m.focus.map((k) => (
                    <button key={k} onClick={() => onOpen(k)} className="rounded border border-slate-300 bg-surface px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                      Open {decisions.find((d) => d.key === k)?.applicationId ?? k}
                    </button>
                  ))}
                </div>
              )}
              {m.parsedBy === 'llm' && <div className="mt-1 text-[10px] text-slate-400">Message understood with AI; answer built from the engine&apos;s trace.</div>}
            </div>
          ),
        )}
        {pending && (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Spinner /> Working…
          </div>
        )}
        <div ref={end} />
      </div>
      {msgs.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto border-t border-slate-100 px-4 py-2">
          {prompts.slice(0, 4).map((p) => (
            <button key={p} onClick={() => send(p)} disabled={pending} className="whitespace-nowrap rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-50/70">
              {p}
            </button>
          ))}
        </div>
      )}
      <form
        className="flex gap-2 border-t border-slate-200 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <label htmlFor="ask" className="sr-only">
          Ask a question or give an update
        </label>
        <input
          id="ask"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder='e.g. "APP-012 found a ground-floor space"'
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <Button type="submit" variant="primary" disabled={pending || !input.trim()}>
          Send
        </Button>
      </form>
    </div>
  );

  return (
    <>
      <aside className="sticky top-[49px] hidden h-[calc(100vh-49px)] w-[380px] flex-none border-l border-slate-200 xl:block">{panel}</aside>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end xl:hidden" role="dialog" aria-modal="true" aria-label="Ask panel">
          <button aria-label="Close" className="absolute inset-0 animate-fade-in bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <div className="relative h-full w-full max-w-md animate-slide-in shadow-2xl">{panel}</div>
        </div>
      )}
    </>
  );
}
