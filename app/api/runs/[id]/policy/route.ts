import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, serverError } from '@/lib/api';
import { effectiveConfig, mergePolicy, PolicySchema, type Policy } from '@/lib/policy';
import { applyPolicy, loadRun, previewPolicy } from '@/lib/runs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Body = z.object({ change: PolicySchema, dryRun: z.boolean().optional(), by: z.string().max(80).optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError('That policy change is not valid: ' + parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).join('; '));
    const { change, dryRun, by } = parsed.data;
    const merged = mergePolicy(run.input.policy as Policy | undefined, change);
    const w = effectiveConfig(merged).weights.value;
    const sum = w.financial + w.operator + w.site + w.launch + w.territory;
    if (Math.round(sum) !== 100) return jsonError(`Pillar weights must add up to 100 (they add up to ${sum}).`);
    const known = new Set(run.result.territories.map((t) => t.id));
    const unknown = Object.keys(change.territorySlots ?? {}).filter((t) => !known.has(t));
    if (unknown.length) return jsonError(`Unknown territory: ${unknown.join(', ')}.`);
    if (dryRun) {
      const { result, diff, label } = previewPolicy(run, change);
      return NextResponse.json({ label, diff, counts: result.counts, before: run.result.counts, assertionsOk: result.assertions.ok });
    }
    if (!by || by.trim().length < 2) return jsonError('Please give your name so the policy change is logged.');
    const { run: next, diff } = await applyPolicy(run, change, by.trim());
    return NextResponse.json({ runId: next.id, version: next.version, label: next.label, diff });
  } catch (e) {
    return serverError(e);
  }
}
