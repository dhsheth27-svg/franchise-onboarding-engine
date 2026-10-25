// Every threshold, weight and assumption the engine uses. Each entry carries a one-line
// rationale and is rendered verbatim in the "Rules in use" tab. These are team assumptions
// to defend in the deck, not facts about any real brand.

export type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3';
export const TIERS: Tier[] = ['Tier 1', 'Tier 2', 'Tier 3'];

export interface Assumption<T> {
  value: T;
  label: string;
  rationale: string;
}

const a = <T>(value: T, label: string, rationale: string): Assumption<T> => ({ value, label, rationale });

export const CITIES = [
  { city: 'Bengaluru', prefix: '560', tier: 'Tier 1' as Tier },
  { city: 'Mysuru', prefix: '570', tier: 'Tier 2' as Tier },
  { city: 'Mangaluru', prefix: '575', tier: 'Tier 2' as Tier },
  { city: 'Hubballi-Dharwad', prefix: '580', tier: 'Tier 2' as Tier },
  { city: 'Belagavi', prefix: '590', tier: 'Tier 2' as Tier },
  { city: 'Tumakuru', prefix: '572', tier: 'Tier 3' as Tier },
  { city: 'Davanagere', prefix: '577', tier: 'Tier 3' as Tier },
];

export const EXISTING_STORES_DEFAULT = [
  { storeId: 'ST-01', city: 'Bengaluru', pin: '560001', openedYear: 2019 },
  { storeId: 'ST-02', city: 'Bengaluru', pin: '560034', openedYear: 2020 },
  { storeId: 'ST-03', city: 'Bengaluru', pin: '560038', openedYear: 2021 },
  { storeId: 'ST-04', city: 'Bengaluru', pin: '560066', openedYear: 2022 },
  { storeId: 'ST-05', city: 'Bengaluru', pin: '560076', openedYear: 2023 },
  { storeId: 'ST-06', city: 'Mysuru', pin: '570009', openedYear: 2021 },
  { storeId: 'ST-07', city: 'Mysuru', pin: '570017', openedYear: 2024 },
  { storeId: 'ST-08', city: 'Mangaluru', pin: '575001', openedYear: 2022 },
  { storeId: 'ST-09', city: 'Hubballi-Dharwad', pin: '580020', openedYear: 2023 },
  { storeId: 'ST-10', city: 'Belagavi', pin: '590001', openedYear: 2024 },
];

