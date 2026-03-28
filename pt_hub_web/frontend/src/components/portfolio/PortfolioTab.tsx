import { useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { Select, SelectItem } from '@heroui/select';
import { useQuery } from '@tanstack/react-query';
import { usePortfolioStore } from '../../store/portfolioStore';
import { portfolioApi } from '../../services/api';
import { portfolioKeys } from '../../hooks/useTrainingData';
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
  const { portfolios, selectedId, loading, subView, setSubView, selectPortfolio, createPortfolio, deletePortfolio } = usePortfolioStore();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [createError, setCreateError] = useState('');

  // Leverages React Query cache — if bootstrap already prefetched, this is instant
  useQuery({
    queryKey: portfolioKeys.list,
    queryFn: async () => {
      const { portfolios: fetched } = await portfolioApi.listPortfolios();
      const store = usePortfolioStore.getState();
      usePortfolioStore.setState({ portfolios: fetched });
      if (store.selectedId === null && fetched.length > 0) {
        store.selectPortfolio(fetched[0].id);
      }
      return fetched;
    },
  });

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
        {loading ? (
          <div
            className="animate-spin w-4 h-4 rounded-full"
            style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }}
          />
        ) : portfolios.length === 0 ? (
          <span className="text-sm" style={{ color: '#a1a1aa' }}>No portfolios yet</span>
        ) : (
          <Select
            aria-label="Portfolio"
            items={portfolios.map(p => ({ key: String(p.id), label: `${p.name} (${p.currency})` }))}
            selectedKeys={selectedId != null ? new Set([String(selectedId)]) : new Set<string>()}
            onSelectionChange={keys => { const v = Array.from(keys)[0] as string; if (v) selectPortfolio(Number(v)); }}
            placeholder="Select portfolio..."
            variant="bordered"
            size="sm"
            classNames={{ base: 'w-52' }}
          >
            {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
          </Select>
        )}

        <Button color="primary" size="sm" radius="lg" onClick={() => setShowCreate(!showCreate)}>
          + New
        </Button>

        {selectedId && (
          <Button color="danger" size="sm" radius="lg" onClick={handleDelete}>
            Delete
          </Button>
        )}

        {/* Create Inline */}
        {showCreate && (
          <div className="flex items-center gap-2 ml-2">
            <Input
              value={newName}
              onValueChange={setNewName}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              placeholder="Portfolio name"
              variant="bordered"
              size="sm"
              autoFocus
            />
            <Button color="primary" size="sm" radius="lg" onClick={handleCreate}>
              Create
            </Button>
            <Button variant="light" size="sm" onClick={() => { setShowCreate(false); setNewName(''); setCreateError(''); }}>
              Cancel
            </Button>
            {createError && <span className="text-xs" style={{ color: '#f31260' }}>{createError}</span>}
          </div>
        )}
      </div>

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 px-4 py-2 shrink-0" style={{ background: '#18181b' }}>
        {SUB_TABS.map(tab => (
          <Button
            key={tab.key}
            variant={subView === tab.key ? 'solid' : 'light'}
            color={subView === tab.key ? 'primary' : 'default'}
            radius="full"
            size="sm"
            onClick={() => setSubView(tab.key)}
          >
            {tab.label}
          </Button>
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
