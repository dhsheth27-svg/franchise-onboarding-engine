export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-6">
      <div className="h-6 w-64 rounded bg-stone-200" />
      <div className="mt-4 flex gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 flex-1 rounded-lg bg-stone-200" />
        ))}
      </div>
      <div className="mt-6 h-96 rounded-lg bg-stone-200" />
    </div>
  );
}
