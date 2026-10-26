import { Logo } from '@/components/ui';
import StartPanel from '@/components/StartPanel';

const GETS = [
  { title: 'A decision with its reasons', body: 'Approved, approved with conditions, on hold, waitlisted or rejected. Every check and score behind it is shown.' },
  { title: 'What would change it', body: 'Found by re-running the rules on the changed application, not guessed.' },
  { title: 'A message in their language', body: 'English, Kannada or Hindi, ready to send by WhatsApp or email.' },
  { title: 'An onboarding plan', body: 'For approved partners: a 30-day slot reservation, dated steps, documents and a readiness check.' },
];

const RULES = [
  { title: 'One store per pin code', body: 'Existing stores count. A taken pin leads to a redirect, not a dead end.' },
  { title: 'No more approvals than open slots', body: 'Slots are filled in rank order; other qualified applicants are waitlisted.' },
  { title: 'Only inside the territories', body: 'A pin outside every territory is never approved.' },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
          <Logo />
          <a href="/api/template" className="text-sm text-slate-600 transition hover:text-ink">
            Download template
          </a>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 sm:px-6">
        {/* Start */}
        <section className="pt-8 sm:pt-14">
          <h1 className="text-[32px] font-light leading-tight tracking-[-0.02em] text-ink sm:text-[42px]">
            Franchise applications, <span className="font-semibold">decided and explained.</span>
          </h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-600">
            Upload the Applications and Territories workbook. Every applicant gets a decision with its reasons, and the expansion team gets a clear list of what to do next.
          </p>
          <div className="mt-8">
            <StartPanel />
          </div>
        </section>

        {/* What each applicant gets */}
        <section className="mt-16 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-12">
          <div>
            <h2 className="text-xl font-semibold text-ink">What every applicant gets</h2>
            <ul className="mt-5 space-y-5">
              {GETS.map((g) => (
                <li key={g.title} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-brand-600" />
                  <div>
                    <div className="text-sm font-semibold text-ink">{g.title}</div>
                    <p className="mt-0.5 text-sm leading-relaxed text-slate-600">{g.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* A real example from the sample run */}
          <figure className="rounded-3xl bg-white p-6 shadow-card">
            <figcaption className="text-xs font-medium text-slate-500">Example from the sample data</figcaption>
            <div className="mt-3 flex items-start justify-between gap-3">
              <div>
                <div className="font-mono text-sm font-semibold text-ink">APP-007</div>
                <div className="text-xs text-slate-500">Mysuru · 570002 · TER-03</div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 ring-1 ring-inset ring-amber-600/25">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> On hold
              </span>
            </div>
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-xs font-medium text-slate-500">Why</dt>
                <dd className="mt-0.5 leading-relaxed text-ink">No shop space has been found yet. Everything else looks strong (provisional score 69.9).</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">What would change it</dt>
                <dd className="mt-0.5 leading-relaxed text-ink">A confirmed ground-floor space of 200+ sq ft moves it to Approved, ranked #2 for the 2 slots in TER-03.</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Next step</dt>
                <dd className="mt-0.5 leading-relaxed text-ink">Ask for the space details by 9 Nov 2026. The message is ready in Kannada.</dd>
              </div>
            </dl>
          </figure>
        </section>

        {/* The three hard rules */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-ink">Three rules that are never broken</h2>
          <p className="mt-1 text-sm text-slate-600">Checked after every decision, override and update. An override that would break one is refused.</p>
          <ol className="mt-5 grid grid-cols-[minmax(0,1fr)] overflow-hidden rounded-3xl bg-white shadow-card sm:grid-cols-3">
            {RULES.map((r, i) => (
              <li key={r.title} className={`p-6 ${i > 0 ? 'border-t border-slate-100 sm:border-l sm:border-t-0' : ''}`}>
                <div className="text-sm font-semibold text-brand-600">{i + 1}</div>
                <div className="mt-2 text-sm font-semibold text-ink">{r.title}</div>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{r.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* Inside a run */}
        <section className="mt-16">
          <h2 className="text-xl font-semibold text-ink">Inside each run</h2>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
            Today&apos;s action list, an outbox of ready messages, a journey board from agreement to opening day, territory capacity, a policy simulator for testing thresholds before changing them, and a chat for follow-up questions and updates such as “APP-012 has now found a ground-floor space”. Every change is saved as a new version you can compare.
          </p>
        </section>
      </main>

      <footer className="border-t border-slate-300/50">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:px-6">
          <Logo compact />
          <span>No login. Each run gets its own private link.</span>
        </div>
      </footer>
    </div>
  );
}
