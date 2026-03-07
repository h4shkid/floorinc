export function DashboardSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Summary cards skeleton */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="skeleton h-8 w-20 mb-2" />
            <div className="skeleton h-4 w-24" />
          </div>
        ))}
      </div>

      {/* Filter bar skeleton */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 mb-4">
        <div className="flex gap-3">
          <div className="skeleton h-10 flex-1" />
          <div className="skeleton h-10 w-36" />
          <div className="skeleton h-10 w-32" />
          <div className="skeleton h-10 w-28" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="bg-slate-50 dark:bg-slate-800/50 px-3 py-3 border-b border-slate-200 dark:border-slate-700">
          <div className="flex gap-4">
            <div className="skeleton h-3 w-12" />
            <div className="skeleton h-3 flex-1" />
            <div className="skeleton h-3 w-20" />
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-16" />
            <div className="skeleton h-3 w-16" />
          </div>
        </div>
        {/* Rows */}
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="px-3 py-3 border-b border-slate-100 dark:border-slate-700/50">
            <div className="flex gap-4 items-center">
              <div className="skeleton h-5 w-11 rounded" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3.5 w-3/4" />
                <div className="skeleton h-2.5 w-1/3" />
              </div>
              <div className="skeleton h-3 w-16" />
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-3 w-12" />
              <div className="skeleton h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DetailPanelSkeleton() {
  return (
    <div className="px-5 py-5 space-y-6 animate-pulse">
      {/* Product info */}
      <div>
        <div className="skeleton h-5 w-3/4 mb-2" />
        <div className="skeleton h-3 w-1/3 mb-1" />
        <div className="skeleton h-3 w-1/4" />
      </div>

      {/* Status cards */}
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3">
            <div className="skeleton h-6 w-12 mx-auto mb-1" />
            <div className="skeleton h-3 w-16 mx-auto" />
          </div>
        ))}
      </div>

      {/* Forecast section */}
      <div>
        <div className="skeleton h-3 w-20 mb-2" />
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3 space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex justify-between">
              <div className="skeleton h-3 w-24" />
              <div className="skeleton h-3 w-16" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart skeleton */}
      <div>
        <div className="skeleton h-3 w-28 mb-2" />
        <div className="rounded-lg bg-slate-50 dark:bg-slate-700/50 p-3">
          <div className="flex items-end gap-1" style={{ height: 96 }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 skeleton rounded-t"
                style={{ height: `${20 + Math.random() * 60}%` }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
