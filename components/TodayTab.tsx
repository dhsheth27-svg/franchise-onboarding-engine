'use client';

import type { RunResult } from '@/lib/engine/types';
import { Empty } from './ui';

export default function TodayTab({ result }: { result: RunResult; onOpen: (key: string) => void; onDone: (id: string, label: string) => void; busy: boolean }) {
  if (!result.actions.length) return <Empty>The action queue is built in a later phase.</Empty>;
  return null;
}
