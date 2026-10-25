'use client';

import { HARD_RULES, type Config } from '@/lib/config';
import { Card } from './ui';

function fmtValue(v: unknown): string {
  if (Array.isArray(v)) return v.join('–');
  if (v && typeof v === 'object')
    return Object.entries(v as Record<string, unknown>)
      .map(([k, x]) => `${k}: ${fmtValue(x)}`)
      .join(' · ');
  return String(v);
}

const GATES = [
  ['G1', 'No blocking data problems', 'On hold, with exactly what is missing'],
  ['G2', 'Pin is inside a target territory', 'Rejected, with redirects to territories that have room'],
  ['G3', 'No existing store in that pin', 'Rejected, with redirects to free pins'],
  ['G4', 'Territory has open slots', 'Waitlisted, with redirects'],
  ['G5', 'Investment meets the tier minimum', 'Short by 25% or less: on hold (exact gap stated). More: rejected'],
  ['G6', 'Shop space identified (owned or rented)', 'On hold, still scored and ranked provisionally'],
  ['G7', 'Space meets the tier minimum size', 'On hold'],
];

export default function RulesTab({ config }: { config: Config }) {
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-base font-semibold text-stone-900">The three hard rules</h2>
        <p className="mt-1 text-sm text-stone-600">Checked after allocation, after every override and after every follow-up. Nothing, not even a human override, can break them.</p>
        <ol className="mt-3 space-y-2">
          {HARD_RULES.map((r, i) => (
            <li key={r} className="flex gap-3 text-sm">
              <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-indigo-700 text-xs font-semibold text-white">{i + 1}</span>
              <span className="pt-0.5 font-medium text-stone-900">{r}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card className="p-5">
        <h2 className="text-base font-semibold text-stone-900">How a decision is made</h2>
        <ol className="mt-2 grid gap-2 text-sm text-stone-700 sm:grid-cols-5">
          {['Clean and check the data', 'Hard gates (all 7 checked, first failure decides)', 'Score 0–100 on five areas', 'Allocate slots in rank order, one store per pin', 'Plans, deadlines, risk, messages, today’s actions'].map((s, i) => (
            <li key={s} className="rounded-md bg-stone-50 p-3">
              <div className="text-xs font-semibold text-indigo-700">Step {i + 1}</div>
              {s}
            </li>
          ))}
        </ol>
        <h3 className="mt-5 text-sm font-semibold text-stone-900">Hard gates</h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <tbody className="divide-y divide-stone-100">
              {GATES.map(([g, check, fail]) => (
                <tr key={g}>
                  <td className="py-2 pr-3 font-mono text-xs text-stone-500">{g}</td>
                  <td className="py-2 pr-3 font-medium text-stone-800">{check}</td>
                  <td className="py-2 text-stone-600">If not: {fail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-stone-600">
          If gates pass but the score is under the bar, the applicant is rejected, or held with a clear fix when they are within the near-miss margin. Ties are broken by: owned over rented space, more experience, more money relative to the minimum, then the lower application ID. Names and personal details are never used in scoring.
        </p>
      </Card>

      <Card className="overflow-hidden">
        <div className="px-5 pt-5">
          <h2 className="text-base font-semibold text-stone-900">Thresholds, weights and assumptions</h2>
          <p className="mt-1 text-sm text-stone-600">These are team assumptions, each with the reason behind it. Changing them in one file changes every decision.</p>
        </div>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-5 py-2 text-left text-xs font-semibold text-stone-500">Setting</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-stone-500">Value</th>
                <th className="px-5 py-2 text-left text-xs font-semibold text-stone-500">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {Object.entries(config).map(([k, a]) => (
                <tr key={k} className="align-top">
                  <td className="px-5 py-2.5 font-medium text-stone-800">{a.label}</td>
                  <td className="max-w-xs px-3 py-2.5 font-mono text-xs text-stone-700">{fmtValue(a.value)}</td>
                  <td className="px-5 py-2.5 text-stone-600">{a.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
