'use client';

import type { Config } from '@/lib/config';
import type { EngineEvent, RunResult } from '@/lib/engine/types';
import { Empty } from './ui';

export default function InsightsTab(_: { result: RunResult; config: Config; events: EngineEvent[]; onOpen: (key: string) => void }) {
  return <Empty>Insights are built in a later phase.</Empty>;
}
