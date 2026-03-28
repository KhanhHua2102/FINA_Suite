import { useState, useEffect, useMemo } from 'react';
import { useSettingsStore, selectTickers, selectTimeframes } from '../../store/settingsStore';
import { usePredictions } from '../../hooks/useTrainingData';
import { DraggableTickerBar } from '../common/DraggableTickerBar';

function signalLabel(long: number, short: number): { text: string; color: string } {
  if (long > 0 && short === 0) return { text: 'Buy', color: '#17c964' };
  if (short > 0 && long === 0) return { text: 'Sell', color: '#f31260' };
  if (long > 0 && short > 0) return { text: 'Mixed', color: '#f5a524' };
  return { text: 'Neutral', color: '#a1a1aa' };
}

export function PredictionsTab() {
  const tickers = useSettingsStore(selectTickers);
  const timeframes = useSettingsStore(selectTimeframes);
  const [selectedTicker, setSelectedTicker] = useState('');

  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers, selectedTicker]);

  const { data, isLoading: loading, error: queryError } = usePredictions(selectedTicker);
  const error = queryError ? (queryError instanceof Error ? queryError.message : 'Failed to load predictions') : '';

  const overallSignal = useMemo(() => {
    if (!data?.signals) return null;
    let totalLong = 0, totalShort = 0;
    for (const tf of Object.values(data.signals)) {
      totalLong += tf.long;
      totalShort += tf.short;
    }
    return signalLabel(totalLong, totalShort);
  }, [data]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#18181b] rounded-xl">
      <DraggableTickerBar selectedTicker={selectedTicker} onSelect={setSelectedTicker} />

      <div className="flex-1 overflow-auto p-5">
        {loading && !data && (
          <div className="flex items-center justify-center h-full" style={{ color: '#a1a1aa' }}>Loading predictions...</div>
        )}

        {error && (
          <div className="flex items-center justify-center h-full" style={{ color: '#f31260' }}>{error}</div>
        )}

        {data && (
          <div className="space-y-5 max-w-4xl mx-auto">
            {/* Overall Signal */}
            <div className="bg-[#18181b] rounded-xl border border-[#27272a] p-6">
              <h2 className="text-base font-semibold mb-4 text-[#ECEDEE]">{selectedTicker} — Overall Signal</h2>
              <div className="flex items-center gap-6">
                <div className="text-3xl font-bold" style={{ color: overallSignal?.color ?? '#a1a1aa' }}>
                  {overallSignal?.text ?? 'No Data'}
                </div>
                {data.current_price > 0 && (
                  <div className="text-sm text-[#a1a1aa]">
                    Current Price: <span className="font-mono font-medium text-[#ECEDEE]">{data.current_price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Per-timeframe signals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {timeframes.map((tf) => {
                const sig = data.signals[tf];
                if (!sig) return (
                  <div key={tf} className="bg-[#18181b] rounded-xl border border-[#27272a] p-5">
                    <h3 className="text-sm font-medium mb-3 text-[#a1a1aa]">{tf.toUpperCase()}</h3>
                    <div className="text-sm text-[#71717a]">No data yet — run training first</div>
                  </div>
                );

                const label = signalLabel(sig.long, sig.short);

                return (
                  <div key={tf} className="bg-[#18181b] rounded-xl border border-[#27272a] p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-medium text-[#a1a1aa]">{tf.toUpperCase()}</h3>
                      <span className="text-sm font-bold" style={{ color: label.color }}>{label.text}</span>
                    </div>

                    <div className="space-y-3 mb-4">
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span style={{ color: '#17c964' }}>Buy Signal</span>
                          <span style={{ color: sig.long > 0 ? '#17c964' : '#71717a' }}>
                            {sig.long > 0 ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-[#27272a]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${sig.long * 100}%`,
                              background: '#17c964',
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span style={{ color: '#f31260' }}>Sell Signal</span>
                          <span style={{ color: sig.short > 0 ? '#f31260' : '#71717a' }}>
                            {sig.short > 0 ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden bg-[#27272a]">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${sig.short * 100}%`,
                              background: '#f31260',
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    {(sig.high_bound > 0 || sig.low_bound > 0) && (
                      <div className="pt-3 border-t border-[rgba(255, 255, 255, 0.15)]">
                        <div className="text-xs mb-2 text-[#71717a]">Predicted Range</div>
                        <div className="flex items-center justify-between text-sm font-mono">
                          <div>
                            <span className="text-[#71717a]">Low: </span>
                            <span className="font-medium" style={{ color: '#006FEE' }}>
                              {sig.low_bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                          <div>
                            <span className="text-[#71717a]">High: </span>
                            <span className="font-medium" style={{ color: '#f97316' }}>
                              {sig.high_bound.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                        {data.current_price > 0 && sig.high_bound > 0 && sig.low_bound > 0 && (
                          <div className="mt-2 text-xs text-[#71717a]">
                            Expected move: <span className="text-[#a1a1aa]">
                              {((sig.low_bound / data.current_price - 1) * 100).toFixed(2)}% to {((sig.high_bound / data.current_price - 1) * 100).toFixed(2)}%
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
