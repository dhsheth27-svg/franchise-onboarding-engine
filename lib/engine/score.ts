// Layer 3: the 0-100 rubric. Five weighted pillars minus a cannibalisation deduction.
// The applicant's name and personal attributes are never read here.

import type { ConfigValues, Tier } from '../config';
import { fmtNum, round1, toDate } from './normalize';
import type { Application, Pillar, Pillars, Store, Territory } from './types';

export interface ScoreContext {
  tier: Tier;
  territory: Territory | null;
  stores: Store[];
  today: string;
}

export interface ScoreResult {
  score: number;
  pillars: Pillars;
  provisional: boolean;
  assumedSpace: boolean;
  paybackMonths: number | null;
  investmentRatio: number;
}

function interp(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x0, y0] = points[i - 1];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return points[points.length - 1][1];
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

function pillar(key: Pillar['key'], label: string, raw: number, weight: number, explanation: string): Pillar {
  const r = round1(clamp(raw));
  return { key, label, raw: r, weight, points: round1((r * weight) / 100), explanation };
}

export function hasSpace(app: Application): boolean {
  return app.space === 'Owned' || app.space === 'Rented';
}

/** Can this applicant be scored at all? Needs money, experience and a tier. */
export function canScore(app: Application, tier: Tier | null): boolean {
  return app.investmentLakh !== null && app.experienceYears !== null && tier !== null;
}

export function paybackMonths(cfg: ConfigValues, tier: Tier, sqft: number, owned: boolean): number | null {
  const p = cfg.paybackAssumptions;
  const revenue = sqft * p.revenuePerSqftMonth[tier];
  const gross = (revenue * p.grossMarginPct) / 100;
  const costs = p.baseCostsMonthLakh[tier] * 100000 + (owned ? 0 : sqft * p.rentPerSqftMonth[tier]);
  const profit = gross - costs;
  if (profit <= 0) return null;
  return Math.round((cfg.minInvestmentLakh[tier] * 100000) / profit);
}

