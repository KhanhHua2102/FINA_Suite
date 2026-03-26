import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../../store/settingsStore';
import { settingsApi } from '../../services/api';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
}

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { settings, setSettings } = useSettingsStore();
  const [tickers, setTickers] = useState<string[]>(settings?.tickers ?? []);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<number>();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await settingsApi.searchTicker(query.trim());
        setResults(data.results.filter((r) => !tickers.includes(r.symbol)));
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, tickers]);

  const addTicker = (symbol: string) => {
    if (!tickers.includes(symbol)) {
      setTickers([...tickers, symbol]);
    }
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const removeTicker = (symbol: string) => {
    setTickers(tickers.filter((t) => t !== symbol));
  };

  const handleSave = async () => {
    if (tickers.length === 0) {
      setError('Must have at least one ticker');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await settingsApi.updateTickers(tickers);
      setSettings(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
    setSaving(false);
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-xl shadow-lg overflow-hidden" style={{ background: '#18181b' }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #27272a' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>Manage Tickers</h2>
          <button onClick={onClose} className="text-lg leading-none transition-colors" style={{ color: '#a1a1aa' }}>&times;</button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ticker (e.g. AAPL, VNM, BHP.AX)..."
            className="w-full text-sm px-3 py-2 rounded-lg outline-none transition-colors"
            style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE' }}
          />
          {searching && (
            <span className="absolute right-7 top-6 text-xs" style={{ color: '#a1a1aa' }}>Searching...</span>
          )}

          {results.length > 0 && (
            <div className="absolute left-5 right-5 mt-1 rounded-xl max-h-48 overflow-y-auto z-10 p-1 shadow-lg" style={{ background: '#18181b', border: '1px solid #27272a' }}>
              {results.map((r) => (
                <button
                  key={r.symbol}
                  onClick={() => addTicker(r.symbol)}
                  className="w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg transition-colors"
                  style={{ color: '#ECEDEE' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#27272a')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div>
                    <span className="text-sm font-medium" style={{ color: '#17c964' }}>{r.symbol}</span>
                    <span className="text-xs ml-2" style={{ color: '#a1a1aa' }}>{r.name}</span>
                  </div>
                  {r.exchange && <span className="text-xs" style={{ color: '#a1a1aa' }}>{r.exchange}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current Tickers */}
        <div className="px-5 py-4">
          <span className="text-xs font-medium" style={{ color: '#a1a1aa' }}>Current tickers ({tickers.length})</span>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {tickers.map((ticker) => (
              <span key={ticker} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full" style={{ background: '#27272a' }}>
                <span style={{ color: '#ECEDEE' }}>{ticker}</span>
                <button onClick={() => removeTicker(ticker)} className="text-xs leading-none ml-0.5 transition-colors" style={{ color: '#a1a1aa' }}>&times;</button>
              </span>
            ))}
            {tickers.length === 0 && <span className="text-xs" style={{ color: '#a1a1aa' }}>No tickers added</span>}
          </div>
        </div>

        {error && <div className="px-5 pb-2 text-xs" style={{ color: '#f31260' }}>{error}</div>}

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4" style={{ borderTop: '1px solid #27272a' }}>
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg transition-colors" style={{ color: '#a1a1aa' }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
            style={{ background: '#006FEE', color: '#ECEDEE' }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
