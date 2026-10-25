// Run-level policy: the expansion team's own calibration of thresholds and territory slots.
// A policy is stored on the run input, so every version is reproducible, and every change is logged.

import { z } from 'zod';
import { config as defaultConfig, type Config, type Tier } from './config';
import type { EngineInput } from './engine/types';
import { asText } from './engine/normalize';

const tierNums = z.object({ 'Tier 1': z.number(), 'Tier 2': z.number(), 'Tier 3': z.number() }).partial();

export const PolicySchema = z
  .object({
    MIN_SCORE_TO_APPROVE: z.number().min(0).max(100),
    nearMissMargin: z.number().min(0).max(20),
    capitalShortfallHoldThreshold: z.number().min(0).max(0.9),
    minInvestmentLakh: tierNums,
    minSpaceSqft: tierNums,
    reservationDays: z.number().int().min(7).max(120),
    conditionDays: z.number().int().min(3).max(60),
    weights: z.object({ financial: z.number(), operator: z.number(), site: z.number(), launch: z.number(), territory: z.number() }).partial(),
    territorySlots: z.record(z.string(), z.number().int().min(0).max(50)),
  })
  .partial();

export type Policy = z.infer<typeof PolicySchema>;

/** Config with the policy's values applied (labels and rationales kept; changed values are marked). */
export function effectiveConfig(policy: Policy | undefined, base: Config = defaultConfig): Config {
  if (!policy) return base;
  const c = structuredClone(base) as Config;
  const mark = <K extends keyof Config>(key: K, value: Config[K]['value']) => {
    (c[key] as { value: unknown; rationale: string }).value = value;
    if (!c[key].rationale.startsWith('Team policy')) (c[key] as { rationale: string }).rationale = `Team policy (changed from the default). ${base[key].rationale}`;
  };
  if (policy.MIN_SCORE_TO_APPROVE !== undefined) mark('MIN_SCORE_TO_APPROVE', policy.MIN_SCORE_TO_APPROVE);
  if (policy.nearMissMargin !== undefined) mark('nearMissMargin', policy.nearMissMargin);
  if (policy.capitalShortfallHoldThreshold !== undefined) mark('capitalShortfallHoldThreshold', policy.capitalShortfallHoldThreshold);
  if (policy.reservationDays !== undefined) mark('reservationDays', policy.reservationDays);
  if (policy.conditionDays !== undefined) mark('conditionDays', policy.conditionDays);
  if (policy.minInvestmentLakh && Object.keys(policy.minInvestmentLakh).length) mark('minInvestmentLakh', { ...base.minInvestmentLakh.value, ...policy.minInvestmentLakh } as Record<Tier, number>);
  if (policy.minSpaceSqft && Object.keys(policy.minSpaceSqft).length) mark('minSpaceSqft', { ...base.minSpaceSqft.value, ...policy.minSpaceSqft } as Record<Tier, number>);
  if (policy.weights && Object.keys(policy.weights).length) mark('weights', { ...base.weights.value, ...policy.weights });
  return c;
}

/** Input with the policy's territory slot overrides applied to the uploaded territory rows. */
export function effectiveInput<T extends EngineInput>(input: T): T {
  const slots = input.policy?.territorySlots;
  if (!slots || !Object.keys(slots).length) return input;
  return {
    ...input,
    territories: input.territories.map((t) => {
      const id = asText(t.territoryId);
      return id in slots ? { ...t, openSlots: slots[id] } : t;
    }),
  };
}

/** Merge a new policy change into the run's current policy. */
export function mergePolicy(current: Policy | undefined, change: Policy): Policy {
  return {
    ...current,
    ...change,
    minInvestmentLakh: { ...current?.minInvestmentLakh, ...change.minInvestmentLakh },
    minSpaceSqft: { ...current?.minSpaceSqft, ...change.minSpaceSqft },
    weights: { ...current?.weights, ...change.weights },
    territorySlots: { ...current?.territorySlots, ...change.territorySlots },
  };
}

/** Plain-language description of a change, for version labels and the log. */
export function describePolicyChange(change: Policy, cfg: Config, territories: { id: string; openSlots: number }[]): string {
  const parts: string[] = [];
  const v = (k: keyof Config) => JSON.stringify(cfg[k].value);
  if (change.MIN_SCORE_TO_APPROVE !== undefined) parts.push(`approval bar ${v('MIN_SCORE_TO_APPROVE')} → ${change.MIN_SCORE_TO_APPROVE}`);
  if (change.nearMissMargin !== undefined) parts.push(`near-miss margin → ${change.nearMissMargin}`);
  if (change.capitalShortfallHoldThreshold !== undefined) parts.push(`capital gap held up to ${Math.round(change.capitalShortfallHoldThreshold * 100)}%`);
  if (change.reservationDays !== undefined) parts.push(`reservation window → ${change.reservationDays} days`);
  if (change.conditionDays !== undefined) parts.push(`condition deadline → ${change.conditionDays} days`);
  for (const [t, n] of Object.entries(change.minInvestmentLakh ?? {})) parts.push(`${t} minimum investment → ₹${n} lakh`);
  for (const [t, n] of Object.entries(change.minSpaceSqft ?? {})) parts.push(`${t} minimum space → ${n} sq ft`);
  for (const [k, n] of Object.entries(change.weights ?? {})) parts.push(`${k} weight → ${n}`);
  for (const [id, n] of Object.entries(change.territorySlots ?? {})) {
    const before = territories.find((t) => t.id === id)?.openSlots;
    parts.push(`${id} slots ${before ?? '?'} → ${n}`);
  }
  return parts.join(', ') || 'no change';
}
