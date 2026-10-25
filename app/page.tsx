import UploadPanel from '@/components/UploadPanel';

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-10 sm:px-6 sm:py-16">
      <header className="flex items-center gap-2 text-sm font-semibold text-slate-500">
        <span className="inline-block h-2.5 w-2.5 rounded-sm bg-brand-700" aria-hidden />
        Franchise Onboarding Engine
      </header>

      <section className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:items-start">
        <div>
          <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight text-slate-900 sm:text-5xl">
            From application to an open, trained store, with every decision explained.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-slate-600">
            Upload your Applications and Territories. Every applicant gets a decision with the reasons and numbers behind it, a message in their own language, and an onboarding plan if they move forward. Your team gets a list of what to do today.
          </p>
          <ul className="mt-8 grid max-w-xl gap-3 text-sm text-slate-700 sm:grid-cols-2">
            {[
              ['Instant screening', 'Hard rules first, then a 0–100 score with the reasons behind it'],
              ['Fair slot allocation', 'One store per pin, never more approvals than slots'],
              ['Redirect, not reject', 'Suggests free pins and territories where they would rank'],
              ['Ask follow-ups', '"Why is APP-007 on hold?" or "APP-012 found a ground-floor space"'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="font-medium text-slate-900">{t}</div>
                <div className="mt-0.5 text-slate-500">{d}</div>
              </li>
            ))}
          </ul>
        </div>
        <UploadPanel />
      </section>

      <footer className="mt-auto pt-16 text-xs text-slate-400">
        No login needed. Each run gets a private link. Decisions are made by transparent rules (see &ldquo;Rules in use&rdquo;); AI is only used, when available, to read free text and phrase answers.
      </footer>
    </main>
  );
}
