import { create } from 'zustand';
import { QueryClient } from '@tanstack/react-query';
import { portfolioApi } from '../services/api';
import type {
  Portfolio,
  Transaction,
} from '../services/types';

// Shared query client reference — set from main.tsx provider
let _queryClient: QueryClient | null = null;
export function setPortfolioQueryClient(qc: QueryClient) { _queryClient = qc; }

function invalidateDashboard(portfolioId: number) {
  _queryClient?.invalidateQueries({ queryKey: ['portfolio-dashboard', portfolioId] });
}

export function getDashboardFromCache(portfolioId: number) {
  return _queryClient?.getQueryData<import('../hooks/usePortfolioDashboard').DashboardData>(
    ['portfolio-dashboard', portfolioId],
  ) ?? null;
}

type SubView = 'dashboard' | 'transactions' | 'import' | 'optimize';

interface PortfolioState {
  // Navigation
  subView: SubView;
  setSubView: (v: SubView) => void;

  // Portfolio list
  portfolios: Portfolio[];
  selectedId: number | null;
  loading: boolean;

  // Transactions
  transactions: Transaction[];
  txnTotal: number;
  txnPage: number;
  txnLoading: boolean;

  // Actions
  fetchPortfolios: () => Promise<void>;
  selectPortfolio: (id: number | null) => void;
  createPortfolio: (name: string, currency?: string, benchmark?: string) => Promise<number>;
  deletePortfolio: (id: number) => Promise<void>;
  fetchTransactions: (id: number, page?: number) => Promise<void>;
  addTransaction: (portfolioId: number, txn: {
    ticker: string; type: string; date: string; quantity: number; price?: number; fees?: number; notes?: string;
  }) => Promise<void>;
  deleteTransaction: (portfolioId: number, txnId: number) => Promise<void>;
  batchDeleteTransactions: (portfolioId: number, ids: number[]) => Promise<void>;
  rebuildSnapshots: (portfolioId: number) => Promise<void>;
  changeBenchmark: (portfolioId: number, benchmark: string) => Promise<void>;
}

const PAGE_SIZE = 50;

export const usePortfolioStore = create<PortfolioState>((set, get) => ({
  subView: 'dashboard',
  setSubView: (v) => set({ subView: v }),

  portfolios: [],
  selectedId: null,
  loading: false,

  transactions: [],
  txnTotal: 0,
  txnPage: 0,
  txnLoading: false,

  fetchPortfolios: async () => {
    set({ loading: true });
    try {
      const { portfolios } = await portfolioApi.listPortfolios();
      set({ portfolios });
      // Auto-select first if none selected
      const { selectedId } = get();
      if (selectedId === null && portfolios.length > 0) {
        get().selectPortfolio(portfolios[0].id);
      }
    } finally {
      set({ loading: false });
    }
  },

  selectPortfolio: (id) => {
    set({ selectedId: id, transactions: [], txnTotal: 0, txnPage: 0 });
  },

  createPortfolio: async (name, currency, benchmark) => {
    const result = await portfolioApi.createPortfolio(name, currency, benchmark);
    await get().fetchPortfolios();
    get().selectPortfolio(result.id);
    return result.id;
  },

  deletePortfolio: async (id) => {
    await portfolioApi.deletePortfolio(id);
    const { selectedId } = get();
    await get().fetchPortfolios();
    if (selectedId === id) {
      const { portfolios } = get();
      set({ selectedId: portfolios.length > 0 ? portfolios[0].id : null });
    }
  },

  fetchTransactions: async (id, page = 0) => {
    set({ txnLoading: true });
    try {
      const { transactions, total } = await portfolioApi.listTransactions(id, undefined, PAGE_SIZE, page * PAGE_SIZE);
      set({ transactions, txnTotal: total, txnPage: page });
    } finally {
      set({ txnLoading: false });
    }
  },

  addTransaction: async (portfolioId, txn) => {
    await portfolioApi.addTransaction(portfolioId, txn);
    await get().fetchTransactions(portfolioId, 0);
    invalidateDashboard(portfolioId);
  },

  deleteTransaction: async (portfolioId, txnId) => {
    await portfolioApi.deleteTransaction(portfolioId, txnId);
    const { txnPage } = get();
    await get().fetchTransactions(portfolioId, txnPage);
    invalidateDashboard(portfolioId);
  },

  batchDeleteTransactions: async (portfolioId, ids) => {
    await portfolioApi.batchDeleteTransactions(portfolioId, ids);
    const { txnPage } = get();
    await get().fetchTransactions(portfolioId, txnPage);
    invalidateDashboard(portfolioId);
  },

  rebuildSnapshots: async (portfolioId) => {
    await portfolioApi.rebuildSnapshots(portfolioId);
    invalidateDashboard(portfolioId);
  },

  changeBenchmark: async (portfolioId, benchmark) => {
    await portfolioApi.updatePortfolio(portfolioId, { benchmark });
    set(state => ({
      portfolios: state.portfolios.map(p =>
        p.id === portfolioId ? { ...p, benchmark } : p
      ),
    }));
    invalidateDashboard(portfolioId);
  },
}));
