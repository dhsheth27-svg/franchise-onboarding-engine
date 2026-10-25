import { Eyebrow, Headline, Logo, Reveal } from '@/components/ui';
import UploadPanel from '@/components/UploadPanel';

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-canvas/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <a
            href="/api/template"
            className="rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 ring-1 ring-slate-400 transition duration-200 hover:bg-[#F4F4F6] hover:text-black hover:ring-[#F4F4F6]"
          >
            Download template
          </a>
        </div>
      </header>

      {/* Start */}
      <main className="relative flex flex-1 items-center overflow-hidden">
        <div className="bg-dots pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]" aria-hidden />
        <div className="relative mx-auto w-full max-w-6xl px-4 py-16 text-center sm:px-6 sm:py-24">
          <Reveal>
            <Eyebrow>
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-600 not-italic" /> Franchise partner onboarding
            </Eyebrow>
          </Reveal>
          <Reveal delay={80}>
            <Headline as="h1" lead="Smart decisions for" rest="franchise growth" className="mx-auto mt-6 max-w-4xl text-[42px] sm:text-[76px]" />
          </Reveal>
          <Reveal delay={160}>
            <p className="mx-auto mt-6 max-w-xl text-[15px] leading-relaxed text-slate-600">
              Upload your Applications and Territories workbook. Every applicant gets a decision with the reasons behind it, a message in their language, and an onboarding plan if they move forward.
            </p>
          </Reveal>
          <Reveal delay={240} className="mx-auto mt-9 max-w-2xl text-left">
            <UploadPanel />
          </Reveal>
        </div>
      </main>

      <footer className="border-t border-slate-200/60">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="uppercase tracking-wider">No login needed · each run gets its own private link</p>
        </div>
      </footer>
    </div>
  );
}
