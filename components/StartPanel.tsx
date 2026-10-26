'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconDownload, IconUpload } from './icons';
import { Spinner } from './ui';

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string; details: string[] };

function useStarter() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';

  async function open(res: Response, suffix = '') {
    const body = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
    if (!res.ok || !body.runId) {
      setStatus({ kind: 'error', text: body.error ?? 'Something went wrong.', details: body.details ?? [] });
      return;
    }
    setStatus({ kind: 'busy', text: 'Opening results…' });
    router.push(`/run/${body.runId}${suffix}`);
  }

  async function run(text: string, request: () => Promise<Response>, suffix = '') {
    if (busy) return;
    setStatus({ kind: 'busy', text });
    try {
      await open(await request(), suffix);
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Check your connection and try again.', details: [] });
    }
  }

  const upload = (f: File) => {
    const fd = new FormData();
    fd.append('file', f);
    run(`Reading ${f.name} and deciding every application…`, () => fetch('/api/upload', { method: 'POST', body: fd }));
  };
  const sample = (demo: boolean) => run(demo ? 'Preparing the guided demo…' : 'Deciding 29 sample applications…', () => fetch('/api/sample', { method: 'POST' }), demo ? '?demo=1' : '');
  return { status, busy, upload, sample };
}

/** Sample run and guided demo buttons, for use on a dark background. */
export function SampleActions() {
  const { busy, status, sample } = useStarter();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={busy} onClick={() => sample(true)} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-ink shadow-lift transition hover:-translate-y-px disabled:opacity-60">
        {busy ? <Spinner /> : <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[9px] text-white">▶</span>}
        {status.kind === 'busy' ? status.text : 'Take the 2-minute guided demo'}
      </button>
      <button type="button" disabled={busy} onClick={() => sample(false)} className="rounded-2xl px-5 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition hover:bg-white/10 disabled:opacity-60">
        Open the sample run
      </button>
    </div>
  );
}

/** The two ways to start: upload a workbook, or open the built-in sample (optionally with the guided demo). */
export default function StartPanel() {
  const { status, busy, upload, sample } = useStarter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      {/* Upload */}
      <div className="rounded-3xl bg-white p-2 shadow-card">
        <button
          type="button"
          disabled={busy}
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            const f = e.dataTransfer.files?.[0];
            if (f) upload(f);
          }}
          className={`flex h-full min-h-[200px] w-full flex-col items-center justify-center rounded-[20px] border-2 border-dashed px-6 py-10 text-center transition duration-200 ${
            drag ? 'border-brand-500 bg-brand-50' : 'border-slate-200 hover:border-brand-300 hover:bg-slate-50'
          }`}
        >
          {busy ? (
            <>
              <Spinner className="h-6 w-6 text-brand-600" />
              <span className="mt-4 text-sm font-medium text-ink">{status.kind === 'busy' && status.text}</span>
            </>
          ) : (
            <>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IconUpload className="h-6 w-6" />
              </span>
              <span className="mt-4 text-base font-semibold text-ink">Drop your workbook here</span>
              <span className="mt-1 text-sm text-slate-500">
                or <span className="font-medium text-brand-600 underline underline-offset-2">browse for a file</span>
              </span>
              <span className="mt-4 text-xs text-slate-500">Excel (.xlsx) with an Applications sheet and a Territories sheet</span>
            </>
          )}
        </button>
        <input
          ref={input}
          type="file"
          accept=".xlsx,.xlsm,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = '';
          }}
        />
        {status.kind === 'error' && (
          <div role="alert" className="mx-2 mb-2 mt-2 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-left text-sm text-rose-800">
            <p className="font-medium">{status.text}</p>
            {status.details.map((d) => (
              <p key={d} className="mt-1 text-rose-700">
                {d}
              </p>
            ))}
          </div>
        )}
      </div>

      {/* Sample */}
      <div className="flex flex-col rounded-3xl bg-white p-6 shadow-card">
        <h2 className="text-base font-semibold text-ink">No file to hand?</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-slate-600">Use the built-in sample: 29 deliberately messy applications across 7 Karnataka territories.</p>
        <div className="mt-5 space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => sample(false)}
            className="w-full rounded-2xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
          >
            Open the sample run
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => sample(true)}
            className="w-full rounded-2xl px-4 py-2.5 text-sm font-semibold text-ink ring-1 ring-inset ring-slate-300 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Take the 2-minute guided demo
          </button>
        </div>
        <a href="/api/template" className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm text-slate-600 transition hover:text-brand-700">
          <IconDownload className="h-4 w-4" /> Download the blank template
        </a>
      </div>
    </div>
  );
}
