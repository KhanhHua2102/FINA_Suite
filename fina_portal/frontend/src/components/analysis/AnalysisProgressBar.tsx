import { useMemo } from 'react';

const STAGES = [
  { key: 'start', label: 'Starting', match: 'Starting analysis' },
  { key: 'data', label: 'Market Data', match: 'Fetching market data' },
  { key: 'indicators', label: 'Indicators', match: 'Computing technical' },
  { key: 'research', label: 'Research', match: 'Fetching social|Checking for recent SEC' },
  { key: 'intel', label: 'Intelligence', match: 'Fetching macro|analyst' },
  { key: 'llm', label: 'AI Analysis', match: 'Sending to LLM' },
  { key: 'parse', label: 'Finalizing', match: 'Parsing LLM' },
];

function detectStage(logs: string[]): number {
  // Scan logs in reverse to find the latest stage
  for (let i = logs.length - 1; i >= 0; i--) {
    const line = logs[i];
    for (let s = STAGES.length - 1; s >= 0; s--) {
      const patterns = STAGES[s].match.split('|');
      if (patterns.some(p => line.includes(p))) {
        return s;
      }
    }
  }
  return 0;
}

interface Props {
  ticker: string;
  logs: string[];
  startTime?: number; // Date.now() when analysis started
}

export function AnalysisProgressBar({ ticker, logs, startTime }: Props) {
  const currentStage = useMemo(() => detectStage(logs), [logs]);
  const progressPct = ((currentStage + 1) / STAGES.length) * 100;

  // Estimate remaining time based on elapsed and progress
  const elapsed = startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
  const estimatedTotal = currentStage > 0 ? Math.round(elapsed / ((currentStage + 1) / STAGES.length)) : 45;
  const remaining = Math.max(estimatedTotal - elapsed, 0);

  const formatTime = (s: number) => {
    if (s < 60) return `~${s}s`;
    return `~${Math.ceil(s / 60)}m`;
  };

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: '#18181b', border: '1px solid #27272a' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <span
          className="text-sm font-medium flex items-center gap-2"
          style={{ color: '#ECEDEE' }}
        >
          <div
            className="animate-spin w-4 h-4 rounded-full"
            style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }}
          />
          Analyzing {ticker}
        </span>
        <span
          className="text-xs font-mono"
          style={{ color: '#a1a1aa' }}
        >
          {elapsed > 0 && `${elapsed}s elapsed`}
          {remaining > 0 && elapsed > 5 && ` · ${formatTime(remaining)} remaining`}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: '#27272a' }}
      >
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${progressPct}%`,
            backgroundColor: '#006FEE',
          }}
        />
      </div>

      {/* Stage indicators */}
      <div className="flex gap-1">
        {STAGES.map((stage, i) => {
          const isDone = i < currentStage;
          const isActive = i === currentStage;
          return (
            <div key={stage.key} className="flex-1">
              <div
                className={`h-1 rounded-full mb-1 ${isActive ? 'animate-pulse' : ''}`}
                style={{
                  backgroundColor: isDone
                    ? '#006FEE'
                    : isActive
                      ? 'rgba(99,102,241,0.5)'
                      : '#27272a',
                }}
              />
              <p
                className="text-[10px] text-center truncate"
                style={{
                  color: isActive
                    ? '#006FEE'
                    : isDone
                      ? '#a1a1aa'
                      : 'rgba(161,161,170,0.4)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {stage.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
