import { NextResponse } from 'next/server';
import { jsonError, serverError } from '@/lib/api';
import { loadRun } from '@/lib/runs';
import { applicantHistory, listVersions } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const key = new URL(req.url).searchParams.get('key');
    if (key) return NextResponse.json({ history: await applicantHistory(run.rootId, key) });
    return NextResponse.json({ versions: await listVersions(run.rootId) });
  } catch (e) {
    return serverError(e);
  }
}
