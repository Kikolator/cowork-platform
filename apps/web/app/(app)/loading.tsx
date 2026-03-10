export default function Loading() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-white/40 dark:bg-white/5" />
      <div className="h-4 w-72 animate-pulse rounded-xl bg-white/40 dark:bg-white/5" />
      <div className="mt-6 h-40 animate-pulse rounded-xl bg-white/30 dark:bg-white/5" />
    </div>
  );
}
