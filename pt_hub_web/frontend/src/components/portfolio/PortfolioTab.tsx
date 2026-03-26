import { useEffect, useState } from 'react';
import { usePortfolioStore } from '../../store/portfolioStore';
import { PortfolioDashboard } from './PortfolioDashboard';
import { TransactionsView } from './TransactionsView';
import { ImportWizard } from './ImportWizard';
import { OptimizeView } from './OptimizeView';

type SubView = 'dashboard' | 'transactions' | 'import' | 'optimize';

const SUB_TABS: { key: SubView; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'import', label: 'Import' },
  { key: 'optimize', label: 'Optimize' },
];

export function PortfolioTab() {
  const { portfolios, selectedId, loading, subView, setSubView, fetchPortfolios, selectPortfolio, createPortfolio, deletePortfolio } = usePortfolioStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    fetchPortfolios();
  }, [fetchPortfolios]);

  const handleCreate = async () => {
    if (!newName.trim()) {
      setCreateError('Name is required');
      return;
    }
    setCreateError('');
    try {
      await createPortfolio(newName.trim());
      setNewName('');
      setShowCreate(false);
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create portfolio');
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    const name = portfolios.find(p => p.id === selectedId)?.name;
    if (!confirm(`Delete portfolio "${name}"? This will remove all transactions and data.`)) return;
    await deletePortfolio(selectedId);
  };

  return (
    <div className="rounded-xl flex flex-col h-full overflow-hidden" style={{ background: '#18181b' }}>
      {/* Portfolio Selector Bar */}
      <div
        className="flex items-center gap-3 px-6 py-3 shrink-0"
        style={{ background: '#18181b', borderBottom: '1px solid #27272a' }}
      >
        <label
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: '#a1a1aa' }}
        >
          Portfolio
        </label>
        {loading ? (
          <div
            className="animate-spin w-4 h-4 rounded-full"
            style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }}
          />
        ) : portfolios.length === 0 ? (
          <span className="text-sm" style={{ color: '#a1a1aa' }}>No portfolios yet</span>
        ) : (
          <select
            value={selectedId ?? ''}
            onChange={e => selectPortfolio(Number(e.target.value))}
            className="py-1.5 px-3 text-sm rounded-xl"
            style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
            onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
            onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
          >
            {portfolios.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.currency})</option>
            ))}
          </select>
        )}

        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors text-white"
          style={{ background: '#006FEE' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#338ef7'; }}
          onMouseLeave={e => { e.currentTarget.style.background = '#006FEE'; }}
        >
          + New
        </button>

        {selectedId && (
          <button
            onClick={handleDelete}
            className="px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors text-white"
            style={{ background: '#f31260' }}
            onMouseEnter={e => { e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#f31260'; }}
          >
            Delete
          </button>
        )}

        {/* Create Inline */}
        {showCreate && (
          <div className="flex items-center gap-2 ml-2">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Portfolio name"
              className="px-3 py-1.5 text-sm rounded-xl"
              style={{ background: '#27272a', border: '1px solid #27272a', color: '#ECEDEE', outline: 'none' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#006FEE'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#27272a'; }}
              autoFocus
            />
            <button
              onClick={handleCreate}
              className="px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors text-white"
              style={{ background: '#006FEE' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#338ef7'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#006FEE'; }}
            >
              Create
            </button>
            <button
              onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); }}
              className="px-2 py-1.5 text-xs transition-colors"
              style={{ color: '#a1a1aa' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#ECEDEE')}
              onMouseLeave={e => (e.currentTarget.style.color = '#a1a1aa')}
            >
              Cancel
            </button>
            {createError && <span className="text-xs" style={{ color: '#f31260' }}>{createError}</span>}
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 px-4 py-2 shrink-0" style={{ background: '#18181b' }}>
        {SUB_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setSubView(tab.key)}
            className="px-5 py-2 text-sm font-medium transition-colors rounded-full"
            style={
              subView === tab.key
                ? { background: '#006FEE', color: '#ffffff' }
                : { color: '#a1a1aa' }
            }
            onMouseEnter={e => {
              if (subView !== tab.key) {
                e.currentTarget.style.color = '#ECEDEE';
                e.currentTarget.style.background = '#27272a';
              }
            }}
            onMouseLeave={e => {
              if (subView !== tab.key) {
                e.currentTarget.style.color = '#a1a1aa';
                e.currentTarget.style.background = 'transparent';
              }
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
      <div className="p-6 max-w-7xl mx-auto w-full">
        {!selectedId && subView !== 'optimize' ? (
          <div
            className="flex flex-col items-center justify-center py-16 gap-4"
            style={{ color: '#a1a1aa' }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a4 4 0 00-8 0v2" />
            </svg>
            <p>Create a portfolio to get started</p>
          </div>
        ) : (
          <>
            {subView === 'dashboard' && <PortfolioDashboard />}
            {subView === 'transactions' && <TransactionsView />}
            {subView === 'import' && <ImportWizard />}
            {subView === 'optimize' && <OptimizeView />}
          </>
        )}
      </div>
      </div>
    </div>
  );
}
