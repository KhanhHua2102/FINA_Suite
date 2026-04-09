import { useEffect, useRef } from 'react';
import { useMultiAgentStore } from '../../store/multiAgentStore';

export function MultiAgentLogStream() {
  const logs = useMultiAgentStore((s) => s.logs);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs]);

  if (logs.length === 0) return null;

  return (
    <div
      className="rounded-xl"
      style={{ background: '#18181b', border: '1px solid #27272a' }}
    >
      <div
        className="px-4 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
      >
        <h3 className="text-sm font-medium" style={{ color: '#a1a1aa' }}>
          Agent Logs
        </h3>
      </div>
      <div
        ref={containerRef}
        className="px-4 py-3 max-h-60 overflow-y-auto font-mono text-xs leading-relaxed space-y-0.5"
        style={{ color: '#a1a1aa' }}
      >
        {logs.map((line, i) => (
          <div key={i} className="flex gap-2">
            <span style={{ color: '#3f3f46' }}>•</span>
            <span>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
