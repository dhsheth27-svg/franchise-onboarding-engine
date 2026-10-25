// Run lifecycle: create from an upload, append events (new immutable version), compare versions.

import { configValues } from './config';
import { describePolicyChange, effectiveConfig, effectiveInput, mergePolicy, type Policy } from './policy';
import { cleanApplications } from './engine/validate';
import { extractSignalsLLM, llmEnabled } from './llm';
import { runEngine } from './engine';
import { diffRuns, type DiffEntry } from './engine/diff';
import type { EngineEvent, EngineInput, RunResult } from './engine/types';
import { getRun, newRunId, nextVersion, saveRun, type StoredRun } from './store';

/** Today's date in India (IST), as the engine's default "today". */
export function todayIST(): string {
  return new Date(Date.now() + 5.5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** When an API key is set, read the free text with the LLM once at upload; otherwise keyword rules are used. */
async function withLlmSignals(input: EngineInput, today: string): Promise<EngineInput> {
  if (!llmEnabled()) return input;
  const apps = cleanApplications(input.applications, configValues(), today);
  const deterministic = Object.fromEntries(apps.map((a) => [a.key, a.signals]));
  const llm = await extractSignalsLLM(
    apps.map((a) => ({ key: a.key, business: a.business, notes: a.notes })),
    deterministic,
  );
  return llm ? { ...input, llmSignals: llm } : input;
}

export async function createRun(rawInput: EngineInput, label: string): Promise<StoredRun> {
  const today = todayIST();
  const input = await withLlmSignals(rawInput, today);
  const config = effectiveConfig(input.policy as Policy | undefined);
  const result = runEngine(effectiveInput(input), config, today);
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
  const config = effectiveConfig(input.policy as Policy | undefined);
  const result = runEngine(effectiveInput(input), config, today);
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
  const result = runEngine(effectiveInput(input), effectiveConfig(input.policy as Policy | undefined), parent.input.today);
  return { result, diff: diffRuns(parent.result, result) };
}

export async function loadRun(id: string): Promise<StoredRun | null> {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id)) return null;
  return getRun(id);
}

/** Preview a policy change (nothing saved), or apply it as a new logged version. */
export function previewPolicy(parent: StoredRun, change: Policy): { result: RunResult; diff: DiffEntry[]; label: string } {
  const policy = mergePolicy(parent.input.policy as Policy | undefined, change);
  const input = { ...parent.input, policy, priorApprovals: parent.result.approvalDates };
  const cfg = effectiveConfig(policy);
  const result = runEngine(effectiveInput(input), cfg, parent.input.today);
  return { result, diff: diffRuns(parent.result, result), label: describePolicyChange(change, effectiveConfig(parent.input.policy as Policy | undefined), parent.result.territories) };
}

export async function applyPolicy(parent: StoredRun, change: Policy, by: string): Promise<{ run: StoredRun; diff: DiffEntry[] }> {
  const today = todayIST() > parent.input.today ? todayIST() : parent.input.today;
  const policy = mergePolicy(parent.input.policy as Policy | undefined, change);
  const input: EngineInput & { today: string } = { ...parent.input, policy, priorApprovals: parent.result.approvalDates, today };
  const config = effectiveConfig(policy);
  const result = runEngine(effectiveInput(input), config, today);
  const label = `Policy by ${by}: ${describePolicyChange(change, effectiveConfig(parent.input.policy as Policy | undefined), parent.result.territories)}`;
  const run: StoredRun = { id: newRunId(), createdAt: new Date().toISOString(), parentRunId: parent.id, rootId: parent.rootId, version: await nextVersion(parent.rootId), label, input, config, result };
  await saveRun(run);
  return { run, diff: diffRuns(parent.result, result) };
}
