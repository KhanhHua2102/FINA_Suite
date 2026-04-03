import { useEffect, useRef, useMemo } from 'react';

export function AnalysisLogStream({ logs }: { logs: string[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  const formattedLines = useMemo(() => {
    const raw = logs.join('');
    return raw
      .split(/(?<=\.{3})/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [logs]);

  if (formattedLines.length === 0) return null;

  return (
    <div
      className="rounded-xl"
      style={{ background: '#18181b', border: '1px solid #27272a' }}
    >
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}
      >
        <h3
          className="text-sm font-medium"
          style={{ color: '#a1a1aa' }}
        >
          Analysis Logs
        </h3>
      </div>
      <div
        ref={containerRef}
        className="p-4 max-h-[300px] overflow-auto font-mono text-xs leading-relaxed"
        style={{ color: '#a1a1aa' }}
      >
        {formattedLines.map((line, i) => (
          <div key={i} className="py-0.5">
            <span className="mr-2" style={{ color: '#27272a' }}>
              •
            </span>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
