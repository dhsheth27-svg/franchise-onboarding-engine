// Persistence: Neon Postgres when DATABASE_URL is set, otherwise an in-memory map (local dev).
// Runs are immutable versions; every change creates a new row pointing at its parent.

import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { randomBytes } from 'node:crypto';
import type { EngineInput, RunResult } from './engine/types';

export interface StoredRun {
  id: string;
  createdAt: string;
  parentRunId: string | null;
  rootId: string;
  version: number;
  label: string;
  input: EngineInput & { today: string };
  config: unknown;
  result: RunResult;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export function newRunId(): string {
  return randomBytes(12).toString('base64url');
}

const SCHEMA = [
  `create table if not exists runs (id text primary key, created_at timestamptz not null default now(), parent_run_id text null, root_id text not null, version int not null, label text not null, input jsonb not null, config jsonb not null, result jsonb not null)`,
  `create index if not exists runs_parent_idx on runs (parent_run_id)`,
  `create index if not exists runs_created_idx on runs (created_at)`,
  `create index if not exists runs_root_idx on runs (root_id, version)`,
  `create table if not exists messages (id serial primary key, run_id text not null, role text not null, content text not null, created_at timestamptz not null default now())`,
  `create index if not exists messages_run_idx on messages (run_id, created_at)`,
];

type Mem = { runs: Map<string, StoredRun>; messages: Map<string, StoredMessage[]> };
const g = globalThis as unknown as { __mem?: Mem; __sql?: NeonQueryFunction<false, false>; __migrated?: Promise<void> };

function mem(): Mem {
  if (!g.__mem) g.__mem = { runs: new Map(), messages: new Map() };
  return g.__mem;
}

function sql(): NeonQueryFunction<false, false> | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  if (!g.__sql) g.__sql = neon(url);
  return g.__sql;
}

async function ready(db: NeonQueryFunction<false, false>) {
  if (!g.__migrated) {
    g.__migrated = (async () => {
      for (const stmt of SCHEMA) await db(stmt);
    })().catch((e) => {
      g.__migrated = undefined;
      throw e;
    });
  }
  return g.__migrated;
}

export const storageMode = () => (process.env.DATABASE_URL ? 'neon' : 'memory');

function rowToRun(r: Record<string, unknown>): StoredRun {
  return {
    id: r.id as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    parentRunId: (r.parent_run_id as string) ?? null,
    rootId: r.root_id as string,
    version: Number(r.version),
    label: r.label as string,
    input: r.input as StoredRun['input'],
    config: r.config,
    result: r.result as RunResult,
  };
}

export async function saveRun(run: StoredRun): Promise<void> {
  const db = sql();
  if (!db) {
    mem().runs.set(run.id, run);
    return;
  }
  await ready(db);
  await db(
    `insert into runs (id, created_at, parent_run_id, root_id, version, label, input, config, result) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [run.id, run.createdAt, run.parentRunId, run.rootId, run.version, run.label, JSON.stringify(run.input), JSON.stringify(run.config), JSON.stringify(run.result)],
  );
}

export async function getRun(id: string): Promise<StoredRun | null> {
  const db = sql();
  if (!db) return mem().runs.get(id) ?? null;
  await ready(db);
  const rows = (await db(`select * from runs where id = $1`, [id])) as Record<string, unknown>[];
  return rows[0] ? rowToRun(rows[0]) : null;
}

export interface RunSummary {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  parentRunId: string | null;
  asOf: string;
  counts: RunResult['counts'];
}

export async function listVersions(rootId: string): Promise<RunSummary[]> {
  const db = sql();
  if (!db) {
    return [...mem().runs.values()]
      .filter((r) => r.rootId === rootId)
      .sort((a, b) => a.version - b.version)
      .map((r) => ({ id: r.id, version: r.version, label: r.label, createdAt: r.createdAt, parentRunId: r.parentRunId, asOf: r.result.asOf, counts: r.result.counts }));
  }
  await ready(db);
  const rows = (await db(
    `select id, version, label, created_at, parent_run_id, result->>'asOf' as as_of, result->'counts' as counts from runs where root_id = $1 order by version, created_at`,
    [rootId],
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    id: r.id as string,
    version: Number(r.version),
    label: r.label as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    parentRunId: (r.parent_run_id as string) ?? null,
    asOf: r.as_of as string,
    counts: r.counts as RunResult['counts'],
  }));
}

export async function nextVersion(rootId: string): Promise<number> {
  const versions = await listVersions(rootId);
  return versions.reduce((m, v) => Math.max(m, v.version), 0) + 1;
}

export async function addMessage(runId: string, role: StoredMessage['role'], content: string): Promise<void> {
  const db = sql();
  if (!db) {
    const list = mem().messages.get(runId) ?? [];
    list.push({ role, content, createdAt: new Date().toISOString() });
    mem().messages.set(runId, list);
    return;
  }
  await ready(db);
  await db(`insert into messages (run_id, role, content) values ($1, $2, $3)`, [runId, role, content]);
}

export async function getMessages(runIds: string[]): Promise<(StoredMessage & { runId: string })[]> {
  const db = sql();
  if (!db) return runIds.flatMap((id) => (mem().messages.get(id) ?? []).map((m) => ({ ...m, runId: id })));
  await ready(db);
  const rows = (await db(`select run_id, role, content, created_at from messages where run_id = any($1) order by created_at, id`, [runIds])) as Record<string, unknown>[];
  return rows.map((r) => ({ runId: r.run_id as string, role: r.role as StoredMessage['role'], content: r.content as string, createdAt: new Date(r.created_at as string).toISOString() }));
}

export interface ApplicantVersion {
  runId: string;
  version: number;
  label: string;
  createdAt: string;
  outcome: string | null;
  score: number | null;
  oneLine: string | null;
}

/** One applicant's outcome across every version of a run. */
export async function applicantHistory(rootId: string, key: string): Promise<ApplicantVersion[]> {
  const db = sql();
  if (!db) {
    return [...mem().runs.values()]
      .filter((r) => r.rootId === rootId)
      .sort((a, b) => a.version - b.version)
      .map((r) => {
        const d = r.result.decisions.find((x) => x.key === key);
        return { runId: r.id, version: r.version, label: r.label, createdAt: r.createdAt, outcome: d?.outcome ?? null, score: d?.score ?? null, oneLine: d?.oneLine ?? null };
      });
  }
  await ready(db);
  const rows = (await db(
    `select id, version, label, created_at, d->>'outcome' as outcome, (d->>'score')::float as score, d->>'oneLine' as one_line
       from runs, lateral (select jsonb_path_query_first(result, '$.decisions[*] ? (@.key == $k)', jsonb_build_object('k', $2::text)) as d) x
      where root_id = $1 order by version`,
    [rootId, key],
  )) as Record<string, unknown>[];
  return rows.map((r) => ({
    runId: r.id as string,
    version: Number(r.version),
    label: r.label as string,
    createdAt: new Date(r.created_at as string).toISOString(),
    outcome: (r.outcome as string) ?? null,
    score: r.score === null ? null : Number(r.score),
    oneLine: (r.one_line as string) ?? null,
  }));
}
