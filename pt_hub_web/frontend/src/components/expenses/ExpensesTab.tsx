import { useEffect, useState, useCallback } from 'react';
import { Button } from '@heroui/button';
import { useExpenseStore } from '../../store/expenseStore';
import { ExpenseDashboard } from './ExpenseDashboard';
import { ExpensesList } from './ExpensesList';
import { ReceiptScanner } from './ReceiptScanner';
import { TaxAnalysisView } from './TaxAnalysisView';
import { CategoriesManager } from './CategoriesManager';

type SubView = 'dashboard' | 'expenses' | 'scan' | 'tax-analysis' | 'categories';

const SUB_TABS: { key: SubView; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'expenses', label: 'Expenses' },
  { key: 'tax-analysis', label: 'Tax Analysis' },
  { key: 'categories', label: 'Categories' },
];

const SUPPORTED_EXTENSIONS = /\.(jpe?g|png|webp|gif|pdf)$/i;

export function ExpensesTab() {
  const { subView, setSubView, fetchCategories, fetchStatistics } = useExpenseStore();
  const [dragging, setDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState<File[]>([]);

  useEffect(() => {
    fetchCategories();
    fetchStatistics();
  }, [fetchCategories, fetchStatistics]);

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

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const dataItems = Array.from(e.dataTransfer.items);
    const entries = dataItems
      .map(item => item.webkitGetAsEntry?.())
      .filter((entry): entry is FileSystemEntry => entry != null);

    let files: File[];
    if (entries.length > 0) {
      files = (await Promise.all(entries.map(collectFilesFromEntry))).flat();
    } else {
      files = Array.from(e.dataTransfer.files).filter(f => SUPPORTED_EXTENSIONS.test(f.name));
    }

    if (files.length > 0) {
      setDroppedFiles(files);
      setSubView('scan');
    }
  }, [setSubView]);

  // Clear dropped files after scanner picks them up
  const clearDroppedFiles = useCallback(() => setDroppedFiles([]), []);

  return (
    <div
      className="rounded-xl flex flex-col h-full overflow-hidden relative"
      style={{ background: '#18181b' }}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={e => {
        // Only set false if leaving the container
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {dragging && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center rounded-xl"
          style={{ background: 'rgba(0, 111, 238, 0.08)', border: '2px dashed #006FEE' }}
          onDragOver={e => e.preventDefault()}
        >
          <div className="text-center">
            <svg className="mx-auto mb-2" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#006FEE" strokeWidth="1.5" strokeLinecap="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <p className="text-sm font-medium" style={{ color: '#006FEE' }}>Drop receipts to scan</p>
            <p className="text-xs mt-1" style={{ color: '#71717a' }}>Files &amp; folders supported</p>
          </div>
        </div>
      )}

      {/* Sub-Tab Navigation */}
      <div className="flex gap-1 px-4 py-2 shrink-0" style={{ background: '#18181b', borderBottom: '1px solid #27272a' }}>
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
          {subView === 'dashboard' && <ExpenseDashboard />}
          {subView === 'expenses' && <ExpensesList />}
          {subView === 'scan' && <ReceiptScanner initialFiles={droppedFiles} onFilesConsumed={clearDroppedFiles} />}
          {subView === 'tax-analysis' && <TaxAnalysisView />}
          {subView === 'categories' && <CategoriesManager />}
        </div>
      </div>
    </div>
  );
}
