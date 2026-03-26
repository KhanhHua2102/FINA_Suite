import { useEffect, useRef } from 'react';

interface LogViewerProps {
  logs: string[];
  className?: string;
  autoScroll?: boolean;
}

export function LogViewer({ logs, className = '', autoScroll = true }: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto p-4 font-mono text-xs leading-relaxed rounded-xl ${className}`}
      style={{ background: '#18181b', border: '1px solid #27272a' }}
    >
      {logs.length === 0 ? (
        <span style={{ color: '#a1a1aa' }}>No logs yet...</span>
      ) : (
        logs.map((log, i) => (
          <div key={i} className="whitespace-pre-wrap break-all" style={{ color: '#ECEDEE', opacity: 0.75 }}>
            {log}
          </div>
        ))
      )}
    </div>
  );
}
