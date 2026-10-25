// Run lifecycle: create from an upload, append events (new immutable version), compare versions.

import { config } from './config';
import { runEngine } from './engine';
import { diffRuns, type DiffEntry } from './engine/diff';
import type { EngineEvent, EngineInput, RunResult } from './engine/types';
import { getRun, newRunId, nextVersion, saveRun, type StoredRun } from './store';

/** Today's date in India (IST), as the engine's default "today". */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

export async function createRun(input: EngineInput, label: string): Promise<StoredRun> {
  const today = todayIST();
  const result = runEngine(input, config, today);
  const id = newRunId();
  const run: StoredRun = {
    id,
    createdAt: new Date().toISOString(),
    parentRunId: null,
    rootId: id,
    version: 1,
    label,
    input: { ...input, events: input.events ?? [], today },
    config,
    result,
  };
  await saveRun(run);
  return run;
}

export type NewEvent = Omit<EngineEvent, 'id' | 'at'> & { at?: string };

/** Append events to a run and save the re-decided result as a new version. */
export async function appendEvents(parent: StoredRun, events: NewEvent[], label: string): Promise<{ run: StoredRun; diff: DiffEntry[] }> {
  const today = todayIST() > parent.input.today ? todayIST() : parent.input.today;
  const at = parent.result.asOf;
  const stamped: EngineEvent[] = events.map((e, i) => ({ ...e, id: `${Date.now().toString(36)}-${i}`, at: e.at ?? at }));
  const input: EngineInput & { today: string } = {
    ...parent.input,
    events: [...(parent.input.events ?? []), ...stamped],
    priorApprovals: parent.result.approvalDates,
    today,
  };
  const result = runEngine(input, config, today);
  const run: StoredRun = {
    id: newRunId(),
    createdAt: new Date().toISOString(),
    parentRunId: parent.id,
    rootId: parent.rootId,
    version: await nextVersion(parent.rootId),
    label,
    input,
    config,
    result,
  };
  await saveRun(run);
  return { run, diff: diffRuns(parent.result, result) };
}

/** Hypothetical: run the engine with extra events without saving anything. */
export function whatIf(parent: StoredRun, events: NewEvent[]): { result: RunResult; diff: DiffEntry[] } {
  const at = parent.result.asOf;
  const stamped: EngineEvent[] = events.map((e, i) => ({ ...e, id: `whatif-${i}`, at: e.at ?? at }));
  const input = { ...parent.input, events: [...(parent.input.events ?? []), ...stamped], priorApprovals: parent.result.approvalDates };
  const result = runEngine(input, config, parent.input.today);
  return { result, diff: diffRuns(parent.result, result) };
}

export async function loadRun(id: string): Promise<StoredRun | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
  return getRun(id);
}
