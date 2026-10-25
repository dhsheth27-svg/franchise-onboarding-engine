'use client';

import { useEffect, useState } from 'react';
import type { RunPayload } from '@/lib/client-types';
import type { Decision } from '@/lib/engine/types';

// A light, printable one-pager for an approval committee or the partner file. Colours are explicit
// hex values because the app's theme palette is tuned for the dark screen design.
const OUT: Record<string, string> = { APPROVED: 'Approved', APPROVED_WITH_CONDITIONS: 'Approved with conditions', HOLD: 'On hold', WAITLISTED: 'Waitlisted', REJECTED: 'Rejected' };
const fmt = (iso?: string | null) => (iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <tr className="border-b border-[#e5e5ea]">
      <td className="w-48 py-1.5 pr-4 align-top text-[#6b6b76]">{k}</td>
      <td className="py-1.5 text-[#111]">{v}</td>
    </tr>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 border-b-2 border-[#111] pb-1 text-xs font-bold uppercase tracking-[0.14em] text-[#111]">{children}</h2>;
}

export default function PrintPage({ params }: { params: { id: string; key: string } }) {
  const [run, setRun] = useState<RunPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    fetch(`/api/runs/${params.id}`)
      .then(async (r) => (r.ok ? r.json() : Promise.reject((await r.json()).error)))
      .then(setRun)
      .catch((e) => setError(String(e)));
  }, [params.id]);
  const key = decodeURIComponent(params.key);
  const d: Decision | undefined = run?.result.decisions.find((x) => x.key === key);

  if (error || (run && !d)) return <div className="min-h-screen bg-white p-10 text-[#111]">{error ?? `Application ${key} not found in this run.`}</div>;
  if (!run || !d) return <div className="min-h-screen bg-white p-10 text-[#6b6b76]">Loading…</div>;
  const a = d.application;
  const p = d.pillars;

  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-white text-[#111] print:static">
      <div className="mx-auto max-w-3xl px-8 py-10 text-[13px] leading-relaxed">
        <div className="mb-6 flex items-center justify-between print:hidden">
          <a href={`/run/${params.id}?a=${encodeURIComponent(d.key)}`} className="text-sm text-[#5b3df5] underline">
            ← Back to the run
          </a>
          <button onClick={() => window.print()} className="rounded-full bg-[#111] px-4 py-1.5 text-sm font-semibold text-white">
            Print / save as PDF
          </button>
        </div>

        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-xs uppercase tracking-[0.14em] text-[#6b6b76]">Franchise application · decision summary</div>
            <h1 className="mt-1 text-3xl font-bold">
              {d.applicationId} · {d.applicantName}
            </h1>
            <div className="text-[#6b6b76]">
              {d.city} · pin {d.pin ?? '—'} · {d.territoryId ?? 'outside territories'} · prefers {d.language}
            </div>
          </div>
          <div className="rounded-xl border-2 border-[#111] px-4 py-2 text-right">
            <div className="text-xs uppercase tracking-wider text-[#6b6b76]">Decision</div>
            <div className="text-lg font-bold">{d.withdrawn ? 'Withdrawn' : OUT[d.outcome]}</div>
            <div className="text-xs text-[#6b6b76]">as of {fmt(run.result.asOf)} · v{run.version}</div>
          </div>
        </div>

        <p className="mt-5 rounded-lg bg-[#f4f4f6] p-4 text-[14px]">{d.summary}</p>
        {d.override && (
          <p className="mt-2 text-[#5b3df5]">
            Override {d.override.status === 'applied' ? 'applied' : 'refused'} by {d.override.by} on {fmt(d.override.at)}: “{d.override.reason}”. Engine decision: {OUT[d.engineOutcome]}.
          </p>
        )}

        <H>Application</H>
        <table className="w-full">
          <tbody>
            <Row k="Investment capacity" v={a.investmentLakh !== null ? `₹${a.investmentLakh} lakh` : '—'} />
            <Row k="Retail experience" v={a.experienceYears !== null ? `${a.experienceYears} years` : '—'} />
            <Row k="Business background" v={`${a.business || '—'} (${a.signals.relevance} relevance)`} />
            <Row k="Shop space" v={a.space ? `${a.space}${a.spaceSqft ? `, ${a.spaceSqft} sq ft` : ''}${a.floor ? `, ${a.floor}` : ''}` : '—'} />
            <Row k="Target launch" v={`${a.effectiveLaunchMonths} months${a.targetLaunchMonths === null ? ' (default)' : ''}`} />
            {a.notes && <Row k="Applicant notes" v={a.notes} />}
          </tbody>
        </table>

        {p && (
          <>
            <H>
              Score {d.score?.toFixed(1)} / 100{d.provisionalScore ? ' (provisional)' : ''} · confidence {d.confidence}
              {d.risk ? ` · drop-off risk ${d.risk.level}` : ''}
            </H>
            <table className="w-full">
              <tbody>
                {[p.financial, p.operator, p.site, p.launch, p.territory].map((x) => (
                  <Row key={x.key} k={`${x.label} (${x.points.toFixed(1)}/${x.weight})`} v={x.explanation} />
                ))}
                <Row k={`Cannibalisation (−${p.cannibalisationDeduction.points.toFixed(1)})`} v={p.cannibalisationDeduction.explanation} />
              </tbody>
            </table>
          </>
        )}

        <H>Checks</H>
        <table className="w-full">
          <tbody>
            {d.trace
              .filter((t) => t.step === 'gate')
              .map((t) => (
                <Row key={t.check} k={`${t.result === 'pass' ? '✓' : t.result === 'fail' ? '✕' : '–'} ${t.check.replace(/^G\d /, '')}`} v={t.sentence} />
              ))}
            {d.flags.map((f, i) => (
              <Row key={i} k={f.severity === 'BLOCKING' ? 'Blocking issue' : f.severity === 'WARNING' ? 'Warning' : 'Note'} v={f.message} />
            ))}
          </tbody>
        </table>

        {(d.conditions.length > 0 || d.reservation || d.whatWouldChange.length > 0 || d.redirects.length > 0) && (
          <>
            <H>Next steps</H>
            <ul className="list-disc space-y-1 pl-5">
              {d.reservation && (
                <li>
                  Slot and pin {d.reservation.pin} reserved until {fmt(d.reservation.deadline)} ({d.reservation.status}).
                </li>
              )}
              {d.conditions.map((c) => (
                <li key={c.code}>
                  {c.text} (by {fmt(c.deadline)})
                </li>
              ))}
              {d.whatWouldChange.map((c, i) => (
                <li key={i}>{c.sentence}</li>
              ))}
              {d.redirects.map((r) => (
                <li key={r.territoryId}>{r.sentence}</li>
              ))}
            </ul>
          </>
        )}

        {d.onboarding && (
          <>
            <H>
              Onboarding plan · {d.onboarding.trainingTrack} training in {d.onboarding.trainingLanguage} · earliest opening {fmt(d.onboarding.earliestOpening)}
            </H>
            <table className="w-full">
              <tbody>
                {d.onboarding.steps.map((s) => (
                  <Row key={s.id} k={`Wk ${s.startWeek}–${s.endWeek} · ${s.status}`} v={`${s.stage} (${s.owner}), due ${fmt(s.dueDate)}`} />
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[#6b6b76]">{d.onboarding.timelineNote}</p>
          </>
        )}

        <div className="mt-10 grid grid-cols-2 gap-10 text-[#6b6b76]">
          <div className="border-t border-[#111] pt-1">Reviewed by (name, date)</div>
          <div className="border-t border-[#111] pt-1">Approved by (name, date)</div>
        </div>
        <p className="mt-6 text-[11px] text-[#9a9aa4]">Generated by Opsmith from the decision trace. Thresholds are team assumptions; see Rules &amp; policy in the run.</p>
      </div>
    </div>
  );
}
