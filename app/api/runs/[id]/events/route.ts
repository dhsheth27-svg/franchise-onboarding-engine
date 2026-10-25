import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, serverError } from '@/lib/api';
import { appendEvents, loadRun, whatIf, type NewEvent } from '@/lib/runs';

export const runtime = 'nodejs';
export const maxDuration = 60;

const Event = z
  .object({
    type: z.enum(['update', 'withdraw', 'override', 'milestone', 'checklist', 'reservationMissed', 'dateAdvance']),
    applicationId: z.string().max(40).optional(),
    payload: z.record(z.unknown()).default({}),
    reason: z.string().max(500).optional(),
    by: z.string().max(80).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.type === 'override') {
      if (!e.reason || e.reason.trim().length < 10) ctx.addIssue({ code: 'custom', message: 'An override needs a reason of at least 10 characters.' });
      if (!e.by || !e.by.trim()) ctx.addIssue({ code: 'custom', message: 'An override needs the name of the person making it.' });
    }
    if (e.type === 'dateAdvance' && !(Number(e.payload.days) > 0)) ctx.addIssue({ code: 'custom', message: 'Date moves need a positive number of days.' });
    if (e.type !== 'dateAdvance' && !(e.type === 'checklist' && e.payload.kind === 'action') && !e.applicationId) ctx.addIssue({ code: 'custom', message: 'This change needs an application ID.' });
  });

const Body = z.object({ events: z.array(Event).min(1).max(20), label: z.string().max(200).optional(), dryRun: z.boolean().optional() });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(parsed.error.issues.map((i) => i.message).join(' '), 400);
    const events = parsed.data.events as NewEvent[];
    if (parsed.data.dryRun) {
      const { result, diff } = whatIf(run, events);
      return NextResponse.json({ diff, result });
    }
    const label = parsed.data.label ?? events.map((e) => `${e.type}${e.applicationId ? ` ${e.applicationId}` : ''}`).join(', ');
    const { run: next, diff } = await appendEvents(run, events, label);
    return NextResponse.json({ runId: next.id, version: next.version, diff });
  } catch (e) {
    return serverError(e);
  }
}
