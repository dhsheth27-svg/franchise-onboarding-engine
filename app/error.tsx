'use client';

import Link from 'next/link';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">{error.message || 'An unexpected error occurred.'}</p>
      <div className="mt-6 flex justify-center gap-4">
        <button onClick={reset} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800">
          Try again
        </button>
        <Link href="/" className="px-4 py-2 text-sm text-brand-700 underline">
          Start a new run
        </Link>
      </div>
    </main>
  );
}
