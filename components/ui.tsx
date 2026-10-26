'use client';

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
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

export const OUTCOME_DOT: Record<Outcome, string> = {
  APPROVED: 'bg-emerald-600',
  APPROVED_WITH_CONDITIONS: 'bg-teal-600',
  HOLD: 'bg-amber-500',
  WAITLISTED: 'bg-sky-600',
  REJECTED: 'bg-rose-600',
};

export function OutcomeChip({ outcome, withdrawn, size = 'md' }: { outcome: Outcome; withdrawn?: boolean; size?: 'sm' | 'md' }) {
  const cls = withdrawn ? 'bg-slate-100 text-slate-700 ring-slate-400/30' : OUTCOME_STYLE[outcome];
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${cls} ${size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-sm'}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${withdrawn ? 'bg-slate-500' : OUTCOME_DOT[outcome]}`} />
      {withdrawn ? 'Withdrawn' : OUTCOME_LABEL[outcome]}
    </span>
  );
}

export function Tag({ children, tone = 'neutral', title }: { children: ReactNode; tone?: 'neutral' | 'warn' | 'bad' | 'good' | 'info'; title?: string }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600',
    warn: 'bg-amber-100 text-amber-900',
    bad: 'bg-rose-100 text-rose-800',
    good: 'bg-emerald-100 text-emerald-800',
    info: 'bg-sky-100 text-sky-800',
  };
  return (
    <span title={title} className={`inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[11px] font-medium tracking-tight ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ConfidenceLabel({ value }: { value: Confidence }) {
  const tone = value === 'High' ? 'text-slate-700' : value === 'Medium' ? 'text-amber-800' : 'text-rose-700';
  return <span className={`text-xs font-medium ${tone}`}>{value}</span>;
}

export function RiskLabel({ level }: { level?: 'Low' | 'Medium' | 'High' }) {
  if (!level) return <span className="text-xs text-slate-400">—</span>;
  const tone = level === 'High' ? 'bg-rose-100 text-rose-800' : level === 'Medium' ? 'bg-amber-100 text-amber-900' : 'bg-slate-100 text-slate-600';
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tone}`}>{level}</span>;
}

export function Section({ title, children, right, id }: { title: string; children: ReactNode; right?: ReactNode; id?: string }) {
  return (
    <section id={id} className="border-t border-slate-200/70 px-5 py-5 sm:px-6">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Card({ children, className = '', hover = false, style }: { children: ReactNode; className?: string; hover?: boolean; style?: CSSProperties }) {
  return (
    <div
      style={style}
      className={`rounded-3xl border border-slate-200 bg-surface/75 shadow-card backdrop-blur-xl ${hover ? 'transition duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lift' : ''} ${className}`}
    >
      {children}
    </div>
  );
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
    primary: 'bg-brand-600 text-white shadow-btn hover:-translate-y-px hover:bg-brand-500 active:translate-y-0 disabled:bg-brand-300 disabled:shadow-none',
    secondary: 'bg-transparent text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-ink hover:text-canvas hover:ring-ink disabled:text-slate-400',
    ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:text-slate-400',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 disabled:bg-rose-300',
  };
  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold transition duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas ${styles[variant]} ${className}`}
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
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-surface/60 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <span aria-hidden className={`inline-block animate-spin rounded-full border-2 border-current border-r-transparent ${className}`} />;
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg aria-hidden viewBox="0 0 32 32" className="h-7 w-7 flex-none">
        <rect width="32" height="32" rx="9" fill="#16140F" />
        <circle cx="16" cy="16.5" r="7" stroke="#F4EFE6" strokeWidth="3" fill="none" />
        <circle cx="23" cy="9.5" r="2.6" fill="#3F5BF6" />
      </svg>
      {!compact && (
        <span className="font-display text-[23px] leading-none tracking-tight text-ink">
          Op<span className="italic text-brand-600">smith</span>
        </span>
      )}
    </span>
  );
}

export function IconTile({ children, tone = 'brand' }: { children: ReactNode; tone?: 'brand' | 'soft' }) {
  return (
    <span className={`inline-flex h-10 w-10 flex-none items-center justify-center rounded-xl ${tone === 'brand' ? 'bg-brand-600 text-white shadow-btn' : 'bg-brand-50 text-brand-600'}`}>
      {children}
    </span>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <span className="inline-flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-slate-600">{children}</span>;
}

/** Editorial serif headline: the second part is set in cobalt italics. */
export function Headline({ lead, rest, as = 'h2', className = '' }: { lead: ReactNode; rest?: ReactNode; as?: 'h1' | 'h2' | 'h3'; className?: string }) {
  const Tag = as;
  return (
    <Tag className={`font-display font-normal leading-[0.95] tracking-[-0.015em] text-ink ${className}`}>
      {lead} {rest && <span className="italic text-brand-600">{rest}</span>}
    </Tag>
  );
}

/** Counts up to a number when it scrolls into view. */
export function CountUp({ value, decimals = 0, duration = 900, suffix }: { value: number; decimals?: number; duration?: number; suffix?: ReactNode }) {
  const [n, setN] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setN(value);
      return;
    }
    let raf = 0;
    const start = (t0: number) => {
      const tick = (t: number) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(value * (1 - Math.pow(1 - p, 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          start(performance.now());
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  return (
    <span ref={ref} className="tabular-nums">
      {Math.max(0, n).toFixed(decimals)}
      {suffix}
    </span>
  );
}

/** Horizontal bar that grows in from the left. */
export function GrowBar({ pct, className = 'bg-brand-600', delay = 0, height = 'h-2' }: { pct: number; className?: string; delay?: number; height?: string }) {
  return (
    <span className={`block overflow-hidden rounded-full bg-slate-100 ${height}`}>
      <span className={`block h-full origin-left animate-grow-x rounded-full ${className}`} style={{ width: `${Math.max(0, Math.min(100, pct))}%`, animationDelay: `${delay}ms` }} />
    </span>
  );
}

/** Staggered fade-up wrapper. */
export function Reveal({ children, delay = 0, className = '' }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={`animate-fade-up ${className}`} style={{ animationDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

/** Collapsible drawer section: title on the left, a one-line summary on the right, content on demand. */
export function Collapsible({ title, summary, children, defaultOpen = false }: { title: string; summary?: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group/c border-t border-slate-200/70">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 transition hover:bg-slate-50 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{title}</span>
        <span className="ml-auto truncate text-right text-sm text-slate-700">{summary}</span>
        <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 flex-none text-slate-500 transition-transform duration-200 group-open/c:rotate-180" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="animate-fade-in px-5 pb-5 sm:px-6">{children}</div>
    </details>
  );
}
