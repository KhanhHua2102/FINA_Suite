import { useState, useRef } from 'react';
import { Button } from '@heroui/button';
import { Select, SelectItem } from '@heroui/select';
import { useQueryClient } from '@tanstack/react-query';
import { portfolioApi } from '../../services/api';
import { usePortfolioStore } from '../../store/portfolioStore';
import type { ImportPreviewResult, ImportConfirmResult } from '../../services/types';

const REQUIRED_FIELDS = ['date', 'ticker', 'type', 'quantity', 'price'] as const;
const OPTIONAL_FIELDS = ['fees', 'amount'] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

type MappingField = (typeof ALL_FIELDS)[number];

export function ImportWizard() {
  const { selectedId, fetchTransactions, setSubView } = usePortfolioStore();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<'upload' | 'map' | 'duplicates' | 'done'>('upload');
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [currency, setCurrency] = useState('AUD');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number } | null>(null);
  const [dupInfo, setDupInfo] = useState<ImportConfirmResult | null>(null);

  const handleUpload = async (file: File) => {
    if (!selectedId) return;
    setLoading(true);
    setError('');
    try {
      const result = await portfolioApi.importPreview(selectedId, file);
      setPreview(result);
      const initial: Record<string, string> = {};
      for (const field of ALL_FIELDS) {
        const suggested = result.suggested_mapping[field];
        if (suggested) initial[field] = suggested;
      }
      setMapping(initial);
      setStep('map');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedId || !preview) return;
    for (const field of REQUIRED_FIELDS) {
      if (!mapping[field]) {
        setError(`Please map the "${field}" column`);
        return;
      }
    }
    setLoading(true);
    setError('');
    try {
      const result = await portfolioApi.importConfirm(
        selectedId, preview.file_id, mapping,
        currency !== 'AUD' ? currency : undefined,
      );
      if (result.status === 'duplicates_found') {
        setDupInfo(result);
        setStep('duplicates');
      } else {
        setImportResult({ imported: result.imported ?? 0 });
        setStep('done');
        queryClient.invalidateQueries({ queryKey: ['portfolio-dashboard', selectedId] });
        fetchTransactions(selectedId);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDuplicateChoice = async (choice: 'new_only' | 'import_all') => {
    if (!selectedId || !dupInfo?.file_id) return;
    setLoading(true);
    setError('');
    try {
      const result = await portfolioApi.importConfirm(
        selectedId, dupInfo.file_id, mapping,
        currency !== 'AUD' ? currency : undefined,
        choice === 'import_all' ? { force: true } : { skip_duplicates: true },
      );
      setImportResult({ imported: result.imported ?? 0 });
      setStep('done');
      queryClient.invalidateQueries({ queryKey: ['portfolio-dashboard', selectedId] });
      fetchTransactions(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed');
    } finally {
      setLoading(false);
    }
  };

  const updateMapping = (field: MappingField, column: string) => {
    setMapping(prev => {
      const next = { ...prev };
      if (column === '') {
        delete next[field];
      } else {
        next[field] = column;
      }
      return next;
    });
  };

  if (step === 'done' && importResult) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center"
          style={{ background: 'rgba(34,197,94,0.15)' }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#17c964" strokeWidth="2">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2" style={{ color: '#ECEDEE' }}>Import Complete</h2>
          <p style={{ color: '#a1a1aa' }}>{importResult.imported} transactions imported successfully.</p>
        </div>
        <div className="flex gap-3">
          <Button color="primary" size="md" radius="lg" onClick={() => setSubView('dashboard')}>
            View Dashboard
          </Button>
          <Button variant="flat" size="md" radius="lg" onClick={() => setSubView('transactions')}>
            View Transactions
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'duplicates' && dupInfo && dupInfo.rows) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#ECEDEE' }}>Review Transactions</h2>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            <span className="font-medium" style={{ color: '#f5a524' }}>{dupInfo.duplicate_count}</span> of {dupInfo.total_count} transactions already exist.
            Duplicates are highlighted -- matched by ticker, date, type, quantity, and price.
          </p>
        </div>

        {/* All rows table with duplicate highlighting */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#18181b', border: '1px solid #27272a' }}
        >
          <div
            className="px-6 py-3 flex items-center justify-between"
            style={{ borderBottom: '1px solid #27272a' }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
              All Transactions ({dupInfo.total_count})
            </h3>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ background: 'rgba(234,179,8,0.2)', border: '1px solid rgba(234,179,8,0.4)' }} />
                Duplicate ({dupInfo.duplicate_count})
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded" style={{ background: '#27272a' }} />
                New ({dupInfo.new_count})
              </span>
            </div>
          </div>
          <div className="overflow-auto max-h-96">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: '#18181b' }}>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  <th className="px-4 py-2 text-left text-xs w-8" style={{ color: '#a1a1aa' }}></th>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#a1a1aa' }}>Date</th>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#a1a1aa' }}>Ticker</th>
                  <th className="px-4 py-2 text-left text-xs" style={{ color: '#a1a1aa' }}>Type</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#a1a1aa' }}>Qty</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#a1a1aa' }}>Price</th>
                  <th className="px-4 py-2 text-right text-xs" style={{ color: '#a1a1aa' }}>Fees</th>
                </tr>
              </thead>
              <tbody>
                {dupInfo.rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                      background: row.is_duplicate ? 'rgba(234,179,8,0.06)' : undefined,
                    }}
                  >
                    <td className="px-4 py-1.5 text-center">
                      {row.is_duplicate && (
                        <span className="text-xs font-bold" style={{ color: '#f5a524' }} title="Duplicate">DUP</span>
                      )}
                    </td>
                    <td className="px-4 py-1.5 font-mono text-xs" style={{ color: '#ECEDEE' }}>{row.date}</td>
                    <td className="px-4 py-1.5 font-mono text-xs" style={{ color: '#ECEDEE' }}>{row.ticker}</td>
                    <td className="px-4 py-1.5 text-xs" style={{ color: '#ECEDEE' }}>{row.type}</td>
                    <td className="px-4 py-1.5 font-mono text-xs text-right" style={{ color: '#ECEDEE' }}>{row.quantity}</td>
                    <td className="px-4 py-1.5 font-mono text-xs text-right" style={{ color: '#ECEDEE' }}>${row.price.toFixed(2)}</td>
                    <td className="px-4 py-1.5 font-mono text-xs text-right" style={{ color: '#a1a1aa' }}>{row.fees ? `$${row.fees.toFixed(2)}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: '#f31260' }}>{error}</p>}

        <div className="flex gap-3">
          <Button variant="flat" size="md" radius="lg" onClick={() => { setStep('map'); setDupInfo(null); setError(''); }}>
            Back
          </Button>
          {dupInfo.new_count! > 0 && (
            <Button color="primary" size="md" radius="lg" isDisabled={loading} onClick={() => handleDuplicateChoice('new_only')}>
              {loading ? 'Importing...' : `Import ${dupInfo.new_count} New Only`}
            </Button>
          )}
          <Button variant="flat" size="md" radius="lg" isDisabled={loading} onClick={() => handleDuplicateChoice('import_all')}>
            {loading ? 'Importing...' : `Import All ${dupInfo.total_count}`}
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'map' && preview) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-bold mb-1" style={{ color: '#ECEDEE' }}>Map Columns</h2>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            {preview.row_count} rows found. Map your file columns to transaction fields.
          </p>
        </div>

        {/* Currency Selection */}
        <div
          className="rounded-xl p-6"
          style={{ background: '#18181b', border: '1px solid #27272a' }}
        >
          <div className="flex items-center gap-4">
            <div>
              <Select
                label="File Currency *"
                labelPlacement="outside"
                selectedKeys={new Set([currency])}
                onSelectionChange={keys => { const v = Array.from(keys)[0] as string; if (v) setCurrency(v); }}
                variant="bordered"
                size="sm"
              >
                <SelectItem key="AUD">AUD -- Australian Dollar</SelectItem>
                <SelectItem key="USD">USD -- US Dollar</SelectItem>
              </Select>
            </div>
            {currency === 'USD' && (
              <p className="text-xs mt-4" style={{ color: '#a1a1aa' }}>
                Prices will be stored in USD and converted to AUD for display using live exchange rates.
              </p>
            )}
          </div>
        </div>

        {/* Column Mapping */}
        <div
          className="rounded-xl p-6"
          style={{ background: '#18181b', border: '1px solid #27272a' }}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {ALL_FIELDS.map(field => (
              <div key={field}>
                <Select
                  label={`${field} ${REQUIRED_FIELDS.includes(field as typeof REQUIRED_FIELDS[number]) ? '*' : '(optional)'}`}
                  labelPlacement="outside"
                  placeholder="-- Select column --"
                  items={preview.columns.map(col => ({ key: col, label: col }))}
                  selectedKeys={mapping[field] ? new Set([mapping[field]]) : new Set<string>()}
                  onSelectionChange={keys => { const v = Array.from(keys)[0] as string; updateMapping(field, v || ''); }}
                  variant="bordered"
                  size="sm"
                >
                  {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                </Select>
              </div>
            ))}
          </div>
        </div>

        {/* Sample Preview */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: '#18181b', border: '1px solid #27272a' }}
        >
          <div
            className="px-6 py-3"
            style={{ borderBottom: '1px solid #27272a' }}
          >
            <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: '#a1a1aa' }}>
              Preview ({preview.sample_rows.length} rows)
            </h3>
          </div>
          <div className="overflow-auto max-h-80">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid #27272a' }}>
                  {preview.columns.map(col => {
                    const mappedTo = Object.entries(mapping).find(([, v]) => v === col)?.[0];
                    return (
                      <th key={col} className="px-4 py-2 text-left text-xs whitespace-nowrap" style={{ color: '#a1a1aa' }}>
                        {col}
                        {mappedTo && (
                          <span
                            className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{ background: 'rgba(99,102,241,0.15)', color: '#006FEE' }}
                          >
                            {mappedTo}
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.sample_rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}>
                    {preview.columns.map(col => (
                      <td key={col} className="px-4 py-2 whitespace-nowrap font-mono text-xs" style={{ color: '#ECEDEE' }}>
                        {row[col] || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: '#f31260' }}>{error}</p>}

        <div className="flex gap-3">
          <Button variant="flat" size="md" radius="lg" onClick={() => { setStep('upload'); setPreview(null); setError(''); }}>
            Back
          </Button>
          <Button color="primary" size="md" radius="lg" isDisabled={loading} onClick={handleConfirm}>
            {loading ? 'Checking...' : `Import ${preview.row_count} Transactions`}
          </Button>
        </div>
      </div>
    );
  }

  // Upload step
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold mb-1" style={{ color: '#ECEDEE' }}>Import Transactions</h2>
        <p className="text-sm" style={{ color: '#a1a1aa' }}>
          Upload a CSV or XLSX file from your broker. Supported formats include BetaShares, Sharesight, and most standard broker exports.
        </p>
      </div>

      <div
        className="rounded-xl p-12 text-center transition-colors cursor-pointer"
        style={{ border: '2px dashed #27272a' }}
        onClick={() => fileRef.current?.click()}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#006FEE'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#27272a'; }}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          const file = e.dataTransfer.files[0];
          if (file) handleUpload(file);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleUpload(file);
          }}
        />
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="mx-auto mb-4" style={{ color: '#a1a1aa' }}>
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <p className="font-medium mb-1" style={{ color: '#ECEDEE' }}>
          {loading ? 'Processing...' : 'Drop file here or click to browse'}
        </p>
        <p className="text-sm" style={{ color: '#a1a1aa' }}>CSV or XLSX files supported</p>
      </div>

      {error && <p className="text-sm" style={{ color: '#f31260' }}>{error}</p>}
    </div>
  );
}
