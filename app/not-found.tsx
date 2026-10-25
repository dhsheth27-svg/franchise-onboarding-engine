import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <h1 className="text-xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 text-slate-600">The link may be mistyped, or the run may no longer exist.</p>
      <Link href="/" className="mt-6 inline-block text-brand-700 underline">
        Start a new run
      </Link>
    </main>
  );
}
