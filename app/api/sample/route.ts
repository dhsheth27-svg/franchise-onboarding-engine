import { NextResponse } from 'next/server';
import { serverError } from '@/lib/api';
import { createRun } from '@/lib/runs';
import { sampleInput } from '@/lib/sample';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const run = await createRun(sampleInput(), 'Sample data');
    return NextResponse.json({ runId: run.id });
  } catch (e) {
    return serverError(e);
  }
}