export const config = {
  minInvestmentLakh: a<Record<Tier, number>>(
    { 'Tier 1': 30, 'Tier 2': 20, 'Tier 3': 12 },
    'Minimum investment (₹ lakh)',
    'Security deposit + fit-out + opening inventory + 3 months of working capital; bigger cities cost more on every line.',
  ),
  minSpaceSqft: a<Record<Tier, number>>(
    { 'Tier 1': 250, 'Tier 2': 200, 'Tier 3': 150 },
    'Minimum shop size (sq ft)',
    'Smallest floor plate that fits the standard display, a billing counter and a small stock room.',
  ),
  idealSpaceSqft: a<Record<Tier, [number, number]>>(
    { 'Tier 1': [300, 800], 'Tier 2': [250, 700], 'Tier 3': [200, 600] },
    'Ideal shop size range (sq ft)',
    'Big enough for the full range, small enough that rent stays proportionate to expected sales.',
  ),
  leadTimeMonths: a(
    { withSpace: 2, withoutSpace: 5 },
    'Lead time to open (months)',
    'About 2 months for agreement, fit-out, stock and training once a space exists; finding and securing a space adds roughly 3 more.',
  ),
  defaultTargetLaunchMonths: a(4, 'Default target launch (months)', 'Used when the applicant leaves the field blank; a typical stated ambition in franchise enquiries.'),
  capitalShortfallHoldThreshold: a(
    0.25,
    'Capital shortfall that still gets a hold',
    'A gap of up to 25% can usually be closed with a family contribution or small loan; beyond that the plan is not viable as submitted.',
  ),
  MIN_SCORE_TO_APPROVE: a(50, 'Approval bar (score out of 100)', 'Midpoint of the rubric: an applicant must be at least average across all pillars after passing every gate.'),
  nearMissMargin: a(5, 'Near-miss margin (points)', 'Applicants this close below the bar are held with a clear ask rather than rejected, because one fix lifts them over.'),
  closeCallMargin: a(3, 'Close-call margin (points)', 'A contested slot decided by 3 points or less is shown to the team for a second look.'),
  concentrationWarningShare: a(0.6, 'Concentration warning share', 'If more than 60% of approvals land in one city, growth is not spreading as intended.'),
  weights: a(
    { financial: 25, operator: 20, site: 25, launch: 10, territory: 20 },
    'Pillar weights (sum 100)',
    'Money and site carry most weight because they decide whether a store can open at all; operator skill can be trained; launch timing is the least predictive.',
  ),
  maxCannibalisationDeduction: a(10, 'Maximum cannibalisation deduction (points)', 'Enough to break ties against crowding existing stores without overruling a strong applicant.'),
  cityStoreSaturation: a<Record<Tier, number>>(
    { 'Tier 1': 8, 'Tier 2': 3, 'Tier 3': 2 },
    'Stores per city before it counts as crowded',
    'Rough catchment capacity per city size; used to scale the city part of the cannibalisation deduction (up to 4 points).',
  ),
  pinClosenessDeduction: a(
    { sameFirst5: 6, sameFirst4: 3 },
    'Pin-closeness deduction (points)',
    'Stand-in for distance because no coordinates are provided: pins sharing 5 digits are usually neighbouring areas, 4 digits the same broad zone.',
  ),
  reservationDays: a(30, 'Slot reservation window (days)', 'Time an approved partner has to sign the agreement and confirm the space before the slot goes to the waitlist.'),
  conditionDays: a(14, 'Condition deadline (days)', 'Conditions are small clarifications; two weeks keeps momentum without being unreasonable.'),
  dueSoonDays: a(7, '"Due soon" window (days)', 'One working week of notice before a deadline lapses.'),
  riskThresholds: a(
    { longGapMonths: 9, thinCapitalRatio: 1.1 },
    'Drop-off risk thresholds',
    'Partners waiting more than 9 months tend to lose interest; capital within 10% of the minimum leaves no buffer for overruns.',
  ),
  paybackAssumptions: a(
    {
      revenuePerSqftMonth: { 'Tier 1': 1500, 'Tier 2': 1100, 'Tier 3': 900 } as Record<Tier, number>,
      grossMarginPct: 40,
      baseCostsMonthLakh: { 'Tier 1': 0.6, 'Tier 2': 0.4, 'Tier 3': 0.3 } as Record<Tier, number>,
      rentPerSqftMonth: { 'Tier 1': 150, 'Tier 2': 80, 'Tier 3': 50 } as Record<Tier, number>,
    },
    'Payback assumptions (ILLUSTRATIVE)',
    'Illustrative benchmarks only: monthly sales per sq ft, gross margin, staff + utilities, and rent per sq ft (zero if the space is owned). Payback = minimum investment / monthly profit. Shown for context, never scored.',
  ),
  festivals: a<Record<string, string>>(
    { 'Diwali 2026': '2026-11-08', 'Diwali 2027': '2027-10-29' },
    'Festival dates',
    'Applicants often tie openings to festivals; used to check notes like "before Diwali" against the target launch (Diwali 2026 = 8 Nov 2026).',
  ),
  impossibleValues: a(
    { maxExperienceYears: 60, maxSpaceSqft: 20000, maxInvestmentLakh: 10000, maxTargetLaunchMonths: 60 },
    'Impossible-value limits',
    'Values beyond these are almost certainly typing errors and are held for confirmation rather than scored.',
  ),
  onboardingWeeks: a(
    { agreement: 2, spaceVerification: 2, fitOut: 4, staffHiring: 3, inventorySetup: 2, readinessCheck: 1, softLaunch: 1 },
    'Onboarding stage durations (weeks)',
    'Typical small-format retail roll-out: legal and KYC in 2 weeks, fit-out in about a month, hiring and stock set-up in parallel.',
  ),
  trainingWeeks: a(
    { Extended: 4, Standard: 2, Compressed: 1 },
    'Training length by track (weeks)',
    '0–1 years of experience: extended programme with a mentor and supervised pilot weeks; 2–4 years: standard; 5+ years: compressed, brand processes only.',
  ),
  monthDays: a(30, 'Days per month (for date maths)', 'Simple 30-day months keep deadlines easy to explain.'),
};

export type Config = typeof config;

/** Plain values of the config, as the engine consumes them. */
export type ConfigValues = { [K in keyof Config]: Config[K]['value'] };

export function configValues(c: Config = config): ConfigValues {
  return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.value])) as ConfigValues;
}

export const HARD_RULES = [
  'Never two stores in the same pin code (existing stores count).',
  'Never more approvals in a territory than its open slots.',
  'Never approve an applicant whose pin is outside all territories.',
];
