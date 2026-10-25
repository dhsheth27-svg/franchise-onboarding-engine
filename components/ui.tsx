'use client';

import type { ReactNode } from 'react';
import type { Confidence, Outcome } from '@/lib/engine/types';

export const OUTCOME_LABEL: Record<Outcome, string> = {
  APPROVED: 'Approved',
  APPROVED_WITH_CONDITIONS: 'Approved · conditions',
  HOLD: 'On hold',
  WAITLISTED: 'Waitlisted',
  REJECTED: 'Rejected',
};

export const OUTCOME_STYLE: Record<Outcome, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-800 ring-emerald-600/25',
  APPROVED_WITH_CONDITIONS: 'bg-teal-50 text-teal-800 ring-teal-600/25',
  HOLD: 'bg-amber-50 text-amber-900 ring-amber-600/30',
  WAITLISTED: 'bg-sky-50 text-sky-800 ring-sky-600/25',
  REJECTED: 'bg-rose-50 text-rose-800 ring-rose-600/25',
};

const OUTCOME_DOT: Record<Outcome, string> = {
  APPROVED: 'bg-emerald-600',
  APPROVED_WITH_CONDITIONS: 'bg-teal-600',
  HOLD: 'bg-amber-500',
  WAITLISTED: 'bg-sky-600',
  REJECTED: 'bg-rose-600',
};

export function OutcomeChip({ outcome, withdrawn, size = 'md' }: { outcome: Outcome; withdrawn?: boolean; size?: 'sm' | 'md' }) {
  const cls = withdrawn ? 'bg-stone-100 text-stone-700 ring-stone-400/30' : OUTCOME_STYLE[outcome];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${cls} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${withdrawn ? 'bg-stone-500' : OUTCOME_DOT[outcome]}`} />
      {withdrawn ? 'Withdrawn' : OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function Tag({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'bad' | 'good' | 'info'; title?: string }) {
  const tones = {
    neutral: 'bg-stone-100 text-stone-600',
    warn: 'bg-amber-100 text-amber-900',
    bad: 'bg-rose-100 text-rose-800',
    good: 'bg-emerald-100 text-emerald-800',
    info: 'bg-sky-100 text-sky-800',
  };
  return (
    <span title={title} className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10.5px] font-medium tracking-tight ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: Confidence }) {
  const tone = value === 'High' ? 'text-stone-700' : value === 'Medium' ? 'text-amber-800' : 'text-rose-700';
  return <span className={`text-xs font-medium ${tone}`}>{value}</span>;
}

export function RiskLabel({ level }: { level?: 'Low' | 'Medium' | 'High' }) {
  if (!level) return <span className="text-xs text-stone-400">—</span>;
  const tone = level === 'High' ? 'bg-rose-100 text-rose-800' : level === 'Medium' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-600';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{level}</span>;
}

export function Section({ title, children, right, id }: { title: string; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-stone-200 px-5 py-4 sm:px-6">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <h3 className="text-[13px] font-semibold uppercase tracking-wide text-stone-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-lg border border-stone-200 bg-white ${className}`}>{children}</div>;
}

export function Button({
  children,
  onClick,
  variant = 'secondary',
  disabled,
  type = 'button',
  className = '',
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  title?: string;
}) {
  const styles = {
    primary: 'bg-indigo-700 text-white hover:bg-indigo-800 disabled:bg-indigo-300',
    secondary: 'bg-white text-stone-800 ring-1 ring-inset ring-stone-300 hover:bg-stone-50 disabled:text-stone-400',
    ghost: 'text-stone-700 hover:bg-stone-100 disabled:text-stone-400',
    danger: 'bg-rose-700 text-white hover:bg-rose-800 disabled:bg-rose-300',
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(`${iso}T00:00:00Z`);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500">{children}</p>;
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}
