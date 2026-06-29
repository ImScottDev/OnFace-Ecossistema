"use client";

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function SkeletonRow({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          <td colSpan={8} className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="skeleton w-8 h-8 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-2/3 rounded" />
                <div className="skeleton h-2.5 w-1/3 rounded" />
              </div>
              <div className="skeleton h-3 w-12 rounded hidden md:block" />
              <div className="skeleton h-3 w-16 rounded hidden lg:block" />
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-3">
      <div className="skeleton h-3 w-20 rounded" />
      <div className="skeleton h-7 w-24 rounded" />
      <div className="skeleton h-2.5 w-16 rounded" />
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

export function SkeletonChart() {
  return (
    <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-5 space-y-4">
      <div className="skeleton h-4 w-32 rounded" />
      <div className="skeleton h-[250px] w-full rounded-xl" />
    </div>
  );
}

export function SkeletonKanbanColumn({ count = 3 }: { count?: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-72 rounded-2xl p-3 space-y-3"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="skeleton w-3 h-3 rounded-full" />
            <div className="skeleton h-3 w-20 rounded" />
            <div className="skeleton h-5 w-6 rounded-full ml-auto" />
          </div>
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="rounded-xl p-3 space-y-2" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="skeleton h-3 w-3/4 rounded" />
              <div className="skeleton h-2.5 w-1/2 rounded" />
              <div className="flex justify-between mt-1">
                <div className="skeleton h-3 w-16 rounded" />
                <div className="skeleton h-3 w-8 rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetailPanel() {
  return (
    <div className="p-6 space-y-5">
      <div className="space-y-2">
        <div className="skeleton h-5 w-40 rounded" />
        <div className="skeleton h-3 w-28 rounded" />
        <div className="flex gap-2 mt-3">
          <div className="skeleton h-5 w-14 rounded-full" />
          <div className="skeleton h-4 w-20 rounded" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-8 w-20 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton h-20 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
      <div className="skeleton h-28 rounded-xl" />
    </div>
  );
}
