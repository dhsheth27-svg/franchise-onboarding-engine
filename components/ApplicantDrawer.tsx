'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { ChecklistStatus, Decision, PlanStep, TraceStep } from '@/lib/engine/types';
import { emailLink, getSender, messageState, setSender, whatsappLink } from '@/lib/client-messaging';
import { Button, Collapsible, ConfidenceLabel, fmtDate, OUTCOME_LABEL, OutcomeChip, RiskLabel, Section, Tag } from './ui';

export interface DrawerActions {
  onClose: () => void;
  onOverride?: (d: Decision) => void;
  onChecklist?: (d: Decision, kind: 'onboarding' | 'document' | 'readiness', item: string, status: ChecklistStatus) => void;
  onMilestone?: (d: Decision, stage: string) => void;
  onMarkSent?: (d: Decision, channel: string, by: string) => void;
  printHref?: string;
  busy?: boolean;
  history?: ReactNode;
}

const RESULT_ICON: Record<TraceStep['result'], { sym: string; cls: string; label: string }> = {
  pass: { sym: '✓', cls: 'bg-emerald-100 text-emerald-800', label: 'Pass' },
  fail: { sym: '✕', cls: 'bg-rose-100 text-rose-800', label: 'Fail' },
  flag: { sym: '!', cls: 'bg-amber-100 text-amber-900', label: 'Flag' },
  info: { sym: 'i', cls: 'bg-slate-100 text-slate-600', label: 'Info' },
  skip: { sym: '–', cls: 'bg-slate-100 text-slate-400', label: 'Skipped' },
};

function ResultIcon({ r }: { r: TraceStep['result'] }) {
  const x = RESULT_ICON[r];
  return (
    <span title={x.label} aria-label={x.label} className={`mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full text-xs font-bold ${x.cls}`}>
      {x.sym}
    </span>
  );
}

const STATUSES: ChecklistStatus[] = ['Not started', 'In progress', 'Done', 'Blocked'];

function StatusSelect({ value, onChange, disabled, label }: { value: ChecklistStatus; onChange: (s: ChecklistStatus) => void; disabled?: boolean; label: string }) {
  const tone = value === 'Done' ? 'text-emerald-800 bg-emerald-50' : value === 'Blocked' ? 'text-rose-800 bg-rose-50' : value === 'In progress' ? 'text-sky-800 bg-sky-50' : 'text-slate-600 bg-surface';
  return (
    <select aria-label={label} disabled={disabled} value={value} onChange={(e) => onChange(e.target.value as ChecklistStatus)} className={`rounded border border-slate-300 px-1.5 py-0.5 text-xs ${tone}`}>
      {STATUSES.map((s) => (
        <option key={s}>{s}</option>
      ))}
    </select>
  );
}

