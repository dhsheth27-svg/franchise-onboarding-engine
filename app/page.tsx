import Link from 'next/link';
import { IconChat, IconCheck, IconGrad, IconList, IconMap, IconRoute, IconShield } from '@/components/icons';
import { Eyebrow, IconTile, Logo } from '@/components/ui';
import UploadPanel from '@/components/UploadPanel';

const FEATURES = [
  { icon: <IconShield />, title: 'Instant, explained screening', text: 'Seven hard gates, then a 0–100 score. Every decision shows the checks and numbers behind it.' },
  { icon: <IconMap />, title: 'Fair slot allocation', text: 'One store per pin, never more approvals than slots. Ties broken by clear rules.' },
  { icon: <IconRoute />, title: 'Redirect, not reject', text: 'Strong applicants who miss out are offered free pins where they would rank.' },
  { icon: <IconList />, title: "Today's action queue", text: 'Who to chase, why, and by when, with a ready message in their language.' },
  { icon: <IconGrad />, title: 'Onboarding that fits the partner', text: 'Training depth by experience, site checks for gaps, readiness before opening.' },
  { icon: <IconChat />, title: 'Ask and update in plain words', text: '"Why is APP-007 on hold?" or "APP-012 found a ground-floor space". It re-decides and shows what changed.' },
];

const CHECKS = ['Every decision explained', 'Hard rules never broken', 'Messages in Kannada, Hindi, English', 'No login, no setup'];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm font-medium text-slate-600 md:flex">
            <a href="#how" className="hover:text-brand-700">
              How it works
            </a>
            <a href="#features" className="hover:text-brand-700">
              What you get
            </a>
            <a href="/api/template" className="hover:text-brand-700">
              Template
            </a>
          </nav>
          <a href="#start" className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-700">
            Get started
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_top,black_40%,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
          <Eyebrow>
            <span className="h-1.5 w-1.5 rounded-full bg-brand-600" /> Franchise partner acquisition & onboarding
          </Eyebrow>
          <h1 className="mx-auto mt-5 max-w-3xl text-4xl font-extrabold leading-[1.08] tracking-tight text-ink sm:text-6xl">
            Smart decisions for <span className="text-brand-600">fast franchise growth.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Upload your applications and territories. Every applicant gets a clear decision, the reasons and numbers behind it, a message in their own language, and an onboarding plan if they move forward.
          </p>
          <ul className="mx-auto mt-6 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-medium text-slate-700">
            {CHECKS.map((c) => (
              <li key={c} className="inline-flex items-center gap-1.5">
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                  <IconCheck className="h-3.5 w-3.5" />
                </span>
                {c}
              </li>
            ))}
          </ul>

          <div id="start" className="mx-auto mt-10 max-w-xl scroll-mt-24 text-left">
            <UploadPanel />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6">
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">How it works</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">From application to an open, trained store</h2>
        </div>
        <ol className="mt-10 grid gap-4 md:grid-cols-5">
          {[
            ['Clean the data', 'Messy pins, units and spellings fixed; contradictions flagged'],
            ['Hard gates', 'Territory, existing stores, slots, capital, space'],
            ['Score 0–100', 'Money, operator, site, timing, territory, minus cannibalisation'],
            ['Allocate slots', 'Rank order, one store per pin, waitlists and redirects'],
            ['Plan & follow up', 'Onboarding plan, reservations, risk, messages, actions'],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-card">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">{i + 1}</span>
              <h3 className="mt-3 font-bold text-ink">{t}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section id="features" className="scroll-mt-20 border-t border-slate-200/70 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-[0.9fr_2fr] lg:items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-brand-600">What you get</p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Solutions that take expansion off your team&apos;s plate</h2>
              <p className="mt-3 text-slate-600">Built for the leaks in the franchise journey: slow screening, vague holds, lost leads, stalled approvals and unprepared openings.</p>
              <Link href="#start" className="mt-6 inline-flex rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-btn hover:bg-brand-700">
                Try with sample data
              </Link>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2">
              {FEATURES.map((f, i) => (
                <li key={f.title} className={`rounded-2xl border p-5 transition ${i === 0 ? 'border-brand-600 bg-brand-600 text-white shadow-lift' : 'border-slate-200/70 bg-white shadow-card hover:shadow-lift'}`}>
                  {i === 0 ? <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-white">{f.icon}</span> : <IconTile tone="soft">{f.icon}</IconTile>}
                  <h3 className={`mt-4 font-bold ${i === 0 ? 'text-white' : 'text-ink'}`}>{f.title}</h3>
                  <p className={`mt-1 text-sm leading-relaxed ${i === 0 ? 'text-brand-50' : 'text-slate-600'}`}>{f.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200/70">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="max-w-xl">
            Decisions come from transparent rules (see &ldquo;Rules in use&rdquo; inside a run). AI, when enabled, only reads free text and phrases answers; it never decides an outcome.
          </p>
        </div>
      </footer>
    </div>
  );
}
