'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Spinner } from './ui';

/** Starts the guided demo on a fresh copy of the sample data. */
export default function DemoStartButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        setBusy(true);
        try {
          const r = await fetch('/api/sample', { method: 'POST' });
          const b = await r.json();
          if (b.runId) router.push(`/run/${b.runId}?demo=1`);
          else setBusy(false);
        } catch {
          setBusy(false);
        }
      }}
      disabled={busy}
      className="group inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-800 ring-1 ring-slate-300 transition duration-200 hover:bg-[#F4F4F6] hover:text-black hover:ring-[#F4F4F6] disabled:opacity-60"
    >
      {busy ? <Spinner /> : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] text-white transition group-hover:scale-110">▶</span>}
      {busy ? 'Preparing the demo…' : 'Watch the 2-minute guided demo'}
    </button>
  );
}
