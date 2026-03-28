import { useSettingsStore } from '../../store/settingsStore';
import { useTrainingStore } from '../../store/trainingStore';
import { useNeuralSignals } from '../../hooks/useTrainingData';
import { NeuralTile } from './NeuralTile';

export function NeuralSignals() {
  const { settings, setChartTicker, setActiveTab } = useSettingsStore();
  const { neuralSignals } = useTrainingStore();

  const tickers = settings?.tickers ?? [];

  // React Query handles 5s polling + deduplication with bootstrap prefetch
  useNeuralSignals();

  const handleTileClick = (ticker: string) => {
    setChartTicker(ticker);
    setActiveTab('charts');
  };

  return (
    <div className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>Neural Signals</h3>
        <div className="flex gap-4 text-xs" style={{ color: '#a1a1aa' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: '#006FEE' }} />
            Long
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ background: '#f97316' }} />
            Short
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {tickers.map((ticker) => {
          const signal = neuralSignals[ticker] ?? { long_signal: 0, short_signal: 0 };
          return (
            <NeuralTile
              key={ticker}
              ticker={ticker}
              longSignal={signal.long_signal}
              shortSignal={signal.short_signal}
              onClick={() => handleTileClick(ticker)}
            />
          );
        })}
      </div>

      {tickers.length === 0 && (
        <div className="text-sm text-center py-8" style={{ color: '#a1a1aa' }}>
          No tickers configured
        </div>
      )}
    </div>
  );
}
