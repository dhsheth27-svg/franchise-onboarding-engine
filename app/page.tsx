import { IconArrow, IconChat, IconCheck, IconList, IconMap, IconRoute, IconShield } from '@/components/icons';
import { Eyebrow, Logo } from '@/components/ui';
import DemoStartButton from '@/components/DemoStartButton';
import UploadPanel from '@/components/UploadPanel';

// Figures on this page come from the built-in sample run (29 applications, 7 territories, as of 26 Oct 2026).
const SAMPLE_MIX = [
  { label: 'Approved', n: 7, cls: 'bg-emerald-600' },
  { label: 'On hold', n: 12, cls: 'bg-amber-400' },
  { label: 'Waitlisted', n: 5, cls: 'bg-sky-500' },
  { label: 'Rejected', n: 5, cls: 'bg-rose-500' },
];
const SAMPLE_TOTAL = SAMPLE_MIX.reduce((n, s) => n + s.n, 0);

const RULES = [
  { n: '01', title: 'Never two stores in one pin code', body: 'Existing stores count. A taken pin is a redirect to a free one, not a dead end.' },
  { n: '02', title: 'Never more approvals than open slots', body: 'Slots go in rank order. Everyone else who qualifies is waitlisted with their position.' },
  { n: '03', title: 'Never approve outside the territories', body: 'A pin outside every territory can be shown its nearest option, never a slot.' },
];

const STEPS = [
  { n: '1', title: 'Upload', body: 'The case workbook as it is. Pins like “570001.0”, “₹25 lakh”, “GF” and duplicates are cleaned and flagged, never crashed on.' },
  { n: '2', title: 'Screen', body: 'Seven hard gates, each one recorded. A fixable gap becomes a hold with a specific ask and a deadline, not a rejection.' },
  { n: '3', title: 'Score & allocate', body: 'Five weighted pillars minus a cannibalisation deduction. Slots are filled in rank order, one store per pin.' },
  { n: '4', title: 'Act', body: 'Messages in English, Kannada or Hindi, onboarding plans, 30-day slot reservations and a ranked list of what to do today.' },
];

const FEATURES = [
  { icon: <IconList className="h-5 w-5" />, title: 'Today', body: 'One queue ranked by value: who to call, what to ask for and by when.' },
  { icon: <IconChat className="h-5 w-5" />, title: 'Ask anything', body: '“Why is APP-007 on hold?” or “APP-012 found a ground-floor space”: answered, or re-decided with exactly what changed.' },
  { icon: <IconRoute className="h-5 w-5" />, title: 'Journey board', body: 'Every approved partner by stage, from agreement to opening day, with overdue flags and the bottleneck.' },
  { icon: <IconArrow className="h-5 w-5" />, title: 'Outbox', body: 'Every message in the applicant’s language, one tap to WhatsApp or email, tracked as sent.' },
  { icon: <IconMap className="h-5 w-5" />, title: 'Policy simulator', body: 'Move the approval bar or a territory’s slots and see who changes before you commit.' },
  { icon: <IconShield className="h-5 w-5" />, title: 'Overrides on record', body: 'Overrule the tool with a name and a reason. The three hard rules still hold.' },
];

