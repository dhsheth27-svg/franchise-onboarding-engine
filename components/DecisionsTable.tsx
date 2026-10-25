'use client';

import { useMemo, useState } from 'react';
import type { Decision, Outcome } from '@/lib/engine/types';
import { ConfidenceLabel, Empty, OUTCOME_LABEL, OutcomeChip, RiskLabel } from './ui';

type SortKey = 'id' | 'name' | 'city' | 'pin' | 'territory' | 'outcome' | 'score' | 'confidence' | 'risk';

const OUTCOME_ORDER: Record<Outcome, number> = { APPROVED: 0, APPROVED_WITH_CONDITIONS: 1, HOLD: 2, WAITLISTED: 3, REJECTED: 4 };
const LEVEL = { High: 0, Medium: 1, Low: 2 } as const;

export default function DecisionsTable({
  decisions,
  outcomeFilter,
  onOutcomeFilter,
  onOpen,
  selectedKey,
}: {
  decisions: Decision[];
  outcomeFilter: Outcome | null;
  onOutcomeFilter: (o: Outcome | null) => void;
  onOpen: (key: string) => void;
  selectedKey: string | null;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'id', dir: 1 });
  const [q, setQ] = useState('');
  const [territory, setTerritory] = useState('');

  const territories = useMemo(() => [...new Set(decisions.map((d) => d.territoryId ?? 'None'))].sort(), [decisions]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = decisions.filter(
      (d) =>
        (!outcomeFilter || d.outcome === outcomeFilter) &&
        (!territory || (d.territoryId ?? 'None') === territory) &&
        (!needle || [d.applicationId, d.applicantName, d.city ?? '', d.pin ?? '', d.oneLine].some((v) => v.toLowerCase().includes(needle))),
    );
    const val = (d: Decision): string | number => {
      switch (sort.key) {
        case 'id':
          return d.applicationId.replace(/\d+/g, (n) => n.padStart(6, '0')) + d.key;
        case 'name':
          return d.applicantName.toLowerCase();
        case 'city':
          return d.city ?? '';
        case 'pin':
          return d.pin ?? '';
        case 'territory':
          return d.territoryId ?? 'zzz';
        case 'outcome':
          return OUTCOME_ORDER[d.outcome];
        case 'score':
          return d.score ?? -1;
        case 'confidence':
          return LEVEL[d.confidence];
        case 'risk':
          return d.risk ? LEVEL[d.risk.level] : 3;
      }
    };
    return [...filtered].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [decisions, outcomeFilter, territory, q, sort]);

  const th = (key: SortKey, label: string, cls = '') => (
    <th scope="col" className={`whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500 ${cls}`} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className="inline-flex items-center gap-1 hover:text-slate-900" onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'score' ? -1 : 1 }))}>
        {label}
        <span aria-hidden className="text-[11px]">{sort.key === key ? (sort.dir === 1 ? '▲' : '▼') : ''}</span>
      </button>
    </th>
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search ID, name, pin, reason…"
          aria-label="Search decisions"
          className="w-full rounded-md border border-slate-300 bg-surface px-3 py-1.5 text-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 sm:w-64"
        />
        <select
          value={outcomeFilter ?? ''}
          onChange={(e) => onOutcomeFilter((e.target.value || null) as Outcome | null)}
          aria-label="Filter by outcome"
          className="rounded-md border border-slate-300 bg-surface px-2 py-1.5 text-sm"
        >
          <option value="">All outcomes</option>
          {(Object.keys(OUTCOME_LABEL) as Outcome[]).map((o) => (
            <option key={o} value={o}>
              {OUTCOME_LABEL[o]}
            </option>
          ))}
        </select>
        <select value={territory} onChange={(e) => setTerritory(e.target.value)} aria-label="Filter by territory" className="rounded-md border border-slate-300 bg-surface px-2 py-1.5 text-sm">
          <option value="">All territories</option>
          {territories.map((t) => (
            <option key={t} value={t}>
              {t === 'None' ? 'Outside territories' : t}
            </option>
          ))}
        </select>
        <span className="text-sm text-slate-500">
          {rows.length} of {decisions.length}
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>No applications match these filters.</Empty>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-surface shadow-card">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50/70">
              <tr>
                {th('id', 'ID')}
                {th('name', 'Name')}
                {th('city', 'City', 'hidden md:table-cell')}
                {th('pin', 'Pin', 'hidden md:table-cell')}
                {th('territory', 'Territory', 'hidden sm:table-cell')}
                {th('outcome', 'Outcome')}
                {th('score', 'Score')}
                {th('confidence', 'Confidence', 'hidden lg:table-cell')}
                {th('risk', 'Risk', 'hidden lg:table-cell')}
                <th scope="col" className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  Why
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((d) => (
                <tr
                  key={d.key}
                  tabIndex={0}
                  onClick={() => onOpen(d.key)}
                  onKeyDown={(e) => e.key === 'Enter' && onOpen(d.key)}
                  className={`cursor-pointer align-top transition hover:bg-brand-50/50 focus:bg-brand-50 focus:outline-none ${selectedKey === d.key ? 'bg-brand-50' : ''}`}
                >
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[13px] font-medium text-slate-900">
                    {d.applicationId}
                    {d.key.includes('#') && <span className="ml-1 text-xs text-rose-700">(dup)</span>}
                  </td>
                  <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-800">{d.applicantName}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-600 md:table-cell">{d.city ?? '—'}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-[13px] text-slate-600 md:table-cell">{d.pin ?? '—'}</td>
                  <td className="hidden whitespace-nowrap px-3 py-2.5 text-slate-600 sm:table-cell">{d.territoryId ?? '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2.5">
                    <OutcomeChip outcome={d.outcome} withdrawn={d.withdrawn} size="sm" />
                    {d.override?.status === 'applied' && <span className="ml-1 text-xs font-medium text-brand-700">overridden</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-800">
                    {d.score === null ? '—' : d.score.toFixed(1)}
                    {d.score !== null && d.provisionalScore && <span className="ml-0.5 text-xs text-slate-400" title="Provisional score">*</span>}
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    <ConfidenceLabel value={d.confidence} />
                  </td>
                  <td className="hidden px-3 py-2.5 lg:table-cell">
                    <RiskLabel level={d.risk?.level} />
                  </td>
                  <td className="min-w-[14rem] px-3 py-2.5 text-slate-600">{d.oneLine}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-xs text-slate-500">* Provisional score: the applicant is on hold, so the score shows where they would stand once the hold clears.</p>
    </div>
  );
}
