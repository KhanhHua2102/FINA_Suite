import { useMemo } from 'react';

interface NeuralTileProps {
  ticker: string;
  longSignal: number; // 0-7
  shortSignal: number; // 0-7
  onClick: () => void;
}

export function NeuralTile({ ticker, longSignal, shortSignal, onClick }: NeuralTileProps) {
  const longBars = useMemo(
    () => Array.from({ length: 7 }, (_, i) => i < longSignal),
    [longSignal]
  );

  const shortBars = useMemo(
    () => Array.from({ length: 7 }, (_, i) => i < shortSignal),
    [shortSignal]
  );

  return (
    <div
      onClick={onClick}
      className="w-24 p-2.5 rounded-xl cursor-pointer transition-all duration-200"
      style={{ background: '#18181b', border: '1px solid #27272a' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = '#27272a')}
      onMouseLeave={(e) => (e.currentTarget.style.background = '#18181b')}
    >
      <div className="text-xs font-medium text-center mb-2" style={{ color: '#ECEDEE' }}>{ticker}</div>

      <div className="flex justify-center gap-2 mb-2">
        <div className="flex flex-col-reverse gap-0.5">
          {longBars.map((active, i) => (
            <div
              key={i}
              className="w-4 h-2 rounded-sm transition-colors"
              style={{
                background: active ? '#006FEE' : '#27272a',
              }}
            />
          ))}
        </div>

        <div className="flex flex-col-reverse gap-0.5">
          {shortBars.map((active, i) => (
            <div
              key={i}
              className="w-4 h-2 rounded-sm transition-colors"
              style={{
                background: active ? '#f97316' : '#27272a',
              }}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center gap-2 text-xs font-mono">
        <span style={{ color: '#006FEE' }}>L:{longSignal}</span>
        <span style={{ color: '#f97316' }}>S:{shortSignal}</span>
      </div>
    </div>
  );
}
