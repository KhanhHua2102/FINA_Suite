import { useState, useCallback, useEffect } from 'react';
import { Button } from '@heroui/button';
import { expensesApi } from '../../services/api';
import { useExpenseStore } from '../../store/expenseStore';
import { ReceiptPreviewModal } from './ReceiptPreviewModal';
import type { ReceiptExtraction, ExpenseCategory } from '../../services/types';

interface DuplicateMatch {
  id: number;
  date: string;
  merchant: string | null;
  description: string | null;
  amount_cents: number;
  gst_cents: number;
  category_name?: string | null;
}

interface ScannedItem {
  file: File;
  receiptId: number | null;
  extraction: ReceiptExtraction | null;
  error: string | null;
  status: 'pending' | 'uploading' | 'done' | 'error' | 'saved';
  // Editable fields
  merchant: string;
  date: string;
  amount: string;
  gst: string;
  description: string;
  categoryId: string;
  taxDeductible: boolean;
  // Duplicate detection
  duplicates: DuplicateMatch[];
  duplicateConfirmed: boolean;
}

function matchCategory(code: string | undefined, cats: ExpenseCategory[]): { id: string; taxDed: boolean } {
  if (!code) return { id: '', taxDed: false };
  const match = cats.find(c => c.code === code);
  return match ? { id: String(match.id), taxDed: !!match.tax_deductible } : { id: '', taxDed: false };
}

interface ReceiptScannerProps {
  initialFiles?: File[];
  onFilesConsumed?: () => void;
}

