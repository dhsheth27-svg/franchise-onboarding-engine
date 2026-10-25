export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="skeleton h-4 w-48 animate-shimmer rounded-full" />
      <div className="skeleton mt-3 h-10 w-80 animate-shimmer rounded-2xl" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-32 animate-shimmer rounded-3xl" />
        ))}
      </div>
      <div className="skeleton mt-4 h-80 animate-shimmer rounded-3xl" />
    </div>
  );
}
