import type { Counterfactual } from './types';

/**
 * The rank a held applicant would have once their hold is cleared. Prefer the counterfactual re-run (fixing the
 * gap usually changes the score, and so the rank) over the provisional rank computed from today's incomplete data,
 * so the explanation, the applicant's message and the action queue all quote the same number.
 */
export function rankOnceCleared(provisionalRank: number | null | undefined, whatWouldChange: Counterfactual[]): number | null {
  const fix = whatWouldChange.find((c) => ['space', 'capital', 'data', 'launch', 'score'].includes(c.kind) && c.outcome.startsWith('APPROVED') && c.rank);
  return fix?.rank ?? provisionalRank ?? null;
}
