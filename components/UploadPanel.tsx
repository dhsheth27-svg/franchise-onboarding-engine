'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { IconDownload, IconList, IconUpload } from './icons';
import { Spinner } from './ui';

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string; details: string[] };
type Mode = 'upload' | 'sample' | 'template';

const MODES: { id: Mode; label: string; icon: JSX.Element }[] = [
  { id: 'upload', label: 'Upload', icon: <IconUpload className="h-4 w-4" /> },
  { id: 'sample', label: 'Sample data', icon: <IconList className="h-4 w-4" /> },
  { id: 'template', label: 'Template', icon: <IconDownload className="h-4 w-4" /> },
];

export default function UploadPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>('upload');
  const [drag, setDrag] = useState(false);
  const [file, setFile] = useState<File | null>(null);
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

  async function upload(f: File) {
    setFile(f);
    setStatus({ kind: 'busy', text: `Reading ${f.name} and deciding every application…` });
    const fd = new FormData();
    fd.append('file', f);
    try {
      await go(await fetch('/api/upload', { method: 'POST', body: fd }));
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Check your connection and try again.', details: [] });
    }
  }

  async function sample() {
    setStatus({ kind: 'busy', text: 'Running 29 messy applications across 7 territories…' });
    try {
      await go(await fetch('/api/sample', { method: 'POST' }));
    } catch {
      setStatus({ kind: 'error', text: 'Could not reach the server. Check your connection and try again.', details: [] });
    }
  }

  const action = () => {
    if (busy) return;
    if (mode === 'upload') {
      if (file) upload(file);
      else input.current?.click();
    } else if (mode === 'sample') sample();
    else window.location.href = '/api/template';
  };

  return (
    <div
      className={`rounded-[28px] border bg-surface p-2.5 shadow-paper transition duration-300 ${drag ? 'border-brand-600 shadow-lift' : 'border-slate-200 hover:border-slate-300'}`}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
        setMode('upload');
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        const f = e.dataTransfer.files?.[0];
        if (f && !busy) upload(f);
      }}
    >
      {/* Segmented control */}
      <div role="tablist" aria-label="How to start" className="grid grid-cols-3 gap-1 rounded-full bg-slate-100 p-1">
        {MODES.map((m) => (
          <button
            key={m.id}
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium transition duration-200 ${
              mode === m.id ? 'bg-ink text-canvas shadow' : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <span className="hidden sm:inline-flex">{m.icon}</span>
            <span className="whitespace-nowrap">{m.label}</span>
          </button>
        ))}
      </div>

      {/* "Search bar" row with the action button */}
      <div className="mt-2.5 flex items-center gap-2 rounded-full border border-slate-200 bg-canvas/70 py-1.5 pl-5 pr-1.5 transition focus-within:border-slate-400">
        <button
          type="button"
          onClick={() => mode === 'upload' && !busy && input.current?.click()}
          className={`min-w-0 flex-1 truncate text-left text-sm ${mode === 'upload' ? 'cursor-pointer text-slate-500 hover:text-slate-800' : 'cursor-default text-slate-500'}`}
        >
          {busy ? (
            <span className="inline-flex items-center gap-2 text-slate-800">
              <Spinner className="h-3.5 w-3.5 text-brand-600" /> {status.text}
            </span>
          ) : mode === 'upload' ? (
            file ? (
              <span className="text-slate-900">{file.name}</span>
            ) : (
              'Drop an Excel file here, or click to browse'
            )
          ) : mode === 'sample' ? (
            '29 deliberately messy applications covering every tricky case'
          ) : (
            'Blank workbook in the exact case format'
          )}
        </button>
        <button
          onClick={action}
          disabled={busy}
          className="inline-flex flex-none items-center gap-1.5 rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white shadow-btn transition duration-200 hover:-translate-y-px hover:bg-brand-500 disabled:opacity-60"
        >
          {mode === 'upload' ? (file ? 'Decide' : 'Browse') : mode === 'sample' ? 'Run sample' : 'Download'}
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
      </div>

      {status.kind === 'error' && (
        <div role="alert" className="mx-2 mt-2.5 animate-fade-up rounded-2xl border border-rose-300 bg-rose-50 p-3 text-left text-sm text-rose-800">
          <p className="font-medium">{status.text}</p>
          {status.details.map((d) => (
            <p key={d} className="mt-1 text-rose-700">
              {d}
            </p>
          ))}
        </div>
      )}
      <p className="px-4 pb-1 pt-2.5 text-center font-mono text-[10.5px] uppercase tracking-[0.16em] text-slate-500">Workbook with Applications and Territories sheets</p>
    </div>
  );
}
