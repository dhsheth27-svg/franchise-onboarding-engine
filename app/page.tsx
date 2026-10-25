import { IconArrow, IconChat, IconGrad, IconList, IconMap, IconRoute, IconShield } from '@/components/icons';
import { CountUp, Eyebrow, Headline, Logo, OutcomeChip, Reveal } from '@/components/ui';
import UploadPanel from '@/components/UploadPanel';
import type { Outcome } from '@/lib/engine/types';

const SERVICES = [
  { icon: <IconShield />, lead: 'Instant screening', rest: 'with every reason shown', text: 'Seven hard gates, then a 0–100 score. Every check, number and sentence is traceable.' },
  { icon: <IconMap />, lead: 'Fair slot allocation', rest: 'one store per pin', text: 'Ranked by score with clear tie-breakers. Never more approvals than open slots.' },
  { icon: <IconRoute />, lead: 'Redirect', rest: 'instead of reject', text: 'Strong applicants who miss out are offered free pins where they would rank.' },
  { icon: <IconList />, lead: "Today's actions", rest: 'ranked by value', text: 'Who to chase, why and by when, with a ready message in their language.' },
  { icon: <IconGrad />, lead: 'Onboarding plans', rest: 'fitted to the partner', text: 'Training depth by experience, site checks for gaps, readiness before opening.' },
  { icon: <IconChat />, lead: 'Ask and update', rest: 'in plain words', text: '"APP-012 found a ground-floor space" re-decides everyone and shows what changed.' },
];

const PREVIEW: { id: string; who: string; outcome: Outcome; why: string; score: string }[] = [
  { id: 'APP-026', who: 'Bengaluru · 560102', outcome: 'APPROVED', why: 'Ranked #1 for 4 slots in TER-01', score: '95.4' },
  { id: 'APP-009', who: 'Mangaluru · 575002', outcome: 'APPROVED_WITH_CONDITIONS', why: '"Before Diwali" clashes with the timeline', score: '73.0' },
  { id: 'APP-007', who: 'Mysuru · 570002', outcome: 'HOLD', why: 'No shop space yet; would rank #2 of 2', score: '69.9' },
  { id: 'APP-002', who: 'Bengaluru · 560010', outcome: 'WAITLISTED', why: 'Pin taken by APP-001 (85.2 vs 74.5)', score: '74.5' },
  { id: 'APP-003', who: 'Bengaluru · 560034', outcome: 'REJECTED', why: 'Store ST-02 already in this pin · redirect offered', score: '82.0' },
];

