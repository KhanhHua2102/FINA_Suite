export function CandleLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div className="candle-wrapper">
        <div className="candle-chart">
          {Array.from({ length: 18 }, (_, i) => (
            <div key={i} className="candle" />
          ))}
        </div>
      </div>
      {label && (
        <span className="text-sm" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</span>
      )}
    </div>
  );
}
