import { useEffect, useState } from 'react';
import { Button } from '@heroui/button';
import { Input } from '@heroui/input';
import { useExpenseStore } from '../../store/expenseStore';
import { expensesApi } from '../../services/api';
import { ExpenseForm } from './ExpenseForm';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';

function fmt(cents: number): string {
  return `$${(Math.abs(cents) / 100).toLocaleString('en-AU', { minimumFractionDigits: 2 })}`;
}

export function ExpensesList() {
  const {
    expenses, total, page, loading, selectedTaxYear, setTaxYear,
    fetchExpenses, deleteExpense, categories, fetchCategories,
  } = useExpenseStore();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [previewReceiptId, setPreviewReceiptId] = useState<number | null>(null);
  const [previewDownloadName, setPreviewDownloadName] = useState('');

  // Selection mode
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    fetchExpenses({ search: search || undefined, category_id: categoryFilter, page: 0 });
  }, [selectedTaxYear, search, categoryFilter, fetchExpenses]);

  const totalPages = Math.ceil(total / 50);

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === expenses.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(expenses.map(e => e.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} expense${selected.size > 1 ? 's' : ''}?`)) return;
    setBatchLoading(true);
    try {
      await expensesApi.batchDelete(Array.from(selected));
      exitSelectMode();
      await fetchExpenses();
    } catch {
      // ignore
    } finally {
      setBatchLoading(false);
    }
  };

  const handleBatchDownload = async () => {
    const withReceipts = expenses.filter(e => selected.has(e.id) && e.receipt_id);
    if (withReceipts.length === 0) return;
    setBatchLoading(true);
    try {
      const blob = await expensesApi.batchDownloadReceipts(Array.from(selected));
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipts_${selectedTaxYear}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    } finally {
      setBatchLoading(false);
    }
  };

  const selectedWithReceipts = expenses.filter(e => selected.has(e.id) && e.receipt_id).length;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          value={search}
          onValueChange={setSearch}
          placeholder="Search expenses..."
          variant="bordered"
          size="sm"
          classNames={{ base: 'w-60' }}
        />
        <select
          value={selectedTaxYear}
          onChange={e => setTaxYear(e.target.value)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
        >
          <option value="">All Years</option>
          {generateTaxYears().map(y => (
            <option key={y} value={y}>FY {y}</option>
          ))}
        </select>
        <select
          value={categoryFilter ?? ''}
          onChange={e => setCategoryFilter(e.target.value ? Number(e.target.value) : undefined)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="flex-1" />
        {!selectMode ? (
          <>
            <Button variant="bordered" size="sm" radius="lg" onClick={() => setSelectMode(true)}>
              Select
            </Button>
            <Button color="primary" size="sm" radius="lg" onClick={() => setShowCreate(true)}>
              + Add Expense
            </Button>
          </>
        ) : (
          <>
            <span className="text-xs" style={{ color: '#a1a1aa' }}>
              {selected.size} selected
            </span>
            <Button
              color="danger"
              size="sm"
              radius="lg"
              variant="flat"
              isDisabled={selected.size === 0}
              isLoading={batchLoading}
              onClick={handleBatchDelete}
            >
              Delete
            </Button>
            <Button
              color="primary"
              size="sm"
              radius="lg"
              variant="flat"
              isDisabled={selectedWithReceipts === 0}
              isLoading={batchLoading}
              onClick={handleBatchDownload}
            >
              Download
            </Button>
            <Button variant="light" size="sm" onClick={exitSelectMode}>
              Cancel
            </Button>
          </>
        )}
      </div>

      {/* Create Form */}
      {showCreate && (
        <ExpenseForm
          categories={categories}
          onSave={() => { setShowCreate(false); fetchExpenses(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Edit Form */}
      {editingId != null && (
        <ExpenseForm
          expenseId={editingId}
          categories={categories}
          initialData={expenses.find(e => e.id === editingId)}
          onSave={() => { setEditingId(null); fetchExpenses(); }}
          onCancel={() => setEditingId(null)}
        />
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-6 h-6 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
        </div>
      ) : expenses.length === 0 ? (
        <p className="text-center py-12" style={{ color: '#71717a' }}>No expenses found</p>
      ) : (
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #27272a' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1e1e22' }}>
                {selectMode && (
                  <th className="px-3 py-2" style={{ width: '36px' }}>
                    <input
                      type="checkbox"
                      checked={selected.size === expenses.length && expenses.length > 0}
                      onChange={toggleSelectAll}
                      className="cursor-pointer"
                    />
                  </th>
                )}
                <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Date</th>
                <th className="text-center px-2 py-2 font-medium" style={{ color: '#a1a1aa', width: '36px' }}></th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Item</th>
                <th className="text-left px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Category</th>
                <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Amount</th>
                <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>GST</th>
                {!selectMode && (
                  <th className="text-right px-4 py-2 font-medium" style={{ color: '#a1a1aa' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.map(exp => (
                <tr
                  key={exp.id}
                  className={`hover:opacity-80 transition-opacity ${selectMode ? 'cursor-pointer' : ''}`}
                  style={{
                    borderTop: '1px solid #27272a',
                    background: selected.has(exp.id) ? '#006FEE10' : undefined,
                  }}
                  onClick={selectMode ? () => toggleSelect(exp.id) : undefined}
                >
                  {selectMode && (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(exp.id)}
                        onChange={() => toggleSelect(exp.id)}
                        onClick={e => e.stopPropagation()}
                        className="cursor-pointer"
                      />
                    </td>
                  )}
                  <td className="px-4 py-2 font-mono text-xs whitespace-nowrap" style={{ color: '#d4d4d8' }}>{formatDdMm(exp.date, !selectedTaxYear)}</td>
                  <td className="px-2 py-2 text-center">
                    {exp.receipt_id ? (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setPreviewReceiptId(exp.receipt_id!);
                          const name = [exp.description || exp.merchant || 'receipt', exp.date].filter(Boolean).join(' ');
                          setPreviewDownloadName(name.replace(/[/\\:*?"<>|]/g, '_'));
                        }}
                        className="hover:opacity-80 transition-opacity"
                        title="View receipt"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#006FEE" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </button>
                    ) : null}
                  </td>
                  <td className="px-4 py-2">
                    <div style={{ color: '#e4e4e7' }}>{exp.description || '—'}</div>
                    {exp.merchant && (
                      <div className="text-xs truncate max-w-[200px]" style={{ color: '#71717a' }}>{exp.merchant}</div>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    {exp.category_name ? (
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
                        style={{ background: `${exp.category_color}20`, color: exp.category_color || '#a1a1aa' }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: exp.category_color || '#6b7280' }} />
                        {exp.category_name}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: '#52525b' }}>Uncategorised</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right font-mono whitespace-nowrap" style={{ color: exp.is_income ? '#22c55e' : '#e4e4e7' }}>
                    {exp.is_income ? '+' : ''}{fmt(exp.amount_cents)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs" style={{ color: '#a1a1aa' }}>
                    {exp.gst_cents > 0 ? fmt(exp.gst_cents) : '—'}
                  </td>
                  {!selectMode && (
                    <td className="px-4 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="light"
                          onClick={() => setEditingId(exp.id)}
                          className="min-w-0 px-2"
                        >
                          Edit
                        </Button>
                        <button
                          onClick={() => {
                            if (confirm('Delete this expense?')) deleteExpense(exp.id);
                          }}
                          className="min-w-0 px-1 text-red-500 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            variant="light"
            isDisabled={page === 0}
            onClick={() => fetchExpenses({ page: page - 1 })}
          >
            Previous
          </Button>
          <span className="text-sm" style={{ color: '#a1a1aa' }}>
            Page {page + 1} of {totalPages}
          </span>
          <Button
            size="sm"
            variant="light"
            isDisabled={page >= totalPages - 1}
            onClick={() => fetchExpenses({ page: page + 1 })}
          >
            Next
          </Button>
        </div>
      )}

      {/* Receipt Preview Modal */}
      {previewReceiptId != null && (
        <ReceiptPreviewModal
          receiptId={previewReceiptId}
          downloadName={previewDownloadName}
          onClose={() => setPreviewReceiptId(null)}
        />
      )}
    </div>
  );
}

function formatDdMm(dateStr: string, showYear = false): string {
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const base = `${parts[2]}-${parts[1]}`;
    return showYear ? `${base}-${parts[0].slice(-2)}` : base;
  }
  return dateStr;
}

function generateTaxYears(): string[] {
  const now = new Date();
  const currentFY = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const years: string[] = [];
  for (let i = 0; i < 5; i++) {
    const y = currentFY - i;
    years.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return years;
}
