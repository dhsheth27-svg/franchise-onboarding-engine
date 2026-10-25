'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { Spinner } from './ui';

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string; details: string[] };

export default function UploadPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const busy = status.kind === 'busy';

  async function go(res: Response) {
    const body = await res.json().catch(() => ({ error: 'Unexpected response from the server.' }));
    if (!res.ok || !body.runId) {
      setStatus({ kind: 'error', text: body.error ?? 'Upload failed.', details: body.details ?? [] });
      return;
    }
    setStatus({ kind: 'busy', text: 'Opening results…' });
    router.push(`/run/${body.runId}`);
  }

  async function upload(file: File) {
    setStatus({ kind: 'busy', text: `Reading ${file.name} and deciding every application…` });
    const fd = new FormData();
    fd.append('file', file);
    try {
      await go(await fetch('/api/upload', { method: 'POST', body: fd }));
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Check your connection and try again.', details: [] });
    }
  }

  async function sample() {
    setStatus({ kind: 'busy', text: 'Running the sample dataset (29 messy applications, 7 territories)…' });
    try {
      await go(await fetch('/api/sample', { method: 'POST' }));
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Check your connection and try again.', details: [] });
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white p-5 shadow-lift sm:p-7">
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload Excel file"
        onClick={() => !busy && input.current?.click()}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && !busy && input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !busy) upload(f);
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          drag ? 'border-brand-500 bg-brand-50' : 'border-brand-200 bg-brand-50/40 hover:border-brand-400 hover:bg-brand-50'
        }`}
      >
        {busy ? (
          <>
            <Spinner className="h-6 w-6 text-brand-700" />
            <p className="mt-3 text-sm font-medium text-slate-700">{status.text}</p>
          </>
        ) : (
          <>
            <svg aria-hidden viewBox="0 0 24 24" className="h-11 w-11 rounded-xl bg-brand-600 p-2.5 text-white shadow-btn" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4m0 0-4 4m4-4 4 4M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <p className="mt-4 text-base font-bold text-ink">Drop your Excel file here</p>
            <p className="mt-1 text-sm text-slate-500">or click to choose · .xlsx with Applications and Territories sheets</p>
          </>
        )}
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
      </div>

      {status.kind === 'error' && (
        <div role="alert" className="mt-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">
          <p className="font-medium">{status.text}</p>
          {status.details.map((d) => (
            <p key={d} className="mt-1 text-rose-800">
              {d}
            </p>
          ))}
        </div>
      )}

      <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>

      <button
        onClick={sample}
        disabled={busy}
        className="w-full rounded-full bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:bg-brand-300"
      >
        Try with sample data
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">29 deliberately messy applications covering every tricky case.</p>

      <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-sm">
        <a className="font-medium text-brand-700 underline-offset-2 hover:underline" href="/api/template">
          Download blank template
        </a>
        <a className="font-medium text-brand-700 underline-offset-2 hover:underline" href="/api/sample-file">
          Download sample as Excel
        </a>
      </div>
    </div>
  );
}
