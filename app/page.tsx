import Image, { type StaticImageData } from 'next/image';
import type { ReactNode } from 'react';
import InView from '@/components/InView';
import StartPanel, { SampleActions } from '@/components/StartPanel';
import { Logo } from '@/components/ui';
// Real screenshots of the app, captured from the built-in sample run.
import askShot from '@/public/landing/ask.jpg';
import drawerShot from '@/public/landing/drawer.jpg';
import journeyShot from '@/public/landing/journey.jpg';
import overviewShot from '@/public/landing/overview.jpg';
import policyShot from '@/public/landing/policy.jpg';
import todayShot from '@/public/landing/today.jpg';

const STATS = [
  { n: '7', label: 'hard gates checked on every application' },
  { n: '5', label: 'weighted pillars behind every score' },
  { n: '3', label: 'languages for applicant messages' },
  { n: '0', label: 'hard-rule breaks, checked after every change' },
];

const RULES = [
  { title: 'One store per pin code', body: 'Existing stores count. A taken pin leads to a redirect, not a dead end.' },
  { title: 'No more approvals than open slots', body: 'Slots are filled in rank order. Other qualified applicants are waitlisted with their position.' },
  { title: 'Only inside the territories', body: 'A pin outside every territory is never approved, whatever the score.' },
];

function Tile({ title, body, shot, alt, className = '', imgClass = '', delay = 0 }: { title: string; body: string; shot: StaticImageData; alt: string; className?: string; imgClass?: string; delay?: number }) {
  return (
    <InView delay={delay} className={className}>
      <article className="group flex h-full flex-col overflow-hidden rounded-[30px] bg-white shadow-card ring-1 ring-slate-200/60 transition duration-500 hover:-translate-y-1 hover:shadow-lift">
        <div className="p-7 pb-5">
          <h3 className="text-lg font-semibold text-ink">{title}</h3>
          <p className="mt-1.5 max-w-md text-sm leading-relaxed text-slate-600">{body}</p>
        </div>
        <div className="relative mt-auto flex-1 overflow-hidden px-7">
          <div className="overflow-hidden rounded-t-2xl ring-1 ring-slate-200">
            <Image src={shot} alt={alt} placeholder="blur" sizes="(min-width: 1024px) 50vw, 100vw" className={`w-full transition duration-700 group-hover:scale-[1.02] ${imgClass}`} />
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white to-transparent" />
        </div>
      </article>
    </InView>
  );
}

