import { create } from 'zustand';
import { expensesApi } from '../services/api';
import type { Expense, ExpenseCategory, ExpenseStatistics, TaxSummary, TaxAnalysisResult } from '../services/types';

type SubView = 'dashboard' | 'expenses' | 'scan' | 'tax-analysis' | 'categories';

/** Compute the current Australian financial year (Jul–Jun). */
function currentTaxYear(): string {
  const now = new Date();
  const y = now.getFullYear();
  if (now.getMonth() >= 6) {
    return `${y}-${String(y + 1).slice(-2)}`;
  }
  return `${y - 1}-${String(y).slice(-2)}`;
}

interface ExpenseState {
  subView: SubView;
  setSubView: (v: SubView) => void;

  // Tax year context
  selectedTaxYear: string;
  setTaxYear: (year: string) => void;

  // Expenses list
  expenses: Expense[];
  total: number;
  page: number;
  loading: boolean;

  // Categories
  categories: ExpenseCategory[];
  categoriesLoading: boolean;

  // Statistics
  statistics: ExpenseStatistics | null;
  statsLoading: boolean;

  // Tax
  taxSummary: TaxSummary | null;
  taxAnalysis: TaxAnalysisResult | null;
  taxLoading: boolean;

  // Actions
  fetchExpenses: (params?: {
    tax_year?: string; category_id?: number; search?: string;
    is_income?: boolean; page?: number;
  }) => Promise<void>;
  fetchCategories: () => Promise<void>;
  fetchStatistics: (taxYear?: string) => Promise<void>;
  fetchTaxSummary: (taxYear?: string) => Promise<void>;
  runTaxAnalysis: (taxYear?: string) => Promise<void>;

  addExpense: (data: Partial<Expense>) => Promise<number>;
  updateExpense: (id: number, data: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: number) => Promise<void>;

  addCategory: (data: Partial<ExpenseCategory>) => Promise<number>;
  updateCategory: (id: number, data: Partial<ExpenseCategory>) => Promise<void>;
  deleteCategory: (id: number) => Promise<void>;
}

const PAGE_SIZE = 50;

export const useExpenseStore = create<ExpenseState>((set, get) => ({
  subView: 'dashboard',
  setSubView: (v) => set({ subView: v }),

  selectedTaxYear: currentTaxYear(),
  setTaxYear: (year) => set({ selectedTaxYear: year }),

  expenses: [],
  total: 0,
  page: 0,
  loading: false,

  categories: [],
  categoriesLoading: false,

  statistics: null,
  statsLoading: false,

  taxSummary: null,
  taxAnalysis: null,
  taxLoading: false,

  // ── Expenses ───────────────────────────────────────────────
  fetchExpenses: async (params) => {
    set({ loading: true });
    try {
      const page = params?.page ?? 0;
      const { expenses, total } = await expensesApi.list({
        tax_year: params?.tax_year ?? get().selectedTaxYear,
        category_id: params?.category_id,
        search: params?.search,
        is_income: params?.is_income,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      set({ expenses, total, page, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  addExpense: async (data) => {
    const { id } = await expensesApi.create(data);
    await get().fetchExpenses();
    await get().fetchStatistics();
    return id;
  },

  updateExpense: async (id, data) => {
    await expensesApi.update(id, data);
    await get().fetchExpenses();
    await get().fetchStatistics();
  },

  deleteExpense: async (id) => {
    await expensesApi.delete(id);
    await get().fetchExpenses();
    await get().fetchStatistics();
  },

  // ── Categories ─────────────────────────────────────────────
  fetchCategories: async () => {
    set({ categoriesLoading: true });
    try {
      const { categories } = await expensesApi.getCategories();
      set({ categories, categoriesLoading: false });
    } catch {
      set({ categoriesLoading: false });
    }
  },

  addCategory: async (data) => {
    const { id } = await expensesApi.createCategory(data);
    await get().fetchCategories();
    return id;
  },

  updateCategory: async (id, data) => {
    await expensesApi.updateCategory(id, data);
    await get().fetchCategories();
  },

  deleteCategory: async (id) => {
    await expensesApi.deleteCategory(id);
    await get().fetchCategories();
  },

  // ── Statistics & Tax ───────────────────────────────────────
  fetchStatistics: async (taxYear) => {
    set({ statsLoading: true });
    try {
      const stats = await expensesApi.getStatistics(taxYear ?? get().selectedTaxYear);
      set({ statistics: stats, statsLoading: false });
    } catch {
      set({ statsLoading: false });
    }
  },

  fetchTaxSummary: async (taxYear) => {
    set({ taxLoading: true });
    try {
      const summary = await expensesApi.getTaxSummary(taxYear ?? get().selectedTaxYear);
      set({ taxSummary: summary, taxLoading: false });
    } catch {
      set({ taxLoading: false });
    }
  },

  runTaxAnalysis: async (taxYear) => {
    set({ taxLoading: true });
    try {
      const result = await expensesApi.runTaxAnalysis(taxYear ?? get().selectedTaxYear);
      set({ taxAnalysis: result, taxLoading: false });
    } catch {
      set({ taxLoading: false });
    }
  },
}));
