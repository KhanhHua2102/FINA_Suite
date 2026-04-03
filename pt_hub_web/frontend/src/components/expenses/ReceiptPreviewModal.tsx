import { useEffect } from 'react';
import { Button } from '@heroui/button';
import { expensesApi } from '../../services/api';

interface ReceiptPreviewModalProps {
  receiptId: number;
  filename?: string;
  downloadName?: string;
  onClose: () => void;
}

export function ReceiptPreviewModal({ receiptId, filename, downloadName, onClose }: ReceiptPreviewModalProps) {
  const fileUrl = expensesApi.getReceiptFileUrl(receiptId);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isPdf = filename?.toLowerCase().endsWith('.pdf');

  const ext = filename?.split('.').pop()?.toLowerCase() || 'pdf';

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = fileUrl;
    a.download = downloadName ? `${downloadName}.${ext}` : filename || 'receipt';
    a.click();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-8"
      style={{ background: 'rgba(0,0,0,0.8)' }}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full h-full max-w-4xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 shrink-0 rounded-t-xl"
          style={{ background: '#18181b', borderBottom: '1px solid #27272a' }}
        >
          <span className="text-sm font-medium truncate" style={{ color: '#e4e4e7' }}>
            {filename || 'Receipt'}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="bordered" radius="lg" onClick={handleDownload}>
              Download
            </Button>
            <Button size="sm" variant="light" onClick={onClose} className="min-w-0 px-2">
              ×
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden rounded-b-xl" style={{ background: '#fff' }}>
          {isPdf ? (
            <iframe
              src={fileUrl}
              className="w-full h-full"
              style={{ border: 'none' }}
              title="Receipt PDF"
            />
          ) : (
            <div className="w-full h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt="Receipt"
                className="max-w-full max-h-full object-contain"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
