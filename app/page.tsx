import { IconArrow, IconChat, IconCheck, IconClock, IconGrid, IconInbox, IconList, IconMap, IconRoute, IconShield, IconSliders, IconTable, IconUpload } from '@/components/icons';
import { Logo } from '@/components/ui';
import DemoStartButton from '@/components/DemoStartButton';
import UploadPanel from '@/components/UploadPanel';

// Every figure in the preview comes from the built-in sample run (29 applications, 7 territories, as of 26 Oct 2026).
const DEMAND = [
  { id: 'TER-01', apps: 8, slots: 4 },
  { id: 'TER-02', apps: 2, slots: 2 },
  { id: 'TER-03', apps: 4, slots: 2 },
  { id: 'TER-04', apps: 5, slots: 1 },
  { id: 'TER-05', apps: 1, slots: 0 },
  { id: 'TER-06', apps: 5, slots: 2 },
  { id: 'TER-07', apps: 2, slots: 1 },
];
// Scores of the 27 applicants that could be scored, counted in 5-point bands from 40 to 100.
const SCORE_BANDS = [1, 1, 0, 2, 1, 7, 5, 4, 4, 1, 0, 1];

/** Smooth path through points (Catmull-Rom converted to cubic Béziers). */
function smooth(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function DemandChart() {
  const W = 420, H = 150, pad = 8, max = 8;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (DEMAND.length - 1);
  const y = (v: number) => H - 14 - (v / max) * (H - 30);
  const apps = DEMAND.map((d, i) => [x(i), y(d.apps)] as [number, number]);
  const slots = DEMAND.map((d, i) => [x(i), y(d.slots)] as [number, number]);
  const tip = 3; // TER-04: 5 applicants for 1 slot
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Applications versus open slots per territory in the sample run">
        {[0, 2, 4, 6, 8].map((v) => (
          <line key={v} x1={pad} x2={W - pad} y1={y(v)} y2={y(v)} stroke="#EFEFF9" strokeWidth="1" />
        ))}
        <path d={`${smooth(apps)} L${x(DEMAND.length - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#appsFill)" />
        <path d={smooth(apps)} fill="none" stroke="#F4A3C3" strokeWidth="2.5" strokeLinecap="round" />
        <path d={smooth(slots)} fill="none" stroke="#8ED8F0" strokeWidth="2.5" strokeLinecap="round" />
        {apps.map(([cx, cy], i) => (
          <circle key={`a${i}`} cx={cx} cy={cy} r={i === tip ? 6 : 3.5} fill="#4B33B2" stroke="#fff" strokeWidth={i === tip ? 3 : 1.5} />
        ))}
        {slots.map(([cx, cy], i) => (
          <circle key={`s${i}`} cx={cx} cy={cy} r="3.5" fill="#4B33B2" stroke="#fff" strokeWidth="1.5" />
        ))}
        {DEMAND.map((d, i) => (
          <text key={d.id} x={x(i)} y={H + 12} textAnchor="middle" fontSize="9.5" fill="#9B99BD">
            {d.id.replace('TER-', 'T')}
          </text>
        ))}
        <defs>
          <linearGradient id="appsFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#F4A3C3" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#F4A3C3" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl bg-brand-600 px-3 py-1.5 text-white shadow-btn" style={{ left: `${(x(tip) / W) * 100}%`, top: `calc(${(y(5) / (H + 16)) * 100}% - 12px)` }}>
        <div className="text-[9px] text-white/70">TER-04 · Mangaluru</div>
        <div className="whitespace-nowrap text-xs font-semibold">5 applicants · 1 slot</div>
      </div>
    </div>
  );
}

function ScoreCurve() {
  const W = 300, H = 110, pad = 6, max = 7;
  const x = (i: number) => pad + (i * (W - pad * 2)) / (SCORE_BANDS.length - 1);
  const y = (v: number) => H - 8 - (v / max) * (H - 22);
  const pts = SCORE_BANDS.map((v, i) => [x(i), y(v)] as [number, number]);
  const bar = x(2); // the approval bar (score 50) sits at the start of the third band
  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="Distribution of applicant scores in the sample run">
      <path d={`${smooth(pts)} L${x(SCORE_BANDS.length - 1)},${H - 8} L${x(0)},${H - 8} Z`} fill="url(#scoreFill)" />
      <path d={smooth(pts)} fill="none" stroke="#4B33B2" strokeWidth="2.5" strokeLinecap="round" />
      {pts.map(([cx, cy], i) => (SCORE_BANDS[i] >= 4 || i === 0 || i === SCORE_BANDS.length - 1 ? <circle key={i} cx={cx} cy={cy} r="3.5" fill="#4B33B2" stroke="#fff" strokeWidth="1.5" /> : null))}
      <line x1={bar} x2={bar} y1="6" y2={H - 8} stroke="#F4A3C3" strokeWidth="1.5" strokeDasharray="3 3" />
      <text x={bar + 5} y="14" fontSize="9" fill="#C24E80">approval bar 50</text>
      {[40, 60, 80, 95].map((v) => (
        <text key={v} x={x((v - 40) / 5)} y={H + 12} textAnchor={v === 95 ? 'end' : v === 40 ? 'start' : 'middle'} fontSize="9.5" fill="#9B99BD">
          {v === 95 ? '95+' : v}
        </text>
      ))}
      <defs>
        <linearGradient id="scoreFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#8471DA" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#8471DA" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const MOCK_NAV = [
  { label: 'Overview', icon: <IconGrid className="h-4 w-4" /> },
  { label: 'Today', icon: <IconClock className="h-4 w-4" /> },
  { label: 'Outbox', icon: <IconInbox className="h-4 w-4" /> },
  { label: 'Decisions', icon: <IconTable className="h-4 w-4" /> },
  { label: 'Journey', icon: <IconRoute className="h-4 w-4" /> },
  { label: 'Policy', icon: <IconSliders className="h-4 w-4" /> },
];

const MOCK_LIST = [
  { id: 'APP-001', where: 'Bengaluru', score: '85.2', label: 'Approved', cls: 'bg-emerald-50 text-emerald-800' },
  { id: 'APP-009', where: 'Mangaluru', score: '73.0', label: 'Conditions', cls: 'bg-teal-50 text-teal-800' },
  { id: 'APP-007', where: 'Mysuru', score: '69.9', label: 'On hold', cls: 'bg-amber-50 text-amber-900' },
];

/** A preview of the product built from the real sample run, composed like a dashboard shot. */
function AppPreview() {
  return (
    <div className="relative pb-32 sm:pb-36">
      <div className="flex rounded-[30px] bg-brand-600 p-2 shadow-paper sm:p-2.5 sm:pl-0">
        {/* Sidebar */}
        <div className="hidden w-[132px] flex-none flex-col py-4 pl-4 text-white sm:flex">
          <span className="px-2">
            <Logo light compact />
          </span>
          <div className="mt-7 space-y-1">
            {MOCK_NAV.map((n, i) => (
              <div key={n.label} className={`flex items-center gap-2 py-2 pl-2.5 text-[11px] font-medium ${i === 0 ? 'rounded-l-xl bg-white text-ink' : 'text-white/70'}`}>
                <span className={i === 0 ? 'text-brand-600' : ''}>{n.icon}</span>
                {n.label}
              </div>
            ))}
          </div>
        </div>
        {/* Panel */}
        <div className="min-w-0 flex-1 rounded-[24px] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="text-[17px] font-light text-ink sm:text-xl">
              Expansion <span className="font-semibold">control room</span>
            </div>
            <span className="hidden rounded-xl bg-slate-100 px-2.5 py-1 text-[10px] text-slate-500 sm:inline">as of 26 Oct 2026</span>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-pastel-cyan p-3 transition duration-300 hover:-translate-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-ink">
                  <IconTable className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-ink">29</span>
                    <span className="rounded-md bg-ink px-1.5 text-[9px] font-semibold text-white">explained</span>
                  </div>
                  <div className="text-[10px] font-medium text-ink">Decided</div>
                </div>
              </div>
            </div>
            <div className="rounded-2xl bg-pastel-pink p-3 transition duration-300 hover:-translate-y-0.5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-white text-ink">
                  <IconMap className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-bold text-ink">7</span>
                    <span className="rounded-md bg-ink px-1.5 text-[9px] font-semibold text-white">of 11</span>
                  </div>
                  <div className="text-[10px] font-medium text-ink">Slots filled</div>
                </div>
              </div>
            </div>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-ink">Demand vs open slots</span>
                <span className="flex items-center gap-2 text-[9px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-full bg-[#F4A3C3]" />
                    applied
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-1.5 w-3 rounded-full bg-[#8ED8F0]" />
                    slots
                  </span>
                </span>
              </div>
              <div className="mt-8">
                <DemandChart />
              </div>
            </div>
            <div className="hidden sm:block">
              <div className="text-xs font-semibold text-ink">Top of the list</div>
              <ul className="mt-3 space-y-2.5">
                {MOCK_LIST.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-2">
                    <span className="w-2 text-[10px] text-slate-400">{i + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[11px] font-semibold text-ink">{m.id}</div>
                      <div className="text-[10px] text-slate-500">
                        {m.where} · {m.score}
                      </div>
                    </div>
                    <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${m.cls}`}>{m.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Floating card: score distribution */}
      <div className="absolute bottom-0 right-0 w-[78%] animate-float rounded-[24px] bg-white p-4 shadow-paper sm:-right-4 sm:w-[52%] sm:p-5 lg:-right-8">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-ink">Applicant scores</span>
          <span className="rounded-lg border border-slate-200 px-2 py-0.5 text-[10px] text-slate-500">27 scored</span>
        </div>
        <div className="mt-2">
          <ScoreCurve />
        </div>
      </div>

      {/* Floating chip: follow-up */}
      <div className="absolute bottom-6 left-0 hidden max-w-[220px] animate-float-slow rounded-2xl rounded-bl-md bg-ink px-4 py-3 text-xs text-white shadow-paper sm:block lg:-left-8">
        <div className="text-[10px] text-white/60">Ask</div>
        “Why is APP-007 on hold?”
      </div>
    </div>
  );
}

