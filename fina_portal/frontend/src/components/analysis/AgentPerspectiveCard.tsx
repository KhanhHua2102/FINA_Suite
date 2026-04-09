import { useState } from 'react';
import type { AgentSignalResult } from '../../services/types';

interface AgentPerspectiveCardProps {
  signal: AgentSignalResult;
}

const SIGNAL_CONFIG = {
  bullish: { label: 'Bullish', badgeCls: 'bg-green-100 text-green-700', barCls: 'bg-green-500' },
  bearish: { label: 'Bearish', badgeCls: 'bg-red-100 text-red-700', barCls: 'bg-red-500' },
  neutral: { label: 'Neutral', badgeCls: 'bg-gray-100 text-gray-600', barCls: 'bg-gray-400' },
} as const;

const CATEGORY_COLORS: Record<string, string> = {
  value: 'bg-blue-100 text-blue-800',
  growth: 'bg-green-100 text-green-800',
  contrarian: 'bg-orange-100 text-orange-800',
  specialist: 'bg-purple-100 text-purple-800',
  technical: 'bg-cyan-100 text-cyan-800',
  analysis: 'bg-gray-100 text-gray-800',
};

export function AgentPerspectiveCard({ signal }: AgentPerspectiveCardProps) {
  const [expanded, setExpanded] = useState(false);

  const cfg = SIGNAL_CONFIG[signal.signal] ?? SIGNAL_CONFIG.neutral;
  const confidencePct = Math.round(signal.confidence * 100);
  const topFactors = signal.key_factors.slice(0, 4);
  const catColor = CATEGORY_COLORS[signal.category] ?? 'bg-gray-100 text-gray-800';

  return (
    <div
      className="rounded-xl p-4 border border-default-200 space-y-3"
      style={{ background: '#18181b', borderColor: '#27272a' }}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
            {signal.agent_name}
          </p>
          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${catColor}`}
            >
              {signal.category}
            </span>
            <span className="text-xs" style={{ color: '#71717a' }}>
              {signal.ticker}
            </span>
          </div>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${cfg.badgeCls}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Confidence bar */}
      <div>
        <div className="flex justify-between text-xs mb-1" style={{ color: '#a1a1aa' }}>
          <span>Confidence</span>
          <span className="font-mono">{confidencePct}%</span>
        </div>
        <div
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: '#27272a' }}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${cfg.barCls}`}
            style={{ width: `${confidencePct}%` }}
          />
        </div>
      </div>

      {/* Key factors */}
      {topFactors.length > 0 && (
        <ul className="space-y-1">
          {topFactors.map((factor, i) => (
            <li key={i} className="flex gap-2 text-xs" style={{ color: '#a1a1aa' }}>
              <span style={{ color: '#3f3f46' }}>•</span>
              <span>{factor}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Expandable reasoning */}
      {signal.reasoning && (
        <div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-xs flex items-center gap-1 transition-colors hover:text-primary"
            style={{ color: '#71717a' }}
          >
            <span>{expanded ? '▾' : '▸'}</span>
            <span>{expanded ? 'Hide' : 'Show'} reasoning</span>
          </button>
          {expanded && (
            <p
              className="mt-2 text-xs leading-relaxed rounded-lg p-3"
              style={{ color: '#a1a1aa', background: '#09090b', border: '1px solid #27272a' }}
            >
              {signal.reasoning}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