export default function ApplicantDrawer({ d, actions }: { d: Decision; actions: DrawerActions }) {
  const panel = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showEnglish, setShowEnglish] = useState(false);

  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && actions.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [d.key, actions]);

  useEffect(() => {
    setCopied(false);
    setShowEnglish(false);
  }, [d.key]);

  const gates = d.trace.filter((t) => t.step === 'gate');
  const p = d.pillars;
  const msg = showEnglish ? d.message.english : d.message.text;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={`Application ${d.applicationId}`}>
      <button aria-label="Close" className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-sm" onClick={actions.onClose} />
      <div ref={panel} tabIndex={-1} className="relative h-full w-full max-w-2xl animate-slide-in overflow-y-auto border-l border-slate-200 bg-surface shadow-2xl focus:outline-none">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-surface/90 px-5 py-4 backdrop-blur sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-lg font-semibold text-slate-900">{d.applicationId}</h2>
                <OutcomeChip outcome={d.outcome} withdrawn={d.withdrawn} />
                {d.override?.status === 'applied' && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-800 ring-1 ring-inset ring-brand-600/20">
                    Overridden by {d.override.by}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {d.applicantName} · {d.city ?? 'city unknown'} {d.pin ? `· ${d.pin}` : ''} {d.territoryId ? `· ${d.territoryId}` : '· outside territories'} · prefers {d.language}
              </p>
            </div>
            <div className="flex flex-none items-center gap-2">
              {actions.printHref && (
                <a href={actions.printHref} target="_blank" rel="noopener noreferrer" className="hidden rounded-full px-3 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 transition hover:bg-ink hover:text-canvas sm:inline-flex">
                  Print
                </a>
              )}
              {actions.onOverride && (
                <Button onClick={() => actions.onOverride!(d)} disabled={actions.busy}>
                  Override
                </Button>
              )}
              <Button variant="ghost" onClick={actions.onClose}>
                <span aria-hidden>✕</span>
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>
          <p className="mt-2 text-sm font-medium text-slate-900">{d.oneLine}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              Score <span className="font-semibold tabular-nums text-slate-900">{d.score === null ? '—' : d.score.toFixed(1)}</span>
              {d.score !== null && d.provisionalScore && ' (provisional)'}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              Confidence <ConfidenceLabel value={d.confidence} />
            </span>
            {d.risk && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
                Risk <RiskLabel level={d.risk.level} />
              </span>
            )}
            {d.slotRank && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Slot #{d.slotRank} of {d.territorySlots}
              </span>
            )}
            {d.provisionalRank && (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                Would rank #{d.provisionalRank} of {d.territorySlots}
              </span>
            )}
            {d.waitlistPosition && <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">Waitlist #{d.waitlistPosition}</span>}
          </div>
        </div>

        {/* Summary */}
        <div className="px-5 py-4 sm:px-6">
          <p className="text-[15px] leading-relaxed text-slate-800">{d.summary}</p>
          {d.override && (
            <div className={`mt-3 rounded-md border p-3 text-sm ${d.override.status === 'applied' ? 'border-brand-200 bg-brand-50 text-brand-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
              {d.override.status === 'applied' ? (
                <>
                  <strong>Overridden by {d.override.by}</strong> on {fmtDate(d.override.at)}: &ldquo;{d.override.reason}&rdquo;. Original engine decision: <strong>{OUTCOME_LABEL[d.engineOutcome]}</strong>.
                  {d.override.released && <> {d.override.released} was released to make room.</>}
                </>
              ) : (
                <>
                  <strong>Override to {OUTCOME_LABEL[d.override.outcome]} refused.</strong> {d.override.conflict}
                </>
              )}
            </div>
          )}
        </div>

        {/* What would change / redirects */}
        {(d.whatWouldChange.length > 0 || d.redirects.length > 0) && (
          <Section title="What would change this">
            <ul className="space-y-2 text-sm">
              {d.whatWouldChange.map((c, i) => (
                <li key={`c${i}`} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                  <span className="text-slate-800">{c.sentence}</span>
                </li>
              ))}
            </ul>
            {d.redirects.length > 0 && (
              <div className="mt-3">
                <h4 className="mb-1.5 text-xs font-semibold text-slate-500">Redirect options (instead of losing this applicant)</h4>
                <ul className="space-y-1.5">
                  {d.redirects.map((r) => (
                    <li key={r.territoryId} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800">
                      {r.sentence}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Section>
        )}

        {/* Message */}
        {d.message.text && (
          <Section
            title={`Message to applicant · ${showEnglish ? 'English' : d.message.language}`}
            right={
              <div className="flex gap-1.5">
                {d.message.language !== 'English' && (
                  <Button variant="ghost" className="!py-0.5 text-xs" onClick={() => setShowEnglish((v) => !v)}>
                    {showEnglish ? `Show ${d.message.language}` : 'Show English'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  className="!py-0.5 text-xs"
                  onClick={() => {
                    navigator.clipboard?.writeText(msg).then(() => setCopied(true));
                  }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            }
          >
            <pre className="whitespace-pre-wrap rounded-2xl bg-slate-50 p-3 font-sans text-sm leading-relaxed text-slate-800">{msg}</pre>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <a href={whatsappLink(msg)} target="_blank" rel="noopener noreferrer" className="rounded-full px-3 py-1 text-xs font-medium text-emerald-800 ring-1 ring-emerald-300 transition hover:bg-emerald-50">
                Open in WhatsApp
              </a>
              <a href={emailLink(d, msg)} className="rounded-full px-3 py-1 text-xs font-medium text-sky-800 ring-1 ring-sky-300 transition hover:bg-sky-50">
                Open in email
              </a>
              {messageState(d) === 'sent' ? (
                <span className="text-xs text-emerald-800">
                  Sent {fmtDate(d.message.sent!.at)} via {d.message.sent!.channel} by {d.message.sent!.by}
                </span>
              ) : (
                actions.onMarkSent && (
                  <Button
                    variant="primary"
                    className="!py-1 text-xs"
                    disabled={actions.busy}
                    onClick={() => {
                      let by = getSender();
                      if (!by) {
                        by = (window.prompt('Your name (logged with the message):') ?? '').trim();
                        if (!by) return;
                        setSender(by);
                      }
                      actions.onMarkSent!(d, 'WhatsApp/Email', by);
                    }}
                  >
                    {messageState(d) === 'stale' ? 'Decision changed: mark new message sent' : 'Mark as sent'}
                  </Button>
                )
              )}
            </div>
            {d.message.language !== 'English' && <p className="mt-1.5 text-xs text-slate-500">Kannada and Hindi templates should be reviewed by a native speaker.</p>}
          </Section>
        )}

        {/* Conditions and reservation */}
        {(d.conditions.length > 0 || d.reservation) && (
          <Section title="Reservation and conditions">
            {d.reservation && (
              <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-slate-800">
                  Slot and pin {d.reservation.pin} reserved in {d.reservation.territoryId} until <strong>{fmtDate(d.reservation.deadline)}</strong>
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                    d.reservation.status === 'Fulfilled' ? 'bg-emerald-100 text-emerald-800' : d.reservation.status === 'Due soon' ? 'bg-amber-100 text-amber-900' : d.reservation.status === 'Expired' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {d.reservation.status}
                  {d.reservation.status !== 'Fulfilled' && ` · ${d.reservation.daysLeft} days left`}
                </span>
                {actions.onMilestone && d.reservation.status !== 'Fulfilled' && (
                  <Button variant="secondary" className="!py-0.5 text-xs" disabled={actions.busy} onClick={() => actions.onMilestone!(d, 'agreement')}>
                    Mark agreement signed
                  </Button>
                )}
              </div>
            )}
            {d.conditions.length > 0 && (
              <ul className="space-y-1.5 text-sm">
                {d.conditions.map((c) => (
                  <li key={c.code} className="flex items-start justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                    <span className="text-amber-950">{c.text}</span>
                    <span className="whitespace-nowrap text-xs text-amber-900">by {fmtDate(c.deadline)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        )}

        {/* Risk */}
        {d.risk && d.risk.reasons.length > 0 && (
          <Collapsible title="Drop-off risk" summary={`${d.risk.level} · ${d.risk.reasons[0]}`}>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
              {d.risk.reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            {d.risk.actions.length > 0 && (
              <p className="mt-2 text-sm text-slate-800">
                <span className="font-medium">Suggested: </span>
                {d.risk.actions.join('; ')}.
              </p>
            )}
          </Collapsible>
        )}

        {/* Onboarding */}
        {d.onboarding && (
          <Collapsible title="Onboarding plan" summary={`${d.onboarding.trainingTrack} training · opens ${fmtDate(d.onboarding.earliestOpening)}`}>
            <div className="mb-3 grid gap-2 text-sm sm:grid-cols-3">
              <div className="rounded-md bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Training</div>
                <div className="font-medium text-slate-900">
                  {d.onboarding.trainingTrack} · in {d.onboarding.trainingLanguage}
                </div>
              </div>
              <div className="rounded-md bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Earliest realistic opening</div>
                <div className="font-medium text-slate-900">{fmtDate(d.onboarding.earliestOpening)}</div>
              </div>
              <div className="rounded-md bg-slate-50 p-2.5">
                <div className="text-xs text-slate-500">Applicant&apos;s target</div>
                <div className="font-medium text-slate-900">{fmtDate(d.onboarding.targetOpening)}</div>
              </div>
            </div>
            <p className="mb-3 text-sm text-slate-700">{d.onboarding.timelineNote}</p>
            {d.onboarding.preconditions.length > 0 && (
              <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-950">
                <div className="font-medium">Must be resolved before the agreement</div>
                <ul className="mt-1 list-disc pl-5">
                  {d.onboarding.preconditions.map((c) => (
                    <li key={c.code}>
                      {c.text} <span className="text-amber-800">(by {fmtDate(c.deadline)})</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <ol className="space-y-1.5">
              {d.onboarding.steps.map((s: PlanStep) => (
                <li key={s.id} className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 rounded-md border border-slate-200 px-3 py-2 text-sm">
                  <span className="mt-0.5 w-16 text-xs tabular-nums text-slate-500">
                    Wk {s.startWeek}–{s.endWeek}
                  </span>
                  <div>
                    <div className="font-medium text-slate-900">
                      {s.stage} <span className="font-normal text-slate-500">· {s.owner}</span>
                    </div>
                    <div className="text-slate-600">{s.detail}</div>
                    {s.added && <div className="mt-0.5 text-xs text-brand-700">Added because {s.added}</div>}
                    <div className="mt-0.5 text-xs text-slate-500">Due {fmtDate(s.dueDate)}</div>
                  </div>
                  {actions.onChecklist ? (
                    <StatusSelect label={`Status of ${s.stage}`} value={s.status} disabled={actions.busy} onChange={(st) => actions.onChecklist!(d, 'onboarding', s.id, st)} />
                  ) : (
                    <span className="text-xs text-slate-500">{s.status}</span>
                  )}
                </li>
              ))}
            </ol>
          </Collapsible>
        )}

        {d.documents && d.documents.length > 0 && (
          <Collapsible title="Documents" summary={`${d.documents.filter((x) => x.status === 'Done').length}/${d.documents.length} received`}>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {d.documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                  <span className="text-slate-800">{doc.label}</span>
                  {actions.onChecklist ? <StatusSelect label={`Status of ${doc.label}`} value={doc.status} disabled={actions.busy} onChange={(st) => actions.onChecklist!(d, 'document', doc.id, st)} /> : <span className="text-xs">{doc.status}</span>}
                </li>
              ))}
            </ul>
          </Collapsible>
        )}

        {d.readiness && (
          <Collapsible title="Readiness to open" summary={`${d.readiness.percent}%`}>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-600" style={{ width: `${d.readiness.percent}%` }} />
            </div>
            <ul className="grid gap-1.5 sm:grid-cols-2">
              {d.readiness.items.map((it) => (
                <li key={it.id} className="flex items-center justify-between gap-2 rounded-md border border-slate-200 px-3 py-1.5 text-sm">
                  <span className="text-slate-800">{it.label}</span>
                  {actions.onChecklist ? <StatusSelect label={`Status of ${it.label}`} value={it.status} disabled={actions.busy} onChange={(st) => actions.onChecklist!(d, 'readiness', it.id, st)} /> : <span className="text-xs">{it.status}</span>}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">{d.readiness.readyToOpen ? 'Ready to open.' : 'The opening stage cannot be marked done until every item is done.'}</p>
          </Collapsible>
        )}

        {/* Score */}
        {p && (
          <Collapsible title="Score breakdown" summary={`${d.score?.toFixed(1)} / 100${d.provisionalScore ? ' (provisional)' : ''}`}>
            {d.scoreNote && <p className="mb-2 text-xs text-slate-500">{d.scoreNote}</p>}
            <div className="space-y-2.5">
              {[p.financial, p.operator, p.site, p.launch, p.territory].map((x) => (
                <div key={x.key}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium text-slate-800">{x.label}</span>
                    <span className="tabular-nums text-slate-600">
                      {x.points.toFixed(1)} <span className="text-slate-400">/ {x.weight}</span>
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${x.label}: ${x.raw} out of 100`}>
                    <div className={`h-full rounded-full ${x.raw >= 70 ? 'bg-brand-600' : x.raw >= 45 ? 'bg-brand-400' : 'bg-slate-400'}`} style={{ width: `${x.raw}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{x.explanation}</p>
                </div>
              ))}
              <div className="flex items-baseline justify-between border-t border-slate-100 pt-2 text-sm">
                <span className="font-medium text-slate-800">Cannibalisation deduction</span>
                <span className="tabular-nums text-rose-700">−{p.cannibalisationDeduction.points.toFixed(1)}</span>
              </div>
              <p className="text-xs text-slate-500">{p.cannibalisationDeduction.explanation}</p>
            </div>
          </Collapsible>
        )}

        {/* Gates */}
        <Collapsible title="Hard gates" summary={`${gates.filter((g) => g.result === 'pass').length} passed · ${gates.filter((g) => g.result === 'fail').length} failed`}>
          <ul className="space-y-1.5">
            {gates.map((g) => (
              <li key={g.check} className="flex gap-2.5 text-sm">
                <ResultIcon r={g.result} />
                <div>
                  <span className="font-medium text-slate-800">{g.check.replace(/^G\d /, '')}</span>
                  <span className="text-slate-600"> — {g.sentence}</span>
                </div>
              </li>
            ))}
          </ul>
        </Collapsible>

        {/* Flags */}
        {d.flags.length > 0 && (
          <Collapsible title="Data checks" summary={`${d.flags.length} note${d.flags.length === 1 ? '' : 's'}`}>
            <ul className="space-y-1.5">
              {d.flags.map((f, i) => (
                <li key={`${f.code}${i}`} className="flex gap-2.5 text-sm">
                  <span
                    className={`mt-0.5 flex-none rounded px-1.5 py-0.5 text-[11px] font-semibold ${f.severity === 'BLOCKING' ? 'bg-rose-100 text-rose-800' : f.severity === 'WARNING' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600'}`}
                  >
                    {f.severity === 'BLOCKING' ? 'Blocking' : f.severity === 'WARNING' ? 'Warning' : 'Info'}
                  </span>
                  <span className="text-slate-700">{f.message}</span>
                </li>
              ))}
            </ul>
            {d.cleaning.length > 0 && (
              <p className="mt-2 text-xs text-slate-500">Cleaned: {d.cleaning.map((c) => c.note).join('; ')}.</p>
            )}
            <p className="mt-1 text-xs text-slate-500">
              Free text read {d.signals.method === 'llm' ? 'by AI (validated)' : 'by keyword rules'}: background &ldquo;{d.signals.businessCategory}&rdquo; ({d.signals.relevance} relevance), commitment {d.signals.commitment}
              {d.signals.flexibleOnLocation ? ', flexible on location' : ''}.
            </p>
          </Collapsible>
        )}

        {actions.history}
        {/* Full trace */}
        <Collapsible title="Full decision trace" summary={`${d.trace.length} steps`}>
          <p className="mb-3 text-xs text-slate-500">Every check the engine ran, in order, with the values it used. The summary above is generated from these steps.</p>
          <ol className="space-y-1.5">
            {d.trace.map((t, i) => (
              <li key={i} className="flex gap-2.5 text-sm">
                <ResultIcon r={t.result} />
                <div className="min-w-0">
                  <div className="text-slate-800">
                    <span className="text-xs uppercase tracking-wide text-slate-500">{t.step}</span> <span className="font-medium">{t.check}</span>
                    {t.code && (
                      <span className="ml-1.5 align-middle">
                        <Tag>{t.code}</Tag>
                      </span>
                    )}
                  </div>
                  <div className="text-slate-600">{t.sentence}</div>
                </div>
              </li>
            ))}
          </ol>
        </Collapsible>

        <div className="h-8" />
      </div>
    </div>
  );
}