const RULES = [
  { n: '1', title: 'Never two stores in one pin code', body: 'Existing stores count. A taken pin becomes a redirect to a free one, not a dead end.', tone: 'bg-pastel-cyan' },
  { n: '2', title: 'Never more approvals than open slots', body: 'Slots go in rank order. Everyone else who qualifies is waitlisted with their position.', tone: 'bg-pastel-pink' },
  { n: '3', title: 'Never approve outside the territories', body: 'A pin outside every territory can be shown its nearest option, never a slot.', tone: 'bg-pastel-violet' },
];

const STEPS = [
  { icon: <IconUpload className="h-5 w-5" />, title: 'Upload', body: 'The case workbook as it is. Pins like “570001.0”, “₹25 lakh”, “GF” and duplicates are cleaned and flagged, never crashed on.', tone: 'bg-pastel-cyan' },
  { icon: <IconShield className="h-5 w-5" />, title: 'Screen', body: 'Seven hard gates, each one recorded. A fixable gap becomes a hold with a specific ask and a deadline, not a rejection.', tone: 'bg-pastel-pink' },
  { icon: <IconTable className="h-5 w-5" />, title: 'Score & allocate', body: 'Five weighted pillars minus a cannibalisation deduction. Slots are filled in rank order, one store per pin.', tone: 'bg-pastel-violet' },
  { icon: <IconCheck className="h-5 w-5" />, title: 'Act', body: 'Messages in English, Kannada or Hindi, onboarding plans, 30-day slot reservations and a ranked list of what to do today.', tone: 'bg-pastel-mint' },
];

