/** Shimmer skeleton placeholders for the portfolio dashboard cards. */

function Pulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={`animate-pulse bg-dark-border/40 rounded ${className ?? ''}`} style={style} />;
}

function CardSkeleton({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-dark-panel border border-dark-border rounded-xl ${className ?? ''}`}>
      {children}
    </div>
  );
}

function MetricCardSkeleton() {
  return (
    <CardSkeleton className="p-4 space-y-2">
      <Pulse className="h-3 w-24" />
      <Pulse className="h-6 w-32" />
    </CardSkeleton>
  );
}

function RiskCardSkeleton() {
  return (
    <CardSkeleton className="p-4 space-y-2">
      <Pulse className="h-3 w-20" />
      <Pulse className="h-6 w-16" />
      <Pulse className="h-2.5 w-28 mt-1" />
    </CardSkeleton>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero + Returns Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hero Summary */}
        <CardSkeleton className="p-6 space-y-4">
          <Pulse className="h-3 w-28" />
          <Pulse className="h-8 w-48" />
          <div className="flex gap-3">
            <Pulse className="h-5 w-16" />
            <Pulse className="h-5 w-24" />
          </div>
          <div className="flex gap-6 pt-4 border-t border-dark-border">
            {[1, 2, 3].map(i => (
              <div key={i} className="text-center space-y-1">
                <Pulse className="h-5 w-20 mx-auto" />
                <Pulse className="h-3 w-14 mx-auto" />
              </div>
            ))}
          </div>
        </CardSkeleton>

        {/* Returns Grid */}
        <CardSkeleton className="overflow-hidden">
          <div className="px-6 py-3 border-b border-dark-border">
            <Pulse className="h-3 w-32" />
          </div>
          <div className="grid grid-cols-3 md:grid-cols-6">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className={`p-4 space-y-2 ${i < 6 ? 'border-r border-dark-border' : ''}`}>
                <Pulse className="h-3 w-6" />
                <Pulse className="h-4 w-14" />
                <Pulse className="h-3 w-10" />
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>

      {/* Risk Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <RiskCardSkeleton />
        <RiskCardSkeleton />
        <RiskCardSkeleton />
      </div>

      {/* Performance Chart placeholder */}
      <CardSkeleton className="overflow-hidden">
        <div className="px-6 py-3 border-b border-dark-border">
          <Pulse className="h-3 w-36" />
        </div>
        <div className="p-4">
          <Pulse className="h-48 w-full rounded-lg" />
        </div>
      </CardSkeleton>

      {/* Holdings Table placeholder */}
      <CardSkeleton className="overflow-hidden">
        <div className="px-6 py-3 border-b border-dark-border">
          <Pulse className="h-3 w-28" />
        </div>
        <div className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex gap-4">
            {[60, 40, 50, 50, 60, 40, 50, 50, 50, 60].map((w, i) => (
              <Pulse key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>
          {/* Data rows */}
          {[1, 2, 3, 4].map(row => (
            <div key={row} className="flex gap-4">
              {[60, 40, 50, 50, 60, 40, 50, 50, 50, 60].map((w, i) => (
                <Pulse key={i} className="h-4" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </CardSkeleton>

      {/* Sector + Closed — 2 col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton className="overflow-hidden">
          <div className="px-6 py-3 border-b border-dark-border">
            <Pulse className="h-3 w-32" />
          </div>
          <div className="p-4 space-y-4">
            {[80, 60, 45, 30].map((w, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <Pulse className="h-3 w-24" />
                  <Pulse className="h-3 w-10" />
                </div>
                <Pulse className="h-2 rounded-full" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        </CardSkeleton>

        <CardSkeleton className="overflow-hidden">
          <div className="px-6 py-3 border-b border-dark-border">
            <Pulse className="h-3 w-28" />
          </div>
          <div className="p-4 space-y-3">
            {[1, 2, 3].map(row => (
              <div key={row} className="flex gap-4">
                {[60, 60, 50, 60].map((w, i) => (
                  <Pulse key={i} className="h-4" style={{ width: w }} />
                ))}
              </div>
            ))}
          </div>
        </CardSkeleton>
      </div>

      {/* Monthly Returns placeholder */}
      <CardSkeleton className="overflow-hidden">
        <div className="px-6 py-3 border-b border-dark-border">
          <Pulse className="h-3 w-28" />
        </div>
        <div className="p-4 flex items-end gap-1" style={{ height: 160 }}>
          {Array.from({ length: 12 }, (_, i) => (
            <Pulse key={i} className="flex-1 rounded-t-sm" style={{ height: `${20 + Math.random() * 60}%` }} />
          ))}
        </div>
      </CardSkeleton>
    </div>
  );
}