/** A static, real example of what the app produces (APP-007 and APP-001 from the sample run). */
function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-[520px] pb-10 pt-6 lg:pt-2">
      {/* Back card: an approval */}
      <div className="absolute right-0 top-0 hidden w-[78%] rotate-[3deg] rounded-[22px] border border-slate-200 bg-surface p-5 shadow-paper animate-float-slow sm:block">
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-semibold text-ink">APP-001</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/20">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" /> Approved
          </span>
        </div>
        <p className="mt-0.5 text-xs text-slate-500">Bengaluru · 560010 · score 85.2</p>
        <p className="mt-2 text-sm text-slate-700">Ranked #2 for 4 slots · held to 25 Nov</p>
      </div>

      {/* Front card: an explained hold */}
      <div className="relative mt-4 rounded-[24px] border border-slate-200 bg-surface shadow-paper animate-float sm:mt-[104px] sm:w-[90%]">
        <div className="flex items-start justify-between gap-3 px-5 pt-5">
          <div>
            <div className="font-mono text-base font-semibold text-ink">APP-007</div>
            <div className="text-xs text-slate-500">Prakash Joshi · Mysuru · 570002</div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-600/25">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> On hold
          </span>
        </div>
        <div className="px-5 pt-4">
          <div className="flex items-baseline justify-between text-xs text-slate-500">
            <span>Provisional score</span>
            <span className="font-display text-2xl text-ink">69.9</span>
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[69.9%] origin-left animate-grow-x rounded-full bg-brand-600" style={{ animationDelay: '500ms' }} />
          </div>
        </div>
        <div className="mt-4 border-t border-dashed border-slate-200 px-5 py-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Why</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">No shop space has been found yet. Everything else looks strong.</p>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">What would change this</div>
          <p className="mt-1 text-sm leading-relaxed text-slate-800">
            Moves to <span className="font-medium text-emerald-700">Approved</span> if a ground-floor space of 200+ sq ft is confirmed. Would rank #2 for 2 slots in TER-03.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-b-[24px] border-t border-slate-200 bg-slate-50 px-5 py-3 text-xs">
          <span className="rounded-full bg-ink px-2.5 py-1 font-medium text-canvas">Message ready · ಕನ್ನಡ</span>
          <span className="rounded-full px-2.5 py-1 text-slate-600 ring-1 ring-slate-300">WhatsApp</span>
          <span className="rounded-full px-2.5 py-1 text-slate-600 ring-1 ring-slate-300">Email</span>
        </div>
      </div>

      {/* Sample mix */}
      <div className="relative ml-auto mt-4 w-[86%] rounded-[20px] border border-slate-200 bg-surface p-4 shadow-paper animate-fade-up sm:w-[66%]" style={{ animationDelay: '350ms' }}>
        <div className="flex items-baseline justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">Sample run</span>
          <span className="text-xs text-slate-500">{SAMPLE_TOTAL} applicants · 7 territories</span>
        </div>
        <div className="mt-2.5 flex h-2.5 gap-[2px] overflow-hidden rounded-full">
          {SAMPLE_MIX.map((s, i) => (
            <span key={s.label} className={`${s.cls} h-full origin-left animate-grow-x first:rounded-l-full last:rounded-r-full`} style={{ width: `${(s.n / SAMPLE_TOTAL) * 100}%`, animationDelay: `${600 + i * 90}ms` }} />
          ))}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
          {SAMPLE_MIX.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${s.cls}`} />
              {s.label} <span className="font-medium text-ink">{s.n}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Follow-up bubble */}
      <div className="absolute -left-2 bottom-0 hidden max-w-[260px] rounded-2xl rounded-bl-md bg-ink px-4 py-3 text-sm text-canvas shadow-paper animate-fade-up sm:block lg:-left-10" style={{ animationDelay: '700ms' }}>
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">Ask</span>
        <div className="mt-0.5">“Why is APP-007 on hold?”</div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-full px-3 py-1.5 text-slate-600 transition hover:text-ink sm:inline-flex">
              How it works
            </a>
            <a href="#rules" className="hidden rounded-full px-3 py-1.5 text-slate-600 transition hover:text-ink sm:inline-flex">
              The rules
            </a>
            <a href="/api/template" className="ml-1 rounded-full px-4 py-1.5 font-medium text-ink ring-1 ring-slate-300 transition duration-200 hover:bg-ink hover:text-canvas hover:ring-ink">
              Template
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section id="start" className="relative overflow-hidden">
          <div className="bg-ledger pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_30%,black_20%,transparent_70%)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-10 lg:pb-24 lg:pt-20">
            <div>
              <div className="animate-fade-up">
                <Eyebrow>
                  <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-600" /> Franchise partner onboarding · Karnataka
                </Eyebrow>
              </div>
              <h1 className="mt-5 animate-fade-up font-display text-[52px] font-normal leading-[0.92] tracking-[-0.02em] text-ink sm:text-[76px] lg:text-[84px]" style={{ animationDelay: '80ms' }}>
                Every applicant, decided. <span className="italic text-brand-600">Every reason, shown.</span>
              </h1>
              <p className="mt-6 max-w-[34rem] animate-fade-up text-[16px] leading-relaxed text-slate-700" style={{ animationDelay: '160ms' }}>
                Upload your Applications and Territories workbook. Opsmith screens every applicant, fills territory slots without breaking the three hard rules, and hands your team the messages, onboarding plans and today’s to-do list.
              </p>
              <div className="mt-8 max-w-xl animate-fade-up" style={{ animationDelay: '240ms' }}>
                <UploadPanel />
              </div>
              <div className="mt-5 flex animate-fade-up flex-wrap items-center gap-x-4 gap-y-3" style={{ animationDelay: '320ms' }}>
                <DemoStartButton />
                <span className="text-xs text-slate-500">No login. Each run gets its own private link.</span>
              </div>
            </div>
            <HeroPreview />
          </div>
        </section>

        {/* The three hard rules */}
        <section id="rules" className="scroll-mt-16 bg-ink text-canvas">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl font-display text-[40px] leading-[0.98] tracking-[-0.015em] sm:text-[52px]">
                Three rules it will <span className="italic text-brand-300">never</span> break.
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-slate-300">
                Checked after every decision, every override and every follow-up. An override that would break one is refused, with the reason.
              </p>
            </div>
            <ol className="mt-12 grid gap-px overflow-hidden rounded-3xl bg-white/10 sm:grid-cols-3">
              {RULES.map((r) => (
                <li key={r.n} className="bg-ink p-6 transition duration-300 hover:bg-[#1f1c16] sm:p-7">
                  <div className="font-display text-5xl text-brand-300">{r.n}</div>
                  <h3 className="mt-6 text-lg font-semibold leading-snug">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-400">{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-16">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-3xl font-display text-[40px] leading-[0.98] tracking-[-0.015em] text-ink sm:text-[52px]">
              From spreadsheet to partner, <span className="italic text-brand-600">in four steps.</span>
            </h2>
            <ol className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
              {STEPS.map((s) => (
                <li key={s.n} className="group border-t-2 border-ink pt-5">
                  <div className="flex items-baseline gap-3">
                    <span className="font-mono text-xs text-brand-600">0{s.n}</span>
                    <h3 className="font-display text-[28px] leading-none text-ink">{s.title}</h3>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What the team gets */}
        <section className="border-y border-slate-200 bg-surface/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <Eyebrow>For the expansion team</Eyebrow>
                <h2 className="mt-3 max-w-2xl font-display text-[40px] leading-[0.98] tracking-[-0.015em] text-ink sm:text-[52px]">
                  Not just a verdict. <span className="italic text-brand-600">A plan for Monday.</span>
                </h2>
              </div>
              <p className="max-w-sm text-sm leading-relaxed text-slate-600">Every decision comes with the next step, the person to contact and the message to send.</p>
            </div>
            <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <li key={f.title} className="group rounded-3xl border border-slate-200 bg-surface p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lift">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700 transition duration-300 group-hover:bg-brand-600 group-hover:text-white">{f.icon}</span>
                  <h3 className="mt-5 font-display text-[26px] leading-none text-ink">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="relative overflow-hidden rounded-[32px] bg-brand-600 px-6 py-12 text-white sm:px-12 sm:py-16">
            <div className="bg-ledger pointer-events-none absolute inset-0 opacity-40 invert [mask-image:linear-gradient(to_left,black,transparent)]" aria-hidden />
            <div className="relative flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="font-display text-[40px] leading-[0.98] tracking-[-0.015em] sm:text-[56px]">
                  See it decide 29 messy applications <span className="italic text-brand-100">in under a minute.</span>
                </h2>
                <ul className="mt-6 space-y-2 text-sm text-brand-50">
                  {['An explained hold, and the update that clears it', 'A withdrawal that promotes the waitlist', 'An override the hard rules refuse'].map((t) => (
                    <li key={t} className="flex items-center gap-2">
                      <IconCheck className="h-4 w-4 flex-none text-brand-200" /> {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-3">
                <DemoStartButton tone="dark" />
                <a href="#start" className="text-sm text-brand-100 underline-offset-4 hover:text-white hover:underline">
                  or upload your own workbook ↑
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="font-mono uppercase tracking-[0.14em]">Decisions explained · hard rules enforced · no login</p>
        </div>
      </footer>
    </div>
  );
}
