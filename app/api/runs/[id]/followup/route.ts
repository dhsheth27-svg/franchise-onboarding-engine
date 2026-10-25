import { NextResponse } from 'next/server';
import { z } from 'zod';
import { jsonError, serverError } from '@/lib/api';
import type { DiffEntry } from '@/lib/engine/diff';
import {
  actionsAnswer,
  changeAnswer,
  compareAnswer,
  confirmEventWording,
  describeIntentPatch,
  explainAnswer,
  intentToEvents,
  overviewAnswer,
  territoriesAnswer,
  parseRules,
  statusAnswer,
  type Intent,
} from '@/lib/followup';
import { llmEnabled, llmToIntent, parseIntentLLM } from '@/lib/llm';
import { appendEvents, loadRun, whatIf } from '@/lib/runs';
import { addMessage, getMessages, listVersions } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Reply {
  kind: 'answer' | 'update' | 'clarify';
  answerText: string;
  newRunId?: string;
  diff?: DiffEntry[];
  focus?: string[];
  parsedBy: 'rules' | 'llm';
  intent: Intent['kind'];
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const versions = await listVersions(run.rootId);
    const ids = versions.filter((v) => v.version <= run.version).map((v) => v.id);
    return NextResponse.json({ messages: await getMessages(ids) });
  } catch (e) {
    return serverError(e);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const run = await loadRun(params.id);
    if (!run) return jsonError('Run not found.', 404);
    const body = z.object({ message: z.string().min(1).max(1000) }).safeParse(await req.json().catch(() => null));
    if (!body.success) return jsonError('Please type a question or an update.');
    const message = body.data.message.trim();
    const r = run.result;

    // 1. Parse: LLM (validated) when available, otherwise rules. Rules also catch anything the LLM misses.
    let intent: Intent | null = null;
    let parsedBy: Reply['parsedBy'] = 'rules';
    if (llmEnabled()) {
      const keys = r.decisions.map((d) => d.key);
      const directory = r.decisions.map((d) => `${d.key} | ${d.applicantName} | ${d.city ?? '—'} | ${d.application.business || '—'}`);
      const llm = await parseIntentLLM(message, directory);
      if (llm) {
        const resolve = (id: string) => keys.find((k) => k.toUpperCase() === id.trim().toUpperCase()) ?? null;
        intent = llmToIntent(llm.raw, resolve);
        // Safety: an AI reading that would record a withdrawal, signed agreement, missed deadline or date move
        // must be backed by the message's own words. Otherwise treat stated facts as an update, or use the rules.
        if (intent && !confirmEventWording(intent, message)) {
          const asUpdate = llmToIntent({ ...llm.raw, intent: 'update' }, resolve);
          intent = asUpdate && asUpdate.kind === 'update' ? asUpdate : null;
        }
        if (intent) parsedBy = 'llm';
      }
    }
    if (!intent) intent = parseRules(message, r.decisions, r.territories);

    // 2. Execute
    const byKey = new Map(r.decisions.map((d) => [d.key, d]));
    const idOf = (k: string) => byKey.get(k)?.applicationId ?? k;
    let reply: Reply;
    switch (intent.kind) {
      case 'clarify':
        reply = { kind: 'clarify', answerText: intent.question, parsedBy, intent: intent.kind };
        break;
      case 'explain':
        reply = { kind: 'answer', answerText: explainAnswer(byKey.get(intent.id)!), focus: [intent.id], parsedBy, intent: intent.kind };
        break;
      case 'compare':
        reply = { kind: 'answer', answerText: compareAnswer(byKey.get(intent.a)!, byKey.get(intent.b)!), focus: [intent.a, intent.b], parsedBy, intent: intent.kind };
        break;
      case 'status':
        reply = { kind: 'answer', answerText: statusAnswer(r, intent), parsedBy, intent: intent.kind };
        break;
      case 'overview':
        reply = { kind: 'answer', answerText: overviewAnswer(r), parsedBy, intent: intent.kind };
        break;
      case 'territories':
        reply = { kind: 'answer', answerText: territoriesAnswer(r), parsedBy, intent: intent.kind };
        break;
      case 'actions':
        reply = { kind: 'answer', answerText: actionsAnswer(r), parsedBy, intent: intent.kind };
        break;
      case 'whatif': {
        const { result, diff } = whatIf(run, [{ type: 'update', applicationId: intent.id, payload: intent.patch }]);
        const desc = describeIntentPatch(intent.patch);
        const lead = `Hypothetical only, nothing saved: if ${idOf(intent.id)} ${desc.startsWith('opened') ? desc : `had ${desc}`}.`;
        reply = { kind: 'answer', answerText: changeAnswer(r, result, intent.id, diff, lead, intent.notes), diff, focus: [intent.id], parsedBy, intent: intent.kind };
        break;
      }
      default: {
        const events = intentToEvents(intent, message);
        const key = 'id' in intent ? intent.id : null;
        const what =
          intent.kind === 'update'
            ? `Recorded for ${idOf(intent.id)}: ${describeIntentPatch(intent.patch)}.`
            : intent.kind === 'withdraw'
              ? `Recorded: ${idOf(intent.id)} has withdrawn.`
              : intent.kind === 'reservationMissed'
                ? `Recorded: ${idOf(intent.id)} missed the reservation deadline, so the slot is released.`
                : intent.kind === 'milestone'
                  ? `Recorded: ${idOf(intent.id)} has signed the agreement; the reservation is fulfilled.`
                  : `Moved the date forward ${intent.kind === 'dateAdvance' ? intent.days : 0} days.`;
        const notes = intent.kind === 'update' ? [...intent.notes] : [];
        if (intent.kind === 'update' && (intent.patch.spaceAvailable === 'Rented' || intent.patch.spaceAvailable === 'Owned') && intent.patch.spaceSize === undefined && !byKey.get(intent.id)?.application.spaceSqft)
          notes.push(`The size was not given. Send it (e.g. "${idOf(intent.id)} space is 400 sq ft") to complete the check.`);
        const { run: next, diff } = await appendEvents(run, events, what.replace(/^Recorded(?: for)?:? ?/, ''));
        let answerText = changeAnswer(r, next.result, key, diff, what, notes);
        if (intent.kind === 'dateAdvance') {
          const moved = diff.filter((d) => d.outcomeFrom !== d.outcomeTo);
          answerText = `${what} The date is now ${next.result.asOf}.${moved.length ? `\n\n${moved.map((d) => d.sentence).join('\n')}` : '\n\nNo decision changed.'}`;
        }
        reply = { kind: 'update', answerText, newRunId: next.id, diff, focus: key ? [key] : undefined, parsedBy, intent: intent.kind };
        await addMessage(next.id, 'user', message);
        await addMessage(next.id, 'assistant', JSON.stringify({ text: answerText, focus: reply.focus, newRunId: next.id, label: what }));
        return NextResponse.json(reply);
      }
    }
    await addMessage(run.id, 'user', message);
    await addMessage(run.id, 'assistant', JSON.stringify({ text: reply.answerText, focus: reply.focus }));
    return NextResponse.json(reply);
  } catch (e) {
    return serverError(e);
  }
}