export function scoreApplication(app: Application, ctx: ScoreContext, cfg: ConfigValues): ScoreResult {
  const { tier, territory, stores, today } = ctx;
  const w = cfg.weights;
  const minInv = cfg.minInvestmentLakh[tier];
  const investment = app.investmentLakh ?? 0;
  const experience = app.experienceYears ?? 0;

  // Financial strength
  const ratio = investment / minInv;
  const finRaw = ratio < 1 ? 40 * ratio : interp(ratio, [[1, 50], [1.5, 75], [2, 100]]);
  const financial = pillar(
    'financial',
    'Financial strength',
    finRaw,
    w.financial,
    `₹${fmtNum(investment)} lakh against the ${tier} minimum of ₹${minInv} lakh (${fmtNum(round1(ratio))}x).`,
  );

  // Operator capability
  const expRaw = interp(experience, [[0, 0], [1, 30], [2, 55], [3, 70], [5, 90], [7, 100]]);
  const relevanceRaw = { high: 100, medium: 60, low: 20, unknown: 40 }[app.signals.relevance];
  let deduction = 0;
  const dedWhy: string[] = [];
  if (app.signals.commitment === 'partial' && !app.signals.hiresManager) {
    deduction += 10;
    dedWhy.push('works part-time or runs it on the side');
  }
  if (app.signals.hiresManager) {
    deduction += 10;
    dedWhy.push('plans to hire a manager');
  }
  deduction = Math.min(15, deduction);
  const opRaw = 0.6 * expRaw + 0.4 * relevanceRaw - deduction;
  const operator = pillar(
    'operator',
    'Operator capability',
    opRaw,
    w.operator,
    `${fmtNum(experience)} years of retail experience; business background "${app.signals.businessCategory}" is ${app.signals.relevance} relevance${deduction ? `; −${deduction} because the applicant ${dedWhy.join(' and ')}` : ''}.`,
  );

  // Site readiness (no space yet: assume a minimum compliant rented space, flagged as provisional)
  const assumedSpace = !hasSpace(app);
  const tenure = assumedSpace ? 'Rented' : app.space!;
  const sqft = assumedSpace ? cfg.minSpaceSqft[tier] : app.spaceSqft ?? cfg.minSpaceSqft[tier];
  const floor = assumedSpace ? null : app.floor;
  const tenureRaw = tenure === 'Owned' ? 100 : 75;
  const [lo, hi] = cfg.idealSpaceSqft[tier];
  const minS = cfg.minSpaceSqft[tier];
  let sizeRaw: number;
  if (sqft < minS) sizeRaw = (40 * sqft) / minS;
  else if (sqft < lo) sizeRaw = interp(sqft, [[minS, 40], [lo, 100]]);
  else if (sqft <= 2 * hi) sizeRaw = 100;
  else sizeRaw = Math.max(40, interp(sqft, [[2 * hi, 100], [4 * hi, 40]]));
  const floorRaw = floor === 'Ground' ? 100 : floor === 'Mall unit' ? 90 : floor === 'Upper' ? 50 : 40;
  const siteRaw = 0.4 * tenureRaw + 0.35 * sizeRaw + 0.25 * floorRaw;
  const site = pillar(
    'site',
    'Site readiness',
    siteRaw,
    w.site,
    assumedSpace
      ? `No space yet: provisionally scored as a rented ${minS} sq ft space on an unknown floor (the minimum that would clear the hold).`
      : `${tenure}, ${fmtNum(sqft)} sq ft (ideal ${lo}–${hi}), ${floor ?? 'floor not known'}.`,
  );

  // Launch realism
  const needed = hasSpace(app) ? cfg.leadTimeMonths.withSpace : cfg.leadTimeMonths.withoutSpace;
  const t = app.effectiveLaunchMonths;
  let launchRaw: number;
  if (t >= needed) launchRaw = t > 12 ? Math.max(70, 100 - 5 * (t - 12)) : 100;
  else launchRaw = Math.max(0, 100 - 25 * (needed - t));
  const launch = pillar(
    'launch',
    'Launch realism',
    launchRaw,
    w.launch,
    t >= needed
      ? `Target of ${fmtNum(t)} months${app.targetLaunchMonths === null ? ' (default)' : ''} allows the ${needed}-month lead time${t > 12 ? ', but holds a slot for over a year' : ''}.`
      : `Target of ${fmtNum(t)} months is ${fmtNum(needed - t)} month(s) shorter than the ${needed}-month lead time.`,
  );

  // Territory value
  const priority = territory?.priority ?? null;
  const prioRaw = priority === 'High' ? 100 : priority === 'Medium' ? 65 : priority === 'Low' ? 35 : 0;
  const city = territory?.city ?? app.pinCity ?? app.city;
  const year = toDate(today).getUTCFullYear();
  const cityStores = stores.filter((s) => s.city === city);
  const matureStore = cityStores.some((s) => year - s.openedYear >= 2);
  const maturityRaw = matureStore ? 100 : cityStores.length ? 60 : 40;
  const territoryP = pillar(
    'territory',
    'Territory value',
    0.6 * prioRaw + 0.4 * maturityRaw,
    w.territory,
    `${territory ? `${territory.id} is ${priority} priority` : 'Not inside any target territory'}; ${city} has ${cityStores.length} existing store${cityStores.length === 1 ? '' : 's'}${matureStore ? ', at least one open 2+ years (proven market)' : cityStores.length ? ', all opened recently' : ' (untested market)'}.`,
  );

  // Cannibalisation deduction
  const saturation = cfg.cityStoreSaturation[tier];
  const cityPart = Math.min(1, cityStores.length / saturation) * 4;
  let pinPart = 0;
  let nearest: string | null = null;
  if (app.pin) {
    for (const s of stores) {
      if (s.pin === app.pin) continue;
      const pts = s.pin.slice(0, 5) === app.pin.slice(0, 5) ? cfg.pinClosenessDeduction.sameFirst5 : s.pin.slice(0, 4) === app.pin.slice(0, 4) ? cfg.pinClosenessDeduction.sameFirst4 : 0;
      if (pts > pinPart) {
        pinPart = pts;
        nearest = `${s.storeId} (${s.pin})`;
      }
    }
  }
  const dedPoints = round1(Math.min(cfg.maxCannibalisationDeduction, cityPart + pinPart));
  const cannibalisationDeduction = {
    points: dedPoints,
    max: cfg.maxCannibalisationDeduction,
    explanation:
      dedPoints === 0
        ? 'No existing stores nearby.'
        : `${cityStores.length} existing store(s) in ${city} (−${round1(cityPart)})${nearest ? `; pin is numerically close to ${nearest} (−${pinPart})` : ''}. Pin closeness is a stand-in for distance because no map coordinates are provided.`,
  };

  const pillars: Pillars = { financial, operator, site, launch, territory: territoryP, cannibalisationDeduction };
  const total = financial.points + operator.points + site.points + launch.points + territoryP.points - dedPoints;
  const score = round1(clamp(total));
  return {
    score,
    pillars,
    provisional: assumedSpace,
    assumedSpace,
    paybackMonths: paybackMonths(cfg, tier, hasSpace(app) ? app.spaceSqft ?? minS : lo, app.space === 'Owned'),
    investmentRatio: ratio,
  };
}

export function weakestPillar(p: Pillars): Pillar {
  return [p.financial, p.operator, p.site, p.launch, p.territory].sort((a, b) => a.raw - b.raw)[0];
}
