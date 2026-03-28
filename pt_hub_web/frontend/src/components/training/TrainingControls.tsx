import { useEffect, useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@heroui/button';
import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingStore } from '../../store/trainingStore';
import { useTradeStore } from '../../store/tradeStore';
import { trainingApi } from '../../services/api';
import { useTrainingStatus, trainingKeys } from '../../hooks/useTrainingData';

export function TrainingControls() {
  const { settings } = useSettingsStore();
  const { trainingStatus, setRunningTrainers } = useTrainingStore();
  const { processStatus, setProcessStatus } = useTradeStore();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tickers = settings?.tickers ?? [];
  const trainers = processStatus?.trainers;

  const runningTrainers = useMemo(() => {
    return Object.keys(trainers ?? {}).filter(
      (ticker) => trainers?.[ticker]?.running
    );
  }, [trainers]);

  // Leverages React Query cache — if bootstrap already fetched, this is instant
  useTrainingStatus();

  useEffect(() => {
    setRunningTrainers(runningTrainers);
  }, [runningTrainers, setRunningTrainers]);

  const handleTrain = async (ticker: string) => {
    setLoading(ticker);
    setError(null);
    try {
      const response = await trainingApi.start(ticker);
      if (response.process_status) {
        setProcessStatus(response.process_status);
      }
      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start training');
      setLoading(null);
    }
  };

  const handleStop = async (ticker: string) => {
    setLoading(ticker);
    setError(null);
    try {
      const response = await trainingApi.stop(ticker);
      if (response.process_status) {
        setProcessStatus(response.process_status);
      }
      setLoading(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop training');
      setLoading(null);
    }
  };

  const allRunning = tickers.length > 0 && tickers.every((t) => runningTrainers.includes(t));
  const anyRunning = runningTrainers.length > 0;

  const handleStopAll = async () => {
    setLoading('stop-all');
    setError(null);
    try {
      for (const ticker of runningTrainers) {
        const response = await trainingApi.stop(ticker);
        if (response.process_status) {
          setProcessStatus(response.process_status);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop training');
    }
    setLoading(null);
  };

  const handleTrainAll = async () => {
    setLoading('train-all');
    setError(null);
    try {
      for (const ticker of tickers) {
        if (!runningTrainers.includes(ticker)) {
          const response = await trainingApi.start(ticker);
          if (response.process_status) {
            setProcessStatus(response.process_status);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start training');
    }
    setLoading(null);
  };

  const handleClear = async () => {
    setLoading('clear');
    setError(null);
    try {
      await trainingApi.clear();
      await queryClient.invalidateQueries({ queryKey: trainingKeys.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear training');
    }
    setLoading(null);
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>Training Controls</h3>
        <div className="flex items-center gap-2">
          {anyRunning && (
            <Button
              color="danger"
              size="sm"
              onClick={handleStopAll}
              isDisabled={loading === 'stop-all'}
            >
              {loading === 'stop-all' ? 'Stopping...' : 'Stop All'}
            </Button>
          )}
          <Button
            color="primary"
            size="sm"
            onClick={handleTrainAll}
            isDisabled={loading === 'train-all' || allRunning}
          >
            {loading === 'train-all' ? 'Starting...' : 'Train All'}
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {tickers.map((ticker) => {
          const status = trainingStatus[ticker] ?? 'NOT_TRAINED';
          const isRunning = runningTrainers.includes(ticker);
          const isLoading = loading === ticker;

          return (
            <div
              key={ticker}
              className="flex items-center justify-between p-3 rounded-xl"
              style={{ background: '#27272a' }}
            >
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm" style={{ color: '#ECEDEE' }}>{ticker}</span>
                <StatusBadge status={isRunning ? 'TRAINING' : status} />
              </div>

              <div className="flex gap-2">
                {isRunning ? (
                  <Button
                    color="danger"
                    size="sm"
                    onClick={() => handleStop(ticker)}
                    isDisabled={isLoading}
                  >
                    {isLoading ? 'Stopping...' : 'Stop'}
                  </Button>
                ) : (
                  <Button
                    color="primary"
                    size="sm"
                    onClick={() => handleTrain(ticker)}
                    isDisabled={isLoading}
                  >
                    {isLoading ? 'Starting...' : 'Train'}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Button
        variant="flat"
        size="sm"
        onClick={handleClear}
        isDisabled={loading === 'clear'}
        className="w-full"
      >
        {loading === 'clear' ? 'Clearing...' : 'Clear All Training'}
      </Button>

      {error && <div className="mt-3 text-xs" style={{ color: '#f31260' }}>{error}</div>}

      <div className="mt-4 text-xs" style={{ color: '#a1a1aa' }}>
        Flow: Train tickers &rarr; Start All (in Trade tab)
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config = {
    TRAINED: {
      bg: 'rgba(23, 201, 100, 0.1)',
      border: 'rgba(23, 201, 100, 0.25)',
      color: '#17c964',
      label: 'Trained',
    },
    TRAINING: {
      bg: 'rgba(245, 165, 36, 0.1)',
      border: 'rgba(245, 165, 36, 0.25)',
      color: '#f5a524',
      label: 'Training',
    },
    PARTIAL: {
      bg: 'rgba(245, 165, 36, 0.1)',
      border: 'rgba(245, 165, 36, 0.25)',
      color: '#f5a524',
      label: 'Partial',
    },
    NOT_TRAINED: {
      bg: '#27272a',
      border: '#27272a',
      color: '#a1a1aa',
      label: 'Not Trained',
    },
  }[status] ?? {
    bg: '#27272a',
    border: '#27272a',
    color: '#a1a1aa',
    label: status,
  };

  return (
    <span
      className="px-2.5 py-0.5 text-xs font-medium rounded-full"
      style={{
        background: config.bg,
        border: `1px solid ${config.border}`,
        color: config.color,
      }}
    >
      {config.label}
    </span>
  );
}
