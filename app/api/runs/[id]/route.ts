import { NextResponse } from 'next/server';
import { jsonError, serverError } from '@/lib/api';
import { config } from '@/lib/config';
import { loadRun } from '@/lib/runs';
import { storageMode } from '@/lib/store';

export const runtime = 'nodejs';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('This run was not found. It may have expired (local mode keeps runs in memory only).', 404);
    return NextResponse.json({
      id: run.id,
      rootId: run.rootId,
      parentRunId: run.parentRunId,
      version: run.version,
      label: run.label,
      createdAt: run.createdAt,
      today: run.input.today,
      source: run.input.source ?? null,
      importNotes: run.input.importNotes ?? [],
      events: run.input.events ?? [],
      storage: storageMode(),
      config,
      result: run.result,
    });
  } catch (e) {
    return serverError(e);
  }
}
