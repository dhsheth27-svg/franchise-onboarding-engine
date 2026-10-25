'use client';

import type { Decision } from '@/lib/engine/types';

export default function AskPanel(_: { runId: string; decisions: Decision[]; open: boolean; onClose: () => void; onOpen: (key: string) => void }) {
  return null;
}
