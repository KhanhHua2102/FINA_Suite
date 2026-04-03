import { useState, useMemo } from 'react';
import { useTrainingStore } from '../../store/trainingStore';
import { useTradeStore } from '../../store/tradeStore';
import { LogViewer } from '../common/LogViewer';

interface TickerProgress {
  ticker: string;
  phase: 'downloading' | 'training' | 'finished';
  timeframe: string;
  downloadPct: number;
  downloadCurrent: number;
  downloadTotal: number;
  downloadStartTime: number;
  currentCandle: number;
  totalCandles: number;
  accuracy: number | null;
  trainingStartTime: number;
}

function newTickerProgress(ticker: string): TickerProgress {
  return {
    ticker,
    phase: 'downloading',
    timeframe: '',
    downloadPct: 0,
    downloadCurrent: 0,
    downloadTotal: 0,
    downloadStartTime: Date.now(),
    currentCandle: 0,
    totalCandles: 0,
    accuracy: null,
    trainingStartTime: 0,
  };
}

function ensureTicker(progress: Map<string, TickerProgress>, ticker: string): TickerProgress {
  let p = progress.get(ticker);
  if (!p) {
    p = newTickerProgress(ticker);
    progress.set(ticker, p);
  }
  return p;
}

function parseProgress(logs: string[]): Map<string, TickerProgress> {
  const progress = new Map<string, TickerProgress>();

  for (const log of logs) {
    const prefixMatch = log.match(/^\[([^\]]+)\]\s*(.*)/s);
    const ticker = prefixMatch ? prefixMatch[1] : null;
    const content = prefixMatch ? prefixMatch[2] : log;

    const startMatch = content.match(/\[TRAINER\] Starting training for (.+)/);
    if (startMatch) {
      const t = ticker || startMatch[1];
      const p = ensureTicker(progress, t);
      p.phase = 'downloading';
      p.downloadStartTime = Date.now();
      continue;
    }

    const dlMatch = content.match(/\[TRAINER\] Downloading (.+) data for (.+)\.\.\./);
    if (dlMatch) {
      const t = ticker || dlMatch[2];
      const p = ensureTicker(progress, t);
      p.phase = 'downloading';
      p.timeframe = dlMatch[1];
      p.downloadStartTime = Date.now();
      p.downloadPct = 0;
      p.downloadCurrent = 0;
      p.downloadTotal = 0;
      continue;
    }

    const progMatch = content.match(/\[TRAINER\] Download progress: ([\d.]+)% \((\d+)\/(\d+)\)/);
    if (progMatch && ticker) {
      const p = ensureTicker(progress, ticker);
      p.downloadPct = parseFloat(progMatch[1]);
      p.downloadCurrent = parseInt(progMatch[2]);
      p.downloadTotal = parseInt(progMatch[3]);
      continue;
    }

    if (content.match(/\[TRAINER\] No more data available/) && ticker) {
      const p = ensureTicker(progress, ticker);
      p.downloadPct = 100;
      continue;
    }

    const totalMatch = content.match(/Total Candles:\s*(\d+)/);
    if (totalMatch && ticker) {
      const p = ensureTicker(progress, ticker);
      p.totalCandles = parseInt(totalMatch[1]);
      p.phase = 'training';
      if (!p.trainingStartTime) p.trainingStartTime = Date.now();
      continue;
    }

    const currentMatch = content.match(/current candle:\s*(\d+)/);
    if (currentMatch && ticker) {
      const p = ensureTicker(progress, ticker);
      p.currentCandle = parseInt(currentMatch[1]);
      p.phase = 'training';
      if (!p.trainingStartTime) p.trainingStartTime = Date.now();
      continue;
    }

    const accMatch = content.match(/Bounce Accuracy.*?:\s*([\d.]+)/);
    if (accMatch && ticker) {
      const p = ensureTicker(progress, ticker);
      p.accuracy = parseFloat(accMatch[1]);
      continue;
    }

    if (content.match(/finished processing|Processed all|Finished processing all/) && ticker) {
      const p = ensureTicker(progress, ticker);
      p.phase = 'finished';
      continue;
    }
  }

  return progress;
}

function formatEta(startTime: number, current: number, total: number): string {
  if (current <= 0 || total <= 0 || startTime <= 0) return '--';
  const elapsed = (Date.now() - startTime) / 1000;
  if (elapsed < 2) return '--';
  const rate = current / elapsed;
  const remaining = (total - current) / rate;
  if (remaining < 0) return '--';
  if (remaining < 60) return `~${Math.round(remaining)}s`;
  if (remaining < 3600) return `~${Math.round(remaining / 60)}m`;
  return `~${(remaining / 3600).toFixed(1)}h`;
}

