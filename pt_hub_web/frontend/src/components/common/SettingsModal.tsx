import { useRef, useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@heroui/modal';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
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

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (!value.trim()) {
      setResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(async () => {
      setSearching(true);
      try {
        const data = await settingsApi.searchTicker(value.trim());
        setResults(data.results.filter((r) => !tickers.includes(r.symbol)));
      } catch {
        setResults([]);
      }
      setSearching(false);
    }, 400);
  };

  const addTicker = (symbol: string) => {
    if (!tickers.includes(symbol)) {
      setTickers([...tickers, symbol]);
    }
    setQuery('');
    setResults([]);
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

  return (
    <Modal isOpen={true} onClose={onClose} size="md">
      <ModalContent>
        <ModalHeader className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
          Manage Tickers
        </ModalHeader>

        <ModalBody>
          {/* Search */}
          <div className="relative">
            <Input
              autoFocus
              placeholder="Search ticker (e.g. AAPL, VNM, BHP.AX)..."
              value={query}
              onValueChange={handleQueryChange}
              variant="bordered"
              size="sm"
            />
            {searching && (
              <span className="absolute right-3 top-2.5 text-xs" style={{ color: '#a1a1aa' }}>Searching...</span>
            )}

            {results.length > 0 && (
              <div className="absolute left-0 right-0 mt-1 rounded-xl max-h-48 overflow-y-auto z-10 p-1 shadow-lg" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                {results.map((r) => (
                  <Button
                    key={r.symbol}
                    variant="light"
                    size="sm"
                    onClick={() => addTicker(r.symbol)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-left rounded-lg"
                  >
                    <div>
                      <span className="text-sm font-medium" style={{ color: '#17c964' }}>{r.symbol}</span>
                      <span className="text-xs ml-2" style={{ color: '#a1a1aa' }}>{r.name}</span>
                    </div>
                    {r.exchange && <span className="text-xs" style={{ color: '#a1a1aa' }}>{r.exchange}</span>}
                  </Button>
                ))}
              </div>
            )}
          </div>

          {/* Current Tickers */}
          <div>
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

          {error && <div className="text-xs" style={{ color: '#f31260' }}>{error}</div>}
        </ModalBody>

        <ModalFooter>
          <Button variant="light" size="sm" onClick={onClose}>Cancel</Button>
          <Button color="primary" size="sm" onClick={handleSave} isDisabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