const FEATURES = [
  { icon: <IconList className="h-5 w-5" />, title: 'Today', body: 'One queue ranked by value: who to call, what to ask for and by when.', tone: 'bg-pastel-cyan' },
  { icon: <IconChat className="h-5 w-5" />, title: 'Ask anything', body: '“Why is APP-007 on hold?” or “APP-012 found a ground-floor space”: answered, or re-decided with exactly what changed.', tone: 'bg-pastel-pink' },
  { icon: <IconRoute className="h-5 w-5" />, title: 'Journey board', body: 'Every approved partner by stage, from agreement to opening day, with overdue flags and the bottleneck.', tone: 'bg-pastel-violet' },
  { icon: <IconArrow className="h-5 w-5" />, title: 'Outbox', body: 'Every message in the applicant’s language, one tap to WhatsApp or email, tracked as sent.', tone: 'bg-pastel-mint' },
  { icon: <IconSliders className="h-5 w-5" />, title: 'Policy simulator', body: 'Move the approval bar or a territory’s slots and see who changes before you commit.', tone: 'bg-pastel-cyan' },
  { icon: <IconShield className="h-5 w-5" />, title: 'Overrides on record', body: 'Overrule the tool with a name and a reason. The three hard rules still hold.', tone: 'bg-pastel-pink' },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-canvas/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Logo />
          <nav className="flex items-center gap-1 text-sm">
            <a href="#how" className="hidden rounded-xl px-3 py-1.5 text-slate-600 transition hover:text-ink sm:inline-flex">
              How it works
            </a>
            <a href="#rules" className="hidden rounded-xl px-3 py-1.5 text-slate-600 transition hover:text-ink sm:inline-flex">
              The rules
            </a>
            <a href="/api/template" className="ml-1 rounded-xl bg-white px-4 py-2 font-medium text-ink shadow-card transition duration-200 hover:-translate-y-px hover:shadow-lift">
              Template
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section id="start" className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-14 px-4 pb-16 pt-8 sm:px-6 sm:pt-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-12 lg:pb-24">
          <div>
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-medium text-brand-700 shadow-card">
              <span className="h-1.5 w-1.5 animate-pulse-dot rounded-full bg-brand-600" /> Franchise partner onboarding · Karnataka
            </span>
            <h1 className="mt-5 animate-fade-up text-[40px] font-light leading-[1.08] tracking-[-0.03em] text-ink sm:text-[54px]" style={{ animationDelay: '80ms' }}>
              Every applicant, <span className="font-semibold">decided and explained.</span>
            </h1>
            <p className="mt-5 max-w-[30rem] animate-fade-up text-[15px] leading-relaxed text-slate-600" style={{ animationDelay: '160ms' }}>
              Upload your Applications and Territories workbook. Opsmith screens every applicant, fills territory slots without breaking the three hard rules, and hands your team the messages, onboarding plans and today’s to-do list.
            </p>
            <div className="mt-8 max-w-xl animate-fade-up" style={{ animationDelay: '240ms' }}>
              <UploadPanel />
            </div>
            <div className="mt-5 flex animate-fade-up flex-wrap items-center gap-x-4 gap-y-3" style={{ animationDelay: '320ms' }}>
              <DemoStartButton />
              <span className="text-xs text-slate-500">No login · each run gets its own private link</span>
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '200ms' }}>
            <AppPreview />
          </div>
        </section>

        {/* The three hard rules */}
        <section id="rules" className="scroll-mt-20 px-4 sm:px-6">
          <div className="mx-auto max-w-6xl rounded-[36px] bg-brand-600 px-6 py-12 text-white shadow-paper sm:px-10 sm:py-14">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="max-w-xl text-[30px] font-light leading-tight tracking-[-0.02em] sm:text-[40px]">
                Three rules it will <span className="font-semibold">never break.</span>
              </h2>
              <p className="max-w-sm text-sm leading-relaxed text-white/75">Checked after every decision, every override and every follow-up. An override that would break one is refused, with the reason.</p>
            </div>
            <ol className="mt-10 grid gap-4 sm:grid-cols-3">
              {RULES.map((r) => (
                <li key={r.n} className="rounded-[26px] bg-white p-6 text-ink transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-lg font-bold ${r.tone}`}>{r.n}</span>
                  <h3 className="mt-5 text-base font-semibold leading-snug">{r.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{r.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="scroll-mt-20">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <h2 className="max-w-2xl text-[30px] font-light leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">
              From spreadsheet to partner, <span className="font-semibold">in four steps.</span>
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map((s, i) => (
                <li key={s.title} className="rounded-[26px] bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl text-ink ${s.tone}`}>{s.icon}</span>
                    <span className="text-sm font-semibold text-slate-300">0{i + 1}</span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* What the team gets */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-2xl text-[30px] font-light leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">
              Not just a verdict. <span className="font-semibold">A plan for Monday.</span>
            </h2>
            <p className="max-w-sm text-sm leading-relaxed text-slate-600">Every decision comes with the next step, the person to contact and the message to send.</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <li key={f.title} className="group flex gap-4 rounded-[26px] bg-white p-6 shadow-card transition duration-300 hover:-translate-y-1 hover:shadow-lift">
                <span className={`inline-flex h-11 w-11 flex-none items-center justify-center rounded-2xl text-ink transition duration-300 group-hover:bg-brand-600 group-hover:text-white ${f.tone}`}>{f.icon}</span>
                <div>
                  <h3 className="text-base font-semibold text-ink">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{f.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing call to action */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="relative overflow-hidden rounded-[36px] bg-ink px-6 py-12 text-white sm:px-12 sm:py-14">
            <div className="bg-ledger pointer-events-none absolute inset-0 [mask-image:linear-gradient(to_left,black,transparent_70%)]" aria-hidden />
            <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-brand-500/40 blur-3xl" aria-hidden />
            <div className="relative flex flex-wrap items-end justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="text-[30px] font-light leading-tight tracking-[-0.02em] sm:text-[40px]">
                  See it decide 29 messy applications <span className="font-semibold">in under a minute.</span>
                </h2>
                <ul className="mt-6 space-y-2 text-sm text-white/80">
                  {['An explained hold, and the update that clears it', 'A withdrawal that promotes the waitlist', 'An override the hard rules refuse'].map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-pastel-mint text-ink">
                        <IconCheck className="h-3 w-3" />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-col items-start gap-3">
                <DemoStartButton tone="dark" />
                <a href="#start" className="text-sm text-white/70 underline-offset-4 hover:text-white hover:underline">
                  or upload your own workbook ↑
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 pb-8 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p>Decisions explained · hard rules enforced · no login</p>
        </div>
      </footer>
    </div>
  );
}