export function ReceiptScanner({ initialFiles, onFilesConsumed }: ReceiptScannerProps) {
  const { categories, addExpense, setSubView, fetchCategories, fetchExpenses } = useExpenseStore();

  useEffect(() => {
    if (categories.length === 0) fetchCategories();
  }, [categories.length, fetchCategories]);

  const [items, setItems] = useState<ScannedItem[]>([]);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [consumedInitial, setConsumedInitial] = useState(false);
  const [previewReceiptId, setPreviewReceiptId] = useState<number | null>(null);
  const [previewFilename, setPreviewFilename] = useState('');
  const [previewDownloadName, setPreviewDownloadName] = useState('');

  const processFiles = useCallback(async (files: File[]) => {
    // Ensure categories are loaded
    let cats = useExpenseStore.getState().categories;
    if (cats.length === 0) {
      await fetchCategories();
      cats = useExpenseStore.getState().categories;
    }

    // Create pending items
    const newItems: ScannedItem[] = files.map(file => ({
      file,
      receiptId: null,
      extraction: null,
      error: null,
      status: 'pending' as const,
      merchant: '',
      date: '',
      amount: '',
      gst: '',
      description: '',
      categoryId: '',
      duplicates: [],
      duplicateConfirmed: false,
      taxDeductible: false,
    }));

    setItems(prev => [...prev, ...newItems]);
    setProcessing(true);

    // Process each file sequentially
    for (let i = 0; i < newItems.length; i++) {
      const idx = items.length + i; // position in the full list

      setItems(prev => prev.map((item, j) =>
        j === idx ? { ...item, status: 'uploading' } : item
      ));

      try {
        const result = await expensesApi.uploadReceipt(newItems[i].file);
        const ext = result.extraction;
        const catMatch = matchCategory(ext?.category_suggestion, cats);

        // Check for duplicates immediately after extraction
        let dupes: DuplicateMatch[] = [];
        if (ext?.date && ext?.amount) {
          try {
            const amountCents = Math.round(ext.amount * 100);
            const gstCents = Math.round((ext.gst || 0) * 100);
            const { duplicates } = await expensesApi.checkDuplicates(ext.date, amountCents, gstCents);
            dupes = duplicates;
          } catch {
            // ignore check failure
          }
        }

        setItems(prev => prev.map((item, j) =>
          j === idx ? {
            ...item,
            receiptId: result.receipt_id,
            extraction: ext,
            error: result.error || null,
            status: ext ? 'done' : 'error',
            merchant: ext?.merchant || '',
            date: ext?.date || new Date().toISOString().slice(0, 10),
            amount: String(ext?.amount || 0),
            gst: String(ext?.gst || 0),
            description: ext?.description || '',
            categoryId: catMatch.id,
            taxDeductible: catMatch.taxDed,
            duplicates: dupes,
          } : item
        ));
      } catch (e) {
        setItems(prev => prev.map((item, j) =>
          j === idx ? {
            ...item,
            status: 'error',
            error: e instanceof Error ? e.message : 'Upload failed',
          } : item
        ));
      }
    }

    setProcessing(false);
  }, [items.length, fetchCategories]);

  // Process files dropped from parent ExpensesTab
  useEffect(() => {
    if (initialFiles && initialFiles.length > 0 && !consumedInitial) {
      setConsumedInitial(true);
      processFiles(initialFiles);
      onFilesConsumed?.();
    }
  }, [initialFiles, consumedInitial, processFiles, onFilesConsumed]);

  const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|pdf)$/i;

  const collectFilesFromEntry = async (entry: FileSystemEntry): Promise<File[]> => {
    if (entry.isFile) {
      return new Promise(resolve => {
        (entry as FileSystemFileEntry).file(f => {
          resolve(SUPPORTED_EXTENSIONS.test(f.name) ? [f] : []);
        }, () => resolve([]));
      });
    }
    if (entry.isDirectory) {
      const reader = (entry as FileSystemDirectoryEntry).createReader();
      const entries = await new Promise<FileSystemEntry[]>((resolve) => {
        reader.readEntries(resolve, () => resolve([]));
      });
      const nested = await Promise.all(entries.map(e => collectFilesFromEntry(e)));
      return nested.flat();
    }
    return [];
  };

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const dataItems = Array.from(e.dataTransfer.items);
    const entries = dataItems
      .map(item => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null);

    if (entries.length > 0) {
      // Has entries — could be folders or files
      const allFiles = (await Promise.all(entries.map(collectFilesFromEntry))).flat();
      if (allFiles.length > 0) processFiles(allFiles);
    } else {
      // Fallback for browsers without webkitGetAsEntry
      const files = Array.from(e.dataTransfer.files).filter(f => SUPPORTED_EXTENSIONS.test(f.name));
      if (files.length > 0) processFiles(files);
    }
  }, [processFiles]);

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => SUPPORTED_EXTENSIONS.test(f.name));
    if (files.length > 0) processFiles(files);
    e.target.value = '';
  }, [processFiles]);

  const updateItem = (idx: number, updates: Partial<ScannedItem>) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...updates } : item));
  };

  const handleCategoryChange = (idx: number, val: string) => {
    const cat = categories.find(c => c.id === Number(val));
    updateItem(idx, {
      categoryId: val,
      taxDeductible: cat ? !!cat.tax_deductible : false,
    });
  };

  const handleSave = async (idx: number, force = false) => {
    const item = items[idx];
    const amountNum = parseFloat(item.amount);
    if (!item.date || isNaN(amountNum) || amountNum <= 0) return;

    const amountCents = Math.round(amountNum * 100);
    const gstCents = Math.round((parseFloat(item.gst) || 0) * 100);

    // Check for duplicates unless already confirmed
    if (!force && !item.duplicateConfirmed) {
      try {
        const { duplicates } = await expensesApi.checkDuplicates(item.date, amountCents, gstCents);
        if (duplicates.length > 0) {
          updateItem(idx, { duplicates, duplicateConfirmed: false });
          return; // Don't save — show warning instead
        }
      } catch {
        // If check fails, proceed with save
      }
    }

    try {
      await addExpense({
        date: item.date,
        merchant: item.merchant || null,
        description: item.description || null,
        amount_cents: amountCents,
        gst_cents: gstCents,
        category_id: item.categoryId ? Number(item.categoryId) : null,
        is_income: false,
        tax_deductible: item.taxDeductible,
        deduction_pct: 100,
        receipt_id: item.receiptId,
      });
      updateItem(idx, { status: 'saved', duplicates: [], duplicateConfirmed: false });
    } catch {
      // keep as done so user can retry
    }
  };

  const handleSaveAll = async () => {
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done') await handleSave(i);
    }
    // Go to expenses list after saving all
    const allSaved = items.every(it => it.status === 'saved' || it.status === 'error');
    if (allSaved) {
      await fetchExpenses();
      setSubView('expenses');
    }
  };

  const removeItem = (idx: number) => {
    setItems(prev => prev.filter((_, i) => i !== idx));
  };

  const doneCount = items.filter(i => i.status === 'done').length;
  const savedCount = items.filter(i => i.status === 'saved').length;

  return (
    <div className="space-y-6">
      {/* Upload Area — always visible */}
      <div
        className="relative rounded-xl p-8 text-center cursor-pointer transition-colors"
        style={{
          background: dragging ? '#27272a' : '#1e1e22',
          border: `2px dashed ${dragging ? '#006FEE' : '#3f3f46'}`,
        }}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => document.getElementById('receipt-input')?.click()}
      >
        <input
          id="receipt-input"
          type="file"
          accept="image/*,application/pdf"
          multiple
          onChange={onFileSelect}
          className="hidden"
        />
        {/* Hidden folder input */}
        <input
          id="receipt-folder-input"
          type="file"
          // @ts-expect-error webkitdirectory is not in React types
          webkitdirectory=""
          onChange={onFileSelect}
          className="hidden"
        />
        <div className="space-y-2">
          <svg className="mx-auto" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1" strokeLinecap="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <p className="text-sm" style={{ color: '#a1a1aa' }}>
            Drag & drop receipts or folders here, or click to browse
          </p>
          <p className="text-xs" style={{ color: '#52525b' }}>
            Supports multiple files &amp; folders — JPEG, PNG, WebP, PDF (max 20 MB each)
          </p>
          <button
            className="mt-2 text-xs px-3 py-1 rounded-lg"
            style={{ background: '#27272a', color: '#a1a1aa', border: '1px solid #3f3f46' }}
            onClick={(e) => {
              e.stopPropagation();
              document.getElementById('receipt-folder-input')?.click();
            }}
          >
            Upload Folder
          </button>
        </div>
      </div>

      {/* Progress bar when processing */}
      {processing && (
        <div className="flex items-center gap-3">
          <div className="animate-spin w-4 h-4 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
          <span className="text-sm" style={{ color: '#a1a1aa' }}>
            Processing {items.filter(i => i.status === 'uploading').length > 0 ? 'receipt' : 'done'}...
            {' '}{items.filter(i => i.status !== 'pending').length}/{items.length}
          </span>
        </div>
      )}

      {/* Bulk actions */}
      {doneCount > 0 && (
        <div className="flex items-center gap-3">
          <Button color="primary" size="sm" radius="lg" onClick={handleSaveAll}>
            Save All ({doneCount})
          </Button>
          <span className="text-xs" style={{ color: '#71717a' }}>
            {savedCount > 0 && `${savedCount} saved`}
            {items.filter(i => i.status === 'error').length > 0 &&
              ` · ${items.filter(i => i.status === 'error').length} failed`}
          </span>
        </div>
      )}

      {/* Scanned items list */}
      {items.map((item, idx) => (
        <div
          key={idx}
          className="rounded-xl p-4 space-y-3"
          style={{
            background: '#1e1e22',
            border: `1px solid ${item.status === 'saved' ? '#22c55e40' : item.status === 'error' ? '#f3126040' : '#27272a'}`,
            opacity: item.status === 'saved' ? 0.6 : 1,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {item.status === 'uploading' && (
                <div className="animate-spin w-4 h-4 rounded-full" style={{ border: '2px solid #006FEE', borderTopColor: 'transparent' }} />
              )}
              {item.status === 'saved' && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#22c55e20', color: '#22c55e' }}>Saved</span>
              )}
              {item.status === 'error' && (
                <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#f3126020', color: '#f31260' }}>Error</span>
              )}
              <span className="text-sm truncate max-w-[300px]" style={{ color: '#e4e4e7' }}>
                {item.file.name}
              </span>
              <span className="text-xs" style={{ color: '#52525b' }}>
                {(item.file.size / 1024).toFixed(0)} KB
              </span>
            </div>
            <Button size="sm" variant="light" onClick={() => removeItem(idx)} className="min-w-0 px-2">
              ×
            </Button>
          </div>

          {/* Error message */}
          {item.error && (
            <p className="text-xs" style={{ color: '#f31260' }}>{item.error}</p>
          )}

          {/* Editable fields — only when done */}
          {item.status === 'done' && (
            <>
              <div className="flex gap-4">
                {/* Thumbnail — click to preview */}
                {item.receiptId && (
                  <img
                    src={expensesApi.getReceiptThumbnailUrl(item.receiptId)}
                    alt="Receipt"
                    className="w-20 h-20 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ border: '1px solid #27272a' }}
                    title="Click to preview"
                    onClick={() => {
                      setPreviewReceiptId(item.receiptId);
                      setPreviewFilename(item.file.name);
                      const name = [item.description || item.merchant || 'receipt', item.date].filter(Boolean).join(' ');
                      setPreviewDownloadName(name.replace(/[/\\:*?"<>|]/g, '_'));
                    }}
                  />
                )}

                {/* Fields */}
                <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>Date</label>
                    <input
                      type="date"
                      value={item.date}
                      onChange={e => updateItem(idx, { date: e.target.value })}
                      className="w-full px-2 py-1 rounded-lg text-sm"
                      style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>Merchant</label>
                    <input
                      value={item.merchant}
                      onChange={e => updateItem(idx, { merchant: e.target.value })}
                      className="w-full px-2 py-1 rounded-lg text-sm"
                      style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>Amount ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.amount}
                      onChange={e => updateItem(idx, { amount: e.target.value })}
                      className="w-full px-2 py-1 rounded-lg text-sm"
                      style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                    />
                  </div>
                  <div>
                    <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>GST ($)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={item.gst}
                      onChange={e => updateItem(idx, { gst: e.target.value })}
                      className="w-full px-2 py-1 rounded-lg text-sm"
                      style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>Category</label>
                  <select
                    value={item.categoryId}
                    onChange={e => handleCategoryChange(idx, e.target.value)}
                    className="w-full px-2 py-1 rounded-lg text-sm"
                    style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                  >
                    <option value="">Uncategorised</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs mb-0.5 block" style={{ color: '#71717a' }}>Description</label>
                  <input
                    value={item.description}
                    onChange={e => updateItem(idx, { description: e.target.value })}
                    className="w-full px-2 py-1 rounded-lg text-sm"
                    style={{ background: '#27272a', color: '#e4e4e7', border: '1px solid #3f3f46' }}
                  />
                </div>
                <div className="flex items-end">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.taxDeductible}
                      onChange={e => updateItem(idx, { taxDeductible: e.target.checked })}
                    />
                    <span className="text-xs" style={{ color: '#a1a1aa' }}>Tax Deductible</span>
                  </label>
                </div>
                <div className="flex items-end">
                  <Button color="primary" size="sm" radius="lg" onClick={() => handleSave(idx)}>
                    Save
                  </Button>
                </div>
              </div>

              {/* Duplicate warning */}
              {item.duplicates.length > 0 && !item.duplicateConfirmed && (
                <div className="rounded-lg p-3 space-y-2" style={{ background: '#f59e0b10', border: '1px solid #f59e0b40' }}>
                  <p className="text-sm font-medium" style={{ color: '#f59e0b' }}>
                    Possible duplicate — {item.duplicates.length} existing expense{item.duplicates.length > 1 ? 's' : ''} match this date, amount, and GST:
                  </p>
                  {item.duplicates.map(d => (
                    <div key={d.id} className="flex items-center gap-3 text-xs" style={{ color: '#d4d4d8' }}>
                      <span className="font-mono">{d.date}</span>
                      <span>{d.description || d.merchant || '—'}</span>
                      <span className="font-mono">${(d.amount_cents / 100).toFixed(2)}</span>
                      {d.category_name && <span style={{ color: '#71717a' }}>{d.category_name}</span>}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Button
                      color="warning"
                      size="sm"
                      radius="lg"
                      variant="flat"
                      onClick={() => {
                        updateItem(idx, { duplicateConfirmed: true });
                        handleSave(idx, true);
                      }}
                    >
                      Save Anyway
                    </Button>
                    <Button
                      size="sm"
                      variant="light"
                      onClick={() => updateItem(idx, { duplicates: [] })}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      ))}

      {/* Preview Modal */}
      {previewReceiptId != null && (
        <ReceiptPreviewModal
          receiptId={previewReceiptId}
          filename={previewFilename}
          downloadName={previewDownloadName}
          onClose={() => setPreviewReceiptId(null)}
        />
      )}
    </div>
  );
}
