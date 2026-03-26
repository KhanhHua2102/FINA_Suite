import { useState, useEffect } from 'react';
import { usePortfolioStore } from '../../store/portfolioStore';

const TYPE_COLORS: Record<string, { background: string; border: string; color: string }> = {
  BUY: { background: 'rgba(34,197,94,0.15)', border: 'rgba(34,197,94,0.25)', color: '#17c964' },
  SELL: { background: 'rgba(239,68,68,0.15)', border: 'rgba(239,68,68,0.25)', color: '#f31260' },
  DIVIDEND: { background: 'rgba(99,102,241,0.15)', border: 'rgba(99,102,241,0.25)', color: '#006FEE' },
  SPLIT: { background: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.25)', color: '#a78bfa' },
};

function formatCurrency(v: number) {
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TransactionsView() {
  const { selectedId, transactions, txnTotal, txnPage, txnLoading, fetchTransactions, addTransaction, deleteTransaction, batchDeleteTransactions } = usePortfolioStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ ticker: '', type: 'BUY', date: '', quantity: '', price: '', fees: '', notes: '' });
  const [addError, setAddError] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);

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

  const toggleSelectAll = () => {
    if (selected.size === transactions.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(transactions.map(t => t.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold" style={{ color: '#ECEDEE' }}>
          {selectMode ? `${selected.size} selected` : `Transactions (${txnTotal})`}
        </h2>
        <div className="flex items-center gap-2">
          {selectMode ? (
            <>
              <button
                onClick={handleBatchDelete}
                disabled={selected.size === 0 || deleting}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors text-white disabled:opacity-50"
                style={{ background: '#f31260' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f31260'; }}
              >
                {deleting ? 'Deleting...' : `Delete (${selected.size})`}
              </button>
              <button
                onClick={exitSelectMode}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors"
                style={{ background: '#27272a', color: '#ECEDEE' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setSelectMode(true)}
                disabled={transactions.length === 0}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
                style={{ background: '#27272a', color: '#ECEDEE' }}
              >
                Select
              </button>
              <button
                onClick={() => setShowAdd(!showAdd)}
                className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors text-white"
                style={{ background: '#006FEE' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#338ef7'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#006FEE'; }}
              >
                {showAdd ? 'Cancel' : '+ Add Transaction'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Add Transaction Form */}
      {showAdd && (
        <div className="rounded-xl p-4" style={{ background: '#18181b', border: '1px solid #27272a' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Ticker *</label>
              <input
                type="text"
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))}
                placeholder="AAPL"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Type *</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
                <option value="DIVIDEND">DIVIDEND</option>
                <option value="SPLIT">SPLIT</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Quantity *</label>
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))}
                placeholder="100"
                className="w-full px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Price ($)</label>
              <input
                type="number"
                step="any"
                value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="150.00"
                className="w-full px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
            <div>
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Fees ($)</label>
              <input
                type="number"
                step="any"
                value={form.fees}
                onChange={e => setForm(f => ({ ...f, fees: e.target.value }))}
                placeholder="9.95"
                className="w-full px-3 py-2 rounded-xl text-sm font-mono"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs uppercase block mb-1" style={{ color: '#a1a1aa' }}>Notes</label>
              <input
                type="text"
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Optional notes"
                className="w-full px-3 py-2 rounded-xl text-sm"
                style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
                onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              />
            </div>
          </div>
          {addError && <p className="text-sm mt-2" style={{ color: '#f31260' }}>{addError}</p>}
          <button
            onClick={handleAdd}
            className="mt-3 px-4 py-2 text-sm font-semibold rounded-xl transition-colors text-white"
            style={{ background: '#006FEE' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#338ef7'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#006FEE'; }}
          >
            Add Transaction
          </button>
        </div>
      )}

      {/* Transaction Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
        {txnLoading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="animate-spin w-5 h-5 rounded-full"
              style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }}
            />
            <span className="ml-2 text-sm" style={{ color: '#a1a1aa' }}>Loading...</span>
          </div>
        ) : transactions.length === 0 ? (
          <p className="text-center py-12 text-sm" style={{ color: '#a1a1aa' }}>No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase" style={{ borderBottom: '1px solid #27272a', color: '#a1a1aa' }}>
                  {selectMode && (
                    <th className="px-4 py-2 w-8">
                      <input
                        type="checkbox"
                        checked={transactions.length > 0 && selected.size === transactions.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: '#006FEE' }}
                      />
                    </th>
                  )}
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Ticker</th>
                  <th className="px-4 py-2 text-center">Type</th>
                  <th className="px-4 py-2 text-right">Qty</th>
                  <th className="px-4 py-2 text-right">Price</th>
                  <th className="px-4 py-2 text-right">Fees</th>
                  <th className="px-4 py-2 text-right">Total</th>
                  {!selectMode && <th className="px-4 py-2" />}
                </tr>
              </thead>
              <tbody>
                {transactions.map(txn => {
                  const isSelected = selectMode && selected.has(txn.id);
                  return (
                    <tr
                      key={txn.id}
                      className="last:border-0 transition-colors"
                      style={{
                        borderBottom: '1px solid rgba(255, 255, 255, 0.15)',
                        background: isSelected ? 'rgba(99,102,241,0.08)' : undefined,
                        cursor: selectMode ? 'pointer' : undefined,
                      }}
                      onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = '#27272a'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? 'rgba(99,102,241,0.08)' : ''; }}
                      onClick={selectMode ? () => toggleSelect(txn.id) : undefined}
                    >
                      {selectMode && (
                        <td className="px-4 py-2 w-8" onClick={e => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selected.has(txn.id)}
                            onChange={() => toggleSelect(txn.id)}
                            className="w-4 h-4 rounded cursor-pointer"
                            style={{ accentColor: '#006FEE' }}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2 font-mono" style={{ color: '#a1a1aa' }}>{txn.date}</td>
                      <td className="px-4 py-2 font-bold" style={{ color: '#ECEDEE' }}>{txn.ticker}</td>
                      <td className="px-4 py-2 text-center">
                        {(() => {
                          const tc = TYPE_COLORS[txn.type];
                          return (
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-xs font-bold"
                              style={tc ? {
                                background: tc.background,
                                border: `1px solid ${tc.border}`,
                                color: tc.color,
                              } : undefined}
                            >
                              {txn.type}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#ECEDEE' }}>{txn.quantity}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#ECEDEE' }}>${formatCurrency(txn.price)}</td>
                      <td className="px-4 py-2 text-right font-mono" style={{ color: '#a1a1aa' }}>${formatCurrency(txn.fees)}</td>
                      <td className="px-4 py-2 text-right font-mono font-semibold" style={{ color: '#ECEDEE' }}>
                        ${formatCurrency(txn.quantity * txn.price)}
                      </td>
                      {!selectMode && (
                        <td className="px-4 py-2">
                          <button
                            onClick={() => handleDelete(txn.id)}
                            className="transition-colors"
                            style={{ color: '#a1a1aa' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#f31260'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#a1a1aa'; }}
                            title="Delete"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                            </svg>
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => selectedId && fetchTransactions(selectedId, txnPage - 1)}
            disabled={txnPage === 0}
            className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            style={{ background: '#27272a', color: '#ECEDEE' }}
          >
            Prev
          </button>
          <span className="text-sm" style={{ color: '#a1a1aa' }}>
            Page {txnPage + 1} of {totalPages}
          </span>
          <button
            onClick={() => selectedId && fetchTransactions(selectedId, txnPage + 1)}
            disabled={txnPage >= totalPages - 1}
            className="px-3 py-1.5 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
            style={{ background: '#27272a', color: '#ECEDEE' }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