const STATS = [
  { n: 7, label: 'Hard gates checked' },
  { n: 5, label: 'Scoring pillars' },
  { n: 3, label: 'Message languages' },
  { n: 47, label: 'Automated tests' },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-canvas/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-8 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-600 md:flex">
            {[
              ['#how', 'How it works'],
              ['#services', 'What you get'],
              ['#about', 'About'],
              ['/api/template', 'Template'],
            ].map(([h, l]) => (
              <a key={h} href={h} className="relative transition hover:text-slate-900 after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-brand-600 after:transition-all hover:after:w-full">
                {l}
              </a>
            ))}
          </nav>
          <a href="#start" className="rounded-full px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-900 ring-1 ring-slate-400 transition duration-200 hover:bg-[#F4F4F6] hover:text-black hover:ring-[#F4F4F6]">
            Get started
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_45%,transparent_80%)]" aria-hidden />
        <div className="pointer-events-none absolute left-1/2 top-[-240px] h-[520px] w-[720px] -translate-x-1/2 rounded-full bg-brand-600/10 blur-[120px]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pt-24">
          <Reveal>
            <Eyebrow>
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-600 not-italic" /> Franchise partner onboarding engine
            </Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <Headline as="h1" lead="Smart decisions for" rest="franchise growth" className="mx-auto mt-6 max-w-4xl text-[42px] sm:text-[76px]" />
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-slate-600">
              Upload your applications and territories. Every applicant gets a clear decision, the reasons behind it, a message in their own language and an onboarding plan, every step of the way.
            </p>
          </Reveal>
          <Reveal delay={240} className="mx-auto mt-9 max-w-2xl scroll-mt-24 text-left">
            <div id="start">
              <UploadPanel />
            </div>
          </Reveal>

          {/* Product preview */}
          <Reveal delay={340} className="mx-auto mt-14 max-w-5xl">
            <div className="group relative overflow-hidden rounded-[32px] border border-slate-200 bg-surface p-3 text-left shadow-card transition duration-500 hover:border-slate-300 hover:shadow-lift sm:p-4">
              <div className="flex items-center justify-between px-2 pb-3 pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                </div>
                <span className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Decisions · live preview</span>
              </div>
              <ul className="divide-y divide-slate-200 rounded-3xl border border-slate-200 bg-canvas">
                {PREVIEW.map((p, i) => (
                  <li key={p.id} className="grid animate-fade-up grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 transition hover:bg-slate-50 sm:grid-cols-[6rem_9rem_12rem_1fr_auto]" style={{ animationDelay: `${500 + i * 90}ms` }}>
                    <span className="font-mono text-[13px] font-semibold text-slate-900">{p.id}</span>
                    <span className="hidden text-sm text-slate-500 sm:block">{p.who}</span>
                    <span className="justify-self-start">
                      <OutcomeChip outcome={p.outcome} size="sm" />
                    </span>
                    <span className="col-span-3 truncate text-sm text-slate-600 sm:col-span-1">{p.why}</span>
                    <span className="hidden font-mono text-sm tabular-nums text-slate-800 sm:block">{p.score}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* About + stats */}
      <section id="about" className="scroll-mt-20 border-t border-slate-200/60">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <Eyebrow>About</Eyebrow>
            <Headline lead="Unleashing the power of" rest="explainable expansion" className="mt-5 text-4xl sm:text-5xl" />
            <div className="mt-10 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label}>
                  <div className="text-4xl font-semibold italic tracking-tight text-ink">
                    <CountUp value={s.n} suffix={<span className="text-brand-600">+</span>} />
                  </div>
                  <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-5 text-[14px] leading-relaxed text-slate-600 lg:pt-14">
            <p>
              <span className="text-slate-900">The journey from a partner&apos;s first application to an open, trained store is slow and leaky.</span> Screening is manual, holds come without a clear ask, good leads are lost in slot conflicts and approved partners stall.
            </p>
            <p>
              This engine decides every application with transparent rules, <span className="text-slate-900">never breaks the three hard rules</span> (one store per pin, never more approvals than slots, never outside a territory) and explains each decision in plain words.
            </p>
            <p className="text-slate-500">AI is optional and only reads free text and phrases answers. It never decides an outcome.</p>
          </div>
        </div>
      </section>

      {/* Services list */}
      <section id="services" className="scroll-mt-20 border-t border-slate-200/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="text-center">
            <Eyebrow>What you get</Eyebrow>
            <Headline lead="Efficient expansion" rest="from screening to opening day" className="mx-auto mt-5 max-w-3xl text-4xl sm:text-5xl" />
          </div>
          <ul className="mt-12 divide-y divide-slate-200 border-y border-slate-200">
            {SERVICES.map((s) => (
              <li key={s.lead} className="group grid grid-cols-[auto_1fr_auto] items-center gap-5 px-2 py-6 transition duration-300 hover:bg-slate-50 sm:grid-cols-[auto_1fr_1.1fr_auto] sm:px-4">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-surface text-slate-700 transition duration-300 group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white">
                  {s.icon}
                </span>
                <h3 className="text-lg font-semibold uppercase leading-tight tracking-tight text-slate-900 sm:text-xl">
                  {s.lead} <span className="text-slate-400 transition group-hover:text-slate-600">{s.rest}</span>
                </h3>
                <p className="col-span-3 text-sm text-slate-600 sm:col-span-1">{s.text}</p>
                <span className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-300 text-slate-600 transition duration-300 group-hover:translate-x-1 group-hover:border-brand-600 group-hover:bg-brand-600 group-hover:text-white sm:inline-flex">
                  <IconArrow />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-20 border-t border-slate-200/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <Eyebrow>How it works</Eyebrow>
              <Headline lead="Five layers," rest="always in this order" className="mt-5 text-4xl sm:text-5xl" />
            </div>
            <a href="#start" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:-translate-y-px hover:bg-brand-500">
              Try it now
            </a>
          </div>
          <ol className="mt-12 grid gap-4 md:grid-cols-5">
            {[
              ['Clean', 'Messy pins, units and spellings fixed; contradictions flagged'],
              ['Gate', 'Territory, existing stores, slots, capital, space'],
              ['Score', 'Money, operator, site, timing, territory, minus cannibalisation'],
              ['Allocate', 'Rank order, one store per pin, waitlists and redirects'],
              ['Plan', 'Onboarding, reservations, risk, messages and actions'],
            ].map(([t, d], i) => (
              <li key={t} className="group rounded-3xl border border-slate-200 bg-surface p-5 shadow-card transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lift">
                <span className="font-mono text-xs text-slate-500">0{i + 1}</span>
                <h3 className="mt-6 text-xl font-semibold uppercase tracking-tight text-slate-900 transition group-hover:text-brand-700">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <footer className="border-t border-slate-200/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="max-w-xl uppercase tracking-wider">No login · each run gets a private link · Kannada & Hindi templates should be reviewed by a native speaker</p>
        </div>
      </footer>
    </div>
  );
}
