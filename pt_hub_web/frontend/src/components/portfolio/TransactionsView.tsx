import { useState, useEffect } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { Checkbox } from '@heroui/checkbox';
import { Select, SelectItem } from '@heroui/select';
import { usePortfolioStore } from '../../store/portfolioStore';
import { TickerAvatar } from '../common/TickerAvatar';

const dt = (t: string) => t.replace(/:.*$/, '');

const TYPE_CONFIG: Record<string, { bg: string; border: string; color: string; icon: JSX.Element; label: string }> = {
  BUY: {
    bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.20)', color: '#17c964', label: 'Buy',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>,
  },
  SELL: {
    bg: 'rgba(243,18,96,0.12)', border: 'rgba(243,18,96,0.20)', color: '#f31260', label: 'Sell',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12l7 7 7-7" /></svg>,
  },
  DIVIDEND: {
    bg: 'rgba(0,111,238,0.12)', border: 'rgba(0,111,238,0.20)', color: '#006FEE', label: 'Dividend',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 100 7h5a3.5 3.5 0 110 7H6" /></svg>,
  },
  SPLIT: {
    bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.20)', color: '#a78bfa', label: 'Split',
    icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>,
  },
};

function formatCurrency(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}


export function TransactionsView() {
  const { selectedId, transactions, txnTotal, txnPage, txnLoading, fetchTransactions, addTransaction, deleteTransaction, batchDeleteTransactions } = usePortfolioStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ticker: '', type: 'BUY', date: '', quantity: '', price: '', fees: '', notes: '' });
  const [addError, setAddError] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [filterType, setFilterType] = useState<string | null>(null);
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [sortField, setSortField] = useState<'date' | 'ticker' | 'type' | 'total'>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const pageSize = 50;
  const totalPages = Math.ceil(txnTotal / pageSize);

  useEffect(() => {
    if (selectedId) fetchTransactions(selectedId);
  }, [selectedId, fetchTransactions]);

  const handleAdd = async () => {
    if (!selectedId) return;
    if (!form.ticker || !form.date || !form.quantity) {
      setAddError('Ticker, date, and quantity are required');
      return;
    }
    setAddError('');
    try {
      await addTransaction(selectedId, {
        ticker: form.ticker.toUpperCase(),
        type: form.type,
        date: form.date,
        quantity: parseFloat(form.quantity),
        price: parseFloat(form.price) || 0,
        fees: parseFloat(form.fees) || 0,
        notes: form.notes || undefined,
      });
      setForm({ ticker: '', type: 'BUY', date: '', quantity: '', price: '', fees: '', notes: '' });
      setShowAdd(false);
    } catch (e) {
      setAddError(e instanceof Error ? e.message : 'Failed to add transaction');
    }
  };

  const handleDelete = async (txnId: number) => {
    if (!selectedId) return;
    if (!confirm('Delete this transaction?')) return;
    await deleteTransaction(selectedId, txnId);
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectMode = () => { setSelectMode(false); setSelected(new Set()); };

  const handleBatchDelete = async () => {
    if (!selectedId || selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} transaction${selected.size > 1 ? 's' : ''}?`)) return;
    setDeleting(true);
    try {
      await batchDeleteTransactions(selectedId, Array.from(selected));
      exitSelectMode();
    } finally {
      setDeleting(false);
    }
  };

  // Filter & sort
  const filteredTxns = transactions
    .filter(t => !filterType || t.type === filterType)
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'date': return dir * a.date.localeCompare(b.date);
        case 'ticker': return dir * a.ticker.localeCompare(b.ticker);
        case 'type': return dir * a.type.localeCompare(b.type);
        case 'total': return dir * ((a.quantity * a.price) - (b.quantity * b.price));
        default: return 0;
      }
    });

  const startIdx = txnPage * pageSize;
  const endIdx = Math.min(startIdx + filteredTxns.length, txnTotal);

  return (
    <div className="space-y-4">
      {/* Header: title + action buttons (matching "Recent activity" header) */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: '#ECEDEE' }}>
          {selectMode ? `${selected.size} selected` : 'Recent activity'}
        </h2>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <Button color="danger" size="sm" radius="lg" isDisabled={selected.size === 0 || deleting} onClick={handleBatchDelete}>
                {deleting ? 'Deleting...' : `Delete (${selected.size})`}
              </Button>
              <Button variant="flat" size="sm" radius="lg" onClick={exitSelectMode}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              {/* Filter button */}
              <div className="relative">
                <Button
                  variant="flat"
                  size="sm"
                  radius="lg"
                  onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <line x1="4" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="11" y1="18" x2="13" y2="18" />
                  </svg>
                  Filter
                  {filterType && (
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#006FEE' }} />
                  )}
                </Button>
                {showFilterMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 rounded-xl p-1 z-20 min-w-[140px] shadow-xl"
                    style={{ background: '#18181b', border: '1px solid #27272a' }}
                  >
                    {['BUY', 'SELL', 'DIVIDEND', 'SPLIT'].map(t => {
                      const tc = TYPE_CONFIG[t];
                      return (
                        <Button
                          key={t}
                          variant="light"
                          size="sm"
                          onClick={() => { setFilterType(filterType === t ? null : t); setShowFilterMenu(false); }}
                          className="w-full justify-start gap-2"
                          style={{
                            background: filterType === t ? 'rgba(0,111,238,0.10)' : 'transparent',
                            color: filterType === t ? '#006FEE' : '#a1a1aa',
                          }}
                        >
                          <span style={{ color: tc?.color }}>{tc?.icon}</span>
                          {tc?.label}
                        </Button>
                      );
                    })}
                    {filterType && (
                      <>
                        <div style={{ borderTop: '1px solid #27272a', margin: '4px 0' }} />
                        <Button
                          variant="light"
                          size="sm"
                          onClick={() => { setFilterType(null); setShowFilterMenu(false); }}
                          className="w-full justify-start"
                          style={{ color: '#71717a' }}
                        >
                          Clear filter
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
              {/* Sort button */}
              <div className="relative">
                <Button
                  variant="flat"
                  size="sm"
                  radius="lg"
                  onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M3 12h12M3 18h6" />
                  </svg>
                  Sort
                </Button>
                {showSortMenu && (
                  <div
                    className="absolute right-0 top-full mt-1.5 rounded-xl p-1 z-20 min-w-[140px] shadow-xl"
                    style={{ background: '#18181b', border: '1px solid #27272a' }}
                  >
                    {([['date', 'Date'], ['ticker', 'Asset'], ['type', 'Type'], ['total', 'Value']] as const).map(([field, label]) => (
                      <Button
                        key={field}
                        variant="light"
                        size="sm"
                        onClick={() => {
                          if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
                          else { setSortField(field); setSortDir('desc'); }
                          setShowSortMenu(false);
                        }}
                        className="w-full justify-between"
                        style={{
                          background: sortField === field ? 'rgba(0,111,238,0.10)' : 'transparent',
                          color: sortField === field ? '#006FEE' : '#a1a1aa',
                        }}
                      >
                        {label}
                        {sortField === field && <span className="text-xs">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
              {/* Add button */}
              <Button color="primary" size="sm" radius="lg" onClick={() => setShowAdd(!showAdd)}>
                {showAdd ? 'Cancel' : '+ Add'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Add Transaction Form */}
      {showAdd && (
        <div className="rounded-2xl p-5" style={{ background: '#18181b', border: '1px solid #27272a' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ticker *', key: 'ticker', type: 'text', placeholder: 'AAPL' },
              { label: 'Date *', key: 'date', type: 'date' },
              { label: 'Quantity *', key: 'quantity', type: 'number', placeholder: '100', mono: true },
              { label: 'Price ($)', key: 'price', type: 'number', placeholder: '150.00', mono: true },
              { label: 'Fees ($)', key: 'fees', type: 'number', placeholder: '9.95', mono: true },
            ].map(f => (
              <div key={f.key}>
                <Input
                  label={f.label}
                  labelPlacement="outside"
                  type={f.type}
                  step={f.type === 'number' ? 'any' : undefined}
                  value={(form as Record<string, string>)[f.key]}
                  onValueChange={v => setForm(prev => ({ ...prev, [f.key]: v }))}
                  placeholder={f.placeholder}
                  variant="bordered"
                  size="sm"
                  classNames={f.mono ? { input: 'font-mono' } : undefined}
                />
              </div>
            ))}
            <div>
              <Select
                label="Type *"
                labelPlacement="outside"
                selectedKeys={new Set([form.type])}
                onSelectionChange={keys => { const v = Array.from(keys)[0] as string; if (v) setForm(f => ({ ...f, type: v })); }}
                variant="bordered"
                size="sm"
              >
                <SelectItem key="BUY">Buy</SelectItem>
                <SelectItem key="SELL">Sell</SelectItem>
                <SelectItem key="DIVIDEND">Dividend</SelectItem>
                <SelectItem key="SPLIT">Split</SelectItem>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Input
                label="Notes"
                labelPlacement="outside"
                type="text"
                value={form.notes}
                onValueChange={v => setForm(f => ({ ...f, notes: v }))}
                placeholder="Optional notes"
                variant="bordered"
                size="sm"
              />
            </div>
          </div>
          {addError && <p className="text-xs mt-2" style={{ color: '#f31260' }}>{addError}</p>}
          <Button color="primary" size="md" radius="lg" className="mt-4" onClick={handleAdd}>
            Add Transaction
          </Button>
        </div>
      )}

      {/* Transaction Table (matching "Recent activity" from reference) */}
      <div className="rounded-2xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        {txnLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-5 h-5 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
            <span className="ml-2.5 text-sm" style={{ color: '#71717a' }}>Loading...</span>
          </div>
        ) : filteredTxns.length === 0 ? (
          <p className="text-center py-16 text-sm" style={{ color: '#52525b' }}>
            {filterType ? `No ${TYPE_CONFIG[filterType]?.label} transactions` : 'No transactions yet.'}
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: '#18181b' }}>
                    {selectMode && (
                      <th className="px-5 py-3 w-10" style={{ borderBottom: '1px solid #27272a' }}>
                        <Checkbox
                          isSelected={filteredTxns.length > 0 && selected.size === filteredTxns.length}
                          onValueChange={() => {
                            if (selected.size === filteredTxns.length) setSelected(new Set());
                            else setSelected(new Set(filteredTxns.map(t => t.id)));
                          }}
                          color="primary"
                          size="sm"
                        />
                      </th>
                    )}
                    <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>Date</th>
                    <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>Type</th>
                    <th className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>Asset</th>
                    <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>Value</th>
                    <th className="px-5 py-3 text-right text-xs font-medium" style={{ color: '#71717a', borderBottom: '1px solid #27272a' }}>Qty</th>
                    {!selectMode && <th className="px-3 py-3 w-10" style={{ borderBottom: '1px solid #27272a' }} />}
                  </tr>
                </thead>
                <tbody>
                  {filteredTxns.map(txn => {
                    const tc = TYPE_CONFIG[txn.type];
                    const isSelected = selectMode && selected.has(txn.id);
                    const total = txn.quantity * txn.price;
                    return (
                      <tr
                        key={txn.id}
                        className="transition-colors"
                        style={{
                          borderBottom: '1px solid #27272a',
                          background: isSelected ? 'rgba(0,111,238,0.06)' : undefined,
                          cursor: selectMode ? 'pointer' : undefined,
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(0,111,238,0.06)' : ''; }}
                        onClick={selectMode ? () => toggleSelect(txn.id) : undefined}
                      >
                        {selectMode && (
                          <td className="px-5 py-4 w-10" onClick={e => e.stopPropagation()}>
                            <Checkbox
                              isSelected={selected.has(txn.id)}
                              onValueChange={() => toggleSelect(txn.id)}
                              color="primary"
                              size="sm"
                            />
                          </td>
                        )}
                        <td className="px-5 py-4" style={{ color: '#a1a1aa' }}>
                          {formatDate(txn.date)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                            style={tc ? { background: tc.bg, border: `1px solid ${tc.border}`, color: tc.color } : undefined}
                          >
                            {tc?.icon}
                            {tc?.label || txn.type}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <TickerAvatar ticker={dt(txn.ticker)} size={32} />
                            <span className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>{dt(txn.ticker)}</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <p className="text-sm font-mono" style={{ color: '#ECEDEE' }}>{txn.quantity}</p>
                          <p className="text-xs font-mono" style={{ color: '#71717a' }}>${formatCurrency(total)}</p>
                        </td>
                        <td className="px-5 py-4 text-right font-mono text-sm" style={{ color: '#a1a1aa' }}>
                          ${formatCurrency(txn.price)}
                        </td>
                        {!selectMode && (
                          <td className="px-3 py-4 w-10">
                            <Button
                              isIconOnly
                              variant="light"
                              size="sm"
                              onClick={() => handleDelete(txn.id)}
                              title="Delete"
                              style={{ color: '#3f3f46' }}
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                                <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                              </svg>
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer (matching reference: "1 to 5 of 10 invoices" + Previous/Next) */}
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #27272a' }}>
              <p className="text-xs" style={{ color: '#71717a' }}>
                {startIdx + 1} to {endIdx} of {txnTotal} transactions
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="light"
                    size="sm"
                    isDisabled={txnPage === 0}
                    onClick={() => selectedId && fetchTransactions(selectedId, txnPage - 1)}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
                    Previous
                  </Button>
                  <Button
                    variant="light"
                    size="sm"
                    isDisabled={txnPage >= totalPages - 1}
                    onClick={() => selectedId && fetchTransactions(selectedId, txnPage + 1)}
                  >
                    Next
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
