'use client';

import { useMemo, useState } from 'react';
import { emailLink, getSender, messageState, setSender, whatsappLink, type MessageState } from '@/lib/client-messaging';
import type { Decision, Language, Outcome } from '@/lib/engine/types';
import { Empty, OUTCOME_LABEL, OutcomeChip, fmtDate } from './ui';

const ORDER: Record<Outcome, number> = { HOLD: 0, APPROVED_WITH_CONDITIONS: 1, APPROVED: 2, WAITLISTED: 3, REJECTED: 4 };
const STATE_LABEL: Record<MessageState, string> = { 'to-send': 'To send', sent: 'Sent', stale: 'Out of date' };

export default function OutboxTab({ decisions, onOpen, onMarkSent, busy }: { decisions: Decision[]; onOpen: (key: string) => void; onMarkSent: (d: Decision, channel: string, by: string) => void; busy: boolean }) {
  const [state, setState] = useState<MessageState | 'all'>('to-send');
  const [lang, setLang] = useState<Language | ''>('');
  const [outcome, setOutcome] = useState<Outcome | ''>('');
  const [copied, setCopied] = useState<string | null>(null);
  const [sender, setSenderState] = useState(getSender);

  const live = decisions.filter((d) => !d.withdrawn && d.message.text);
  const counts = { 'to-send': 0, sent: 0, stale: 0 } as Record<MessageState, number>;
  for (const d of live) counts[messageState(d)]++;
  const rows = useMemo(
    () =>
      live
        .filter((d) => (state === 'all' || messageState(d) === state || (state === 'to-send' && messageState(d) === 'stale')) && (!lang || d.language === lang) && (!outcome || d.outcome === outcome))
        .sort((a, b) => ORDER[a.outcome] - ORDER[b.outcome] || (a.provisionalRank ?? 99) - (b.provisionalRank ?? 99)),
    [live, state, lang, outcome],
  );

  const mark = (d: Decision, channel: string) => {
    let by = sender;
    if (!by) {
      by = (window.prompt('Your name (logged with each message you mark as sent):') ?? '').trim();
      if (!by) return;
      setSender(by);
      setSenderState(by);
    }
    onMarkSent(d, channel, by);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {(['to-send', 'stale', 'sent'] as MessageState[]).map((s) => (
          <button
            key={s}
            onClick={() => setState(s)}
            className={`rounded-3xl border p-4 text-left shadow-card backdrop-blur-xl transition hover:-translate-y-0.5 ${state === s ? 'border-brand-600 bg-brand-50' : 'border-slate-200 bg-surface/75 hover:border-slate-300'}`}
          >
            <div className="text-3xl font-display text-ink">{counts[s]}</div>
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{STATE_LABEL[s]}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={state} onChange={(e) => setState(e.target.value as MessageState | 'all')} aria-label="Message status" className="rounded-full border border-slate-300 px-3 py-1.5">
          <option value="to-send">To send (incl. out of date)</option>
          <option value="stale">Out of date only</option>
          <option value="sent">Sent</option>
          <option value="all">All</option>
        </select>
        <select value={lang} onChange={(e) => setLang(e.target.value as Language | '')} aria-label="Language" className="rounded-full border border-slate-300 px-3 py-1.5">
          <option value="">All languages</option>
          <option>Kannada</option>
          <option>English</option>
          <option>Hindi</option>
        </select>
        <select value={outcome} onChange={(e) => setOutcome(e.target.value as Outcome | '')} aria-label="Outcome" className="rounded-full border border-slate-300 px-3 py-1.5">
          <option value="">All outcomes</option>
          {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
        <span className="ml-auto text-xs text-slate-500">
          {sender ? (
            <>
              Sending as <span className="text-slate-800">{sender}</span>{' '}
              <button className="underline hover:text-brand-700" onClick={() => { setSender(''); setSenderState(''); }}>
                change
              </button>
            </>
          ) : (
            'You will be asked for your name the first time you mark a message as sent.'
          )}
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>Nothing here. {state === 'to-send' ? 'Every current message has been sent.' : ''}</Empty>
      ) : (
        <ul className="space-y-3">
          {rows.map((d, i) => {
            const st = messageState(d);
            return (
              <li key={d.key} className="group animate-fade-up rounded-3xl border border-slate-200 bg-surface/75 p-4 shadow-card backdrop-blur-xl transition hover:border-slate-300" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                <div className="flex flex-wrap items-center gap-2">
                  <button onClick={() => onOpen(d.key)} className="font-mono text-sm font-semibold text-slate-900 hover:text-brand-700">
                    {d.applicationId}
                  </button>
                  <span className="text-sm text-slate-600">{d.applicantName}</span>
                  <OutcomeChip outcome={d.outcome} size="sm" />
                  <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs text-slate-600">{d.language}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${st === 'sent' ? 'bg-emerald-50 text-emerald-800' : st === 'stale' ? 'bg-amber-50 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                    {st === 'sent' ? `Sent ${fmtDate(d.message.sent!.at)} · ${d.message.sent!.channel} · ${d.message.sent!.by}` : st === 'stale' ? 'Decision changed since it was sent: send the new message' : 'Not sent yet'}
                  </span>
                </div>
                <p className="mt-2 line-clamp-2 whitespace-pre-line text-sm text-slate-600">{d.message.text.split('\n').slice(2).join(' ')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={() => navigator.clipboard?.writeText(d.message.text).then(() => setCopied(d.key))}
                    className="rounded-full px-3 py-1 text-xs font-medium text-slate-800 ring-1 ring-slate-300 transition hover:bg-ink hover:text-canvas"
                  >
                    {copied === d.key ? 'Copied' : 'Copy'}
                  </button>
                  <a href={whatsappLink(d.message.text)} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300 transition hover:bg-emerald-50">
                    WhatsApp
                  </a>
                  <a href={emailLink(d, d.message.text)} className="rounded-full px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-300 transition hover:bg-sky-50">
                    Email
                  </a>
                  {st !== 'sent' && (
                    <span className="ml-auto flex gap-1.5">
                      {['WhatsApp', 'Email', 'Phone'].map((ch) => (
                        <button key={ch} disabled={busy} onClick={() => mark(d, ch)} className="rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white shadow-btn transition hover:bg-brand-500 disabled:opacity-50">
                          Sent via {ch}
                        </button>
                      ))}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-slate-500">WhatsApp and Email open your own app with the message filled in; nothing is sent from here. Kannada and Hindi templates should be reviewed by a native speaker.</p>
    </div>
  );
}