function ProgressBar({ progress }: { progress: TickerProgress }) {
  const {
    ticker, phase, timeframe,
    downloadPct, downloadCurrent, downloadTotal, downloadStartTime,
    currentCandle, totalCandles, accuracy, trainingStartTime,
  } = progress;

  const isDownloading = phase === 'downloading';
  const isTraining = phase === 'training';

  let pct: number;
  if (phase === 'finished') {
    pct = 100;
  } else if (isDownloading) {
    pct = Math.min(99, Math.round(downloadPct));
  } else if (isTraining && totalCandles > 0) {
    pct = Math.min(99, Math.round((currentCandle / totalCandles) * 100));
  } else {
    pct = 0;
  }

  let phaseLabel: string;
  if (isDownloading) {
    const tf = timeframe || '1hour';
    if (downloadTotal > 0) {
      phaseLabel = `Downloading ${tf} data — ${downloadCurrent.toLocaleString()} / ${downloadTotal.toLocaleString()} records`;
    } else {
      phaseLabel = `Downloading ${tf} data...`;
    }
  } else if (isTraining) {
    phaseLabel = `Training — ${currentCandle.toLocaleString()} / ${totalCandles.toLocaleString()} candles`;
  } else {
    phaseLabel = 'Complete';
  }

  let eta = '--';
  if (isDownloading && downloadCurrent > 0 && downloadTotal > 0) {
    eta = formatEta(downloadStartTime, downloadCurrent, downloadTotal);
  } else if (isTraining && currentCandle > 0 && totalCandles > 0) {
    eta = formatEta(trainingStartTime, currentCandle, totalCandles);
  }

  const hasProgress = pct > 0 || phase === 'finished';
  const isIndeterminate = isDownloading && downloadPct <= 0;

  const barColor = phase === 'finished'
    ? '#17c964'
    : isDownloading
      ? '#f5a524'
      : '#006FEE';

  return (
    <div className="px-5 py-3.5" style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium" style={{ color: '#ECEDEE' }}>{ticker}</span>
        <div className="flex items-center gap-3 text-xs font-mono" style={{ color: '#a1a1aa' }}>
          {accuracy !== null && (
            <span>Accuracy: <span style={{ color: '#17c964' }}>{accuracy}%</span></span>
          )}
          {(isDownloading || isTraining) && eta !== '--' && (
            <span>ETA: {eta}</span>
          )}
          <span style={{ color: phase === 'finished' ? '#17c964' : undefined }}>
            {hasProgress ? `${pct}%` : ''}
          </span>
        </div>
      </div>
      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: '#27272a' }}>
        {isIndeterminate ? (
          <div
            className="h-full w-1/3 rounded-full animate-indeterminate"
            style={{ background: '#f5a524', opacity: 0.7 }}
          />
        ) : (
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${pct}%`, background: barColor }}
          />
        )}
      </div>
      <div className="mt-1.5 text-xs" style={{ color: '#a1a1aa' }}>{phaseLabel}</div>
    </div>
  );
}

export function TrainerOutput() {
  const { trainerLogs, clearTrainerLogs } = useTrainingStore();
  const { processStatus } = useTradeStore();
  const [showRaw, setShowRaw] = useState(false);

  const runningCount = useMemo(() => {
    return Object.values(processStatus?.trainers ?? {}).filter((info) => info.running).length;
  }, [processStatus]);

  const tickerProgress = useMemo(() => {
    const progress = parseProgress(trainerLogs);
    const trainers = processStatus?.trainers ?? {};
    for (const [ticker, info] of Object.entries(trainers)) {
      if (info.running && !progress.has(ticker)) {
        progress.set(ticker, newTickerProgress(ticker));
      }
    }
    return progress;
  }, [trainerLogs, processStatus]);

  const headerLabel = runningCount > 0 ? ` — ${runningCount} training` : '';

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid #27272a' }}>
        <h3 className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
          Trainer Output{headerLabel}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRaw((v) => !v)}
            className="px-3 py-1 text-xs rounded-lg transition-all"
            style={{
              background: showRaw ? 'rgba(0, 111, 238, 0.15)' : 'transparent',
              color: showRaw ? '#006FEE' : '#a1a1aa',
              border: showRaw ? '1px solid rgba(0, 111, 238, 0.25)' : '1px solid transparent',
            }}
          >
            Raw Output
          </button>
          <button
            onClick={clearTrainerLogs}
            className="px-3 py-1 text-xs rounded-lg transition-all"
            style={{ color: '#a1a1aa' }}
          >
            Clear
          </button>
        </div>
      </div>

      {showRaw ? (
        <LogViewer logs={trainerLogs} className="flex-1" />
      ) : (
        <div className="flex-1 overflow-auto">
          {tickerProgress.size === 0 ? (
            <div className="p-5 text-xs" style={{ color: '#a1a1aa' }}>No training in progress...</div>
          ) : (
            Array.from(tickerProgress.values()).map((p) => (
              <ProgressBar key={p.ticker} progress={p} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