function SectionHead({ kicker, children }: { kicker: string; children: ReactNode }) {
  return (
    <InView className="mx-auto max-w-2xl text-center">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-600">{kicker}</div>
      <h2 className="mt-3 text-[32px] font-light leading-tight tracking-[-0.02em] text-ink sm:text-[44px]">{children}</h2>
    </InView>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative isolate">
        {/* Background: deep violet with soft colour glows and a fading grid */}
        <div aria-hidden className="absolute inset-x-0 top-0 -z-10 h-[calc(100%-14vw)] min-h-[640px] overflow-hidden rounded-b-[48px] bg-[#1C1350] sm:rounded-b-[64px]">
          <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_0%,#5B41D6_0%,transparent_70%)]" />
          <div className="absolute -left-64 top-20 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgba(244,163,195,0.28),transparent)]" />
          <div className="absolute -right-64 top-0 h-[700px] w-[700px] bg-[radial-gradient(closest-side,rgba(142,216,240,0.22),transparent)]" />
          <div className="bg-ledger absolute inset-0 [mask-image:radial-gradient(ellipse_at_50%_0%,black_10%,transparent_65%)]" />
        </div>

        <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo light />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#features" className="hidden rounded-xl px-3 py-1.5 text-white/70 transition hover:text-white sm:inline-flex">
              Features
            </a>
            <a href="#rules" className="hidden rounded-xl px-3 py-1.5 text-white/70 transition hover:text-white sm:inline-flex">
              The rules
            </a>
            <a href="/api/template" className="ml-1 rounded-xl bg-white/10 px-4 py-2 font-medium text-white ring-1 ring-inset ring-white/20 backdrop-blur transition hover:bg-white/20">
              Template
            </a>
          </nav>
        </header>

        <div className="mx-auto max-w-6xl px-4 pt-10 text-center sm:px-6 sm:pt-16">
          <div className="animate-fade-up">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80 ring-1 ring-inset ring-white/15 backdrop-blur">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-[#8ED8F0]" /> Franchise partner onboarding · Karnataka
            </span>
          </div>
          <h1 className="mx-auto mt-6 max-w-4xl animate-fade-up text-[42px] font-light leading-[1.05] tracking-[-0.035em] text-white sm:text-[64px] lg:text-[76px]" style={{ animationDelay: '80ms' }}>
            Franchise applications,{' '}
            <span className="bg-gradient-to-r from-[#FBDDE9] via-white to-[#BDEBFA] bg-clip-text font-semibold text-transparent">decided and explained.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl animate-fade-up text-base leading-relaxed text-white/70 sm:text-lg" style={{ animationDelay: '160ms' }}>
            Upload the Applications and Territories workbook. Every applicant gets a decision with its reasons, and your expansion team gets a clear plan for what to do next.
          </p>

          <div className="mx-auto mt-10 max-w-4xl animate-fade-up rounded-[32px] bg-white/10 p-2 text-left ring-1 ring-inset ring-white/15 backdrop-blur-xl" style={{ animationDelay: '240ms' }}>
            <StartPanel />
          </div>

          {/* Product shot */}
          <div className="relative mx-auto mt-16 max-w-6xl animate-fade-up sm:mt-20" style={{ animationDelay: '360ms' }}>
            <div aria-hidden className="absolute -inset-x-10 -top-24 h-72 bg-[radial-gradient(50%_50%_at_50%_50%,rgba(124,92,255,0.55),transparent)]" />
            <div className="relative rounded-[26px] bg-white/10 p-2 ring-1 ring-inset ring-white/20 backdrop-blur-xl shadow-[0_50px_120px_-40px_rgba(28,19,80,0.75)] sm:p-2.5">
              <div className="overflow-hidden rounded-[20px] bg-white">
                <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F4A3C3]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#F5D58A]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#9EE0C2]" />
                  <span className="mx-auto hidden rounded-lg bg-slate-100 px-10 py-1 text-[11px] text-slate-500 sm:block">opsmith-app.vercel.app/run/…</span>
                </div>
                <Image src={overviewShot} alt="The Opsmith control room for the sample run: decided applications, slots filled, open actions and the impact of the run" priority placeholder="blur" sizes="(min-width: 1200px) 1152px, 100vw" className="w-full" />
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="flex-1">
        {/* ── Stats ── */}
        <section className="mx-auto max-w-6xl px-4 pt-16 sm:px-6 sm:pt-20">
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] bg-slate-200/70 shadow-card ring-1 ring-slate-200/60 lg:grid-cols-4">
            {STATS.map((s, i) => (
              <InView key={s.label} delay={i * 80} className="h-full">
                <div className="h-full bg-white p-6 sm:p-7">
                  <div className="bg-gradient-to-br from-brand-700 to-brand-400 bg-clip-text text-5xl font-semibold tracking-tight text-transparent">{s.n}</div>
                  <div className="mt-2 text-sm leading-snug text-slate-600">{s.label}</div>
                </div>
              </InView>
            ))}
          </div>
        </section>

        {/* ── Bento ── */}
        <section id="features" className="mx-auto max-w-6xl scroll-mt-8 px-4 pt-24 sm:px-6 sm:pt-32">
          <SectionHead kicker="Beyond the verdict">
            Everything the team needs, <span className="font-semibold">from decision to opening day.</span>
          </SectionHead>
          <div className="mt-14 grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-6">
            <Tile
              className="lg:col-span-4"
              title="Every decision, explained"
              body="Plain-language reasons, the score and checks behind them, what would change the outcome, and a message ready in the applicant’s language."
              shot={drawerShot}
              alt="APP-007 on hold, with the reason, what would change it and a message in Kannada"
              imgClass="max-h-[440px] object-cover object-top"
            />
            <Tile
              className="lg:col-span-2"
              delay={100}
              title="Ask, or update, in plain words"
              body="“APP-012 has now found a ground-floor space”: everyone is re-decided and you see what changed."
              shot={askShot}
              alt="The Ask panel re-deciding APP-012 after an update"
              imgClass="max-h-[440px] object-cover object-top"
            />
            <Tile
              className="lg:col-span-3"
              title="Today’s actions, ranked"
              body="Who to contact, what to ask for and by when, with the message already written."
              shot={todayShot}
              alt="Today’s action list with info requests in English, Kannada and Hindi"
              imgClass="max-h-[300px] object-cover object-left-top"
            />
            <Tile
              className="lg:col-span-3"
              delay={100}
              title="Test a policy before you change it"
              body="Move the approval bar or a territory’s slots and preview exactly who would change. Applying it is logged with your name."
              shot={policyShot}
              alt="Policy simulator preview: raising the approval bar to 60 changes one decision"
              imgClass="max-h-[300px] object-cover object-left-top"
            />
            <Tile
              className="lg:col-span-6"
              title="From agreement to opening day"
              body="Every approved partner on one board, by stage, with slot reservations, due dates and overdue flags."
              shot={journeyShot}
              alt="The journey board with approved partners in the Agreement & KYC stage"
              imgClass="max-h-[260px] object-cover object-left-top"
            />
          </div>
        </section>

        {/* ── Rules ── */}
        <section id="rules" className="mx-auto max-w-6xl scroll-mt-8 px-4 pt-24 sm:px-6 sm:pt-32">
          <SectionHead kicker="Guaranteed">
            Three rules it will <span className="font-semibold">never break.</span>
          </SectionHead>
          <InView className="mx-auto mt-4 max-w-xl text-center text-sm text-slate-600">Checked after every decision, override and update. An override that would break one is refused, with the reason.</InView>
          <ol className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-5 sm:grid-cols-3">
            {RULES.map((r, i) => (
              <li key={r.title} className="h-full">
                <InView delay={i * 100} className="h-full rounded-[28px] bg-white p-7 shadow-card ring-1 ring-slate-200/60 hover:-translate-y-1 hover:shadow-lift">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-brand-600 text-sm font-semibold text-white shadow-btn">{i + 1}</span>
                  <h3 className="mt-6 text-base font-semibold text-ink">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.body}</p>
                </InView>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Closing ── */}
        <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
          <InView>
            <div className="relative isolate overflow-hidden rounded-[40px] bg-[#1C1350] px-6 py-14 text-center sm:px-12 sm:py-20">
              <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(70%_80%_at_50%_120%,#5B41D6_0%,transparent_70%)]" />
              <div aria-hidden className="bg-ledger absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_50%_100%,black_10%,transparent_70%)]" />
              <h2 className="mx-auto max-w-2xl text-[32px] font-light leading-tight tracking-[-0.02em] text-white sm:text-[44px]">
                See it decide 29 messy applications <span className="font-semibold">in under a minute.</span>
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/65">An explained hold and the update that clears it, a withdrawal that promotes the waitlist, and an override the hard rules refuse.</p>
              <div className="mt-8 flex justify-center">
                <SampleActions />
              </div>
            </div>
          </InView>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pb-8 text-xs text-slate-500 sm:px-6">
          <Logo />
          <span>No login. Each run gets its own private link.</span>
        </div>
      </footer>
    </div>
  );
}
