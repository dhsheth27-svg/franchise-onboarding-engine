import type { Config } from './config';
import type { EngineEvent, RunResult } from './engine/types';
import type { DiffEntry } from './engine/diff';

export interface RunPayload {
  id: string;
  rootId: string;
  parentRunId: string | null;
  version: number;
  label: string;
  createdAt: string;
  today: string;
  source: string | null;
  importNotes: string[];
  events: EngineEvent[];
  storage: 'neon' | 'memory';
  config: Config;
  result: RunResult;
}

export interface VersionSummary {
  id: string;
  version: number;
  label: string;
  createdAt: string;
  parentRunId: string | null;
  asOf: string;
  counts: RunResult['counts'];
}

export type { DiffEntry };
