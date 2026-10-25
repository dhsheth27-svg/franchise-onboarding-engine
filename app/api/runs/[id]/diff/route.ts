import { NextResponse } from 'next/server';
import { jsonError, serverError } from '@/lib/api';
import { diffRuns } from '@/lib/engine/diff';
import { loadRun } from '@/lib/runs';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const fromId = new URL(req.url).searchParams.get('from') ?? run.parentRunId;
    if (!fromId) return NextResponse.json({ from: null, diff: [] });
    const from = await loadRun(fromId);
    if (!from) return jsonError('The version to compare with was not found.', 404);
    return NextResponse.json({ from: { id: from.id, version: from.version, label: from.label }, diff: diffRuns(from.result, run.result) });
  } catch (e) {
    return serverError(e);
  }
}
