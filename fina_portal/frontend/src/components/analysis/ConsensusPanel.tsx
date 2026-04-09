import { useState } from 'react';
import type { MultiAgentReport } from '../../services/types';

interface ConsensusPanelProps {
  report: MultiAgentReport;
}

const ACTION_CONFIG = {
  BUY: { label: 'BUY', badgeCls: 'bg-green-500/20 text-green-400 border border-green-500/40' },
  SELL: { label: 'SELL', badgeCls: 'bg-red-500/20 text-red-400 border border-red-500/40' },
  HOLD: { label: 'HOLD', badgeCls: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' },
} as const;

function VoteBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1" style={{ color: '#a1a1aa' }}>
        <span>{label}</span>
        <span className="font-mono">
          {count} ({pct}%)
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: '#27272a' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function ConsensusPanel({ report }: ConsensusPanelProps) {
  const [showReasoning, setShowReasoning] = useState(false);
  const [showDebate, setShowDebate] = useState(false);

  const cfg = ACTION_CONFIG[report.consensus_action] ?? ACTION_CONFIG.HOLD;
  const confidencePct = Math.round(report.consensus_confidence * 100);

  const totalVotes =
    (report.agent_signals?.length ?? 0) ||
    ((report.recommendation?.agent_breakdown?.length ?? 0) > 0
      ? report.recommendation!.agent_breakdown.length
      : report.selected_agents.length);

  const bullishCount = report.agent_signals?.filter((s) => s.signal === 'bullish').length ?? 0;
  const bearishCount = report.agent_signals?.filter((s) => s.signal === 'bearish').length ?? 0;
  const neutralCount = report.agent_signals?.filter((s) => s.signal === 'neutral').length ?? 0;
  const voteTotal = bullishCount + bearishCount + neutralCount || totalVotes;

  const rec = report.recommendation;
  const riskAssessment = report.risk_assessment as Record<string, unknown> | null;

  const durationSec = report.total_duration_ms != null
    ? (report.total_duration_ms / 1000).toFixed(1)
    : null;

  return (
    <div
      className="rounded-xl border space-y-4 overflow-hidden"
      style={{ background: '#18181b', borderColor: '#27272a' }}
    >
      {/* Top banner */}
      <div className="px-5 pt-5 pb-4" style={{ borderBottom: '1px solid #27272a' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`text-2xl font-bold px-4 py-1.5 rounded-xl tracking-wide ${cfg.badgeCls}`}
            >
              {cfg.label}
            </span>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
                {report.ticker}
              </p>
              <p className="text-xs" style={{ color: '#71717a' }}>
                Consensus: {confidencePct}% confidence
              </p>
            </div>
          </div>
          {report.price_at_analysis != null && (
            <div className="text-right">
              <p className="text-xs" style={{ color: '#71717a' }}>
                Price at analysis
              </p>
              <p className="text-sm font-mono font-semibold" style={{ color: '#ECEDEE' }}>
                ${report.price_at_analysis.toFixed(2)}
              </p>
            </div>
          )}
        </div>

        {/* Confidence bar */}
        <div className="mt-3">
          <div
            className="w-full h-2.5 rounded-full overflow-hidden"
            style={{ backgroundColor: '#27272a' }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${confidencePct}%`,
                backgroundColor:
                  report.consensus_action === 'BUY'
                    ? '#22c55e'
                    : report.consensus_action === 'SELL'
                    ? '#ef4444'
                    : '#eab308',
              }}
            />
          </div>
        </div>
      </div>

      <div className="px-5 space-y-4">
        {/* Vote breakdown */}
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#71717a' }}>
            Agent Votes
          </p>
          <VoteBar label="Bullish" count={bullishCount} total={voteTotal} color="#22c55e" />
          <VoteBar label="Bearish" count={bearishCount} total={voteTotal} color="#ef4444" />
          <VoteBar label="Neutral" count={neutralCount} total={voteTotal} color="#a1a1aa" />
        </div>

        {/* Risk assessment */}
        {riskAssessment && Object.keys(riskAssessment).length > 0 && (
          <div
            className="rounded-lg p-3 space-y-1"
            style={{ background: '#09090b', border: '1px solid #27272a' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: '#71717a' }}>
              Risk Assessment
            </p>
            {Object.entries(riskAssessment).map(([key, val]) => (
              <div key={key} className="flex justify-between text-xs">
                <span className="capitalize" style={{ color: '#a1a1aa' }}>
                  {key.replace(/_/g, ' ')}
                </span>
                <span className="font-mono" style={{ color: '#ECEDEE' }}>
                  {typeof val === 'number' ? val.toFixed(2) : String(val)}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Recommendation */}
        {rec && (
          <div
            className="rounded-lg p-3 space-y-2"
            style={{ background: '#09090b', border: '1px solid #27272a' }}
          >
            <p className="text-xs font-medium uppercase tracking-wide" style={{ color: '#71717a' }}>
              Recommendation
            </p>
            <div className="flex gap-4 flex-wrap">
              {rec.suggested_allocation_pct != null && (
                <div>
                  <p className="text-xs" style={{ color: '#71717a' }}>Allocation</p>
                  <p className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
                    {rec.suggested_allocation_pct.toFixed(1)}%
                  </p>
                </div>
              )}
              {rec.suggested_amount != null && rec.suggested_amount > 0 && (
                <div>
                  <p className="text-xs" style={{ color: '#71717a' }}>Amount</p>
                  <p className="text-sm font-semibold" style={{ color: '#ECEDEE' }}>
                    ${rec.suggested_amount.toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            {rec.risk_notes && (
              <p className="text-xs leading-relaxed" style={{ color: '#a1a1aa' }}>
                {rec.risk_notes}
              </p>
            )}
          </div>
        )}

        {/* Expandable consensus reasoning */}
        {report.consensus_reasoning && (
          <div>
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="text-xs flex items-center gap-1 hover:text-primary transition-colors"
              style={{ color: '#71717a' }}
            >
              <span>{showReasoning ? '▾' : '▸'}</span>
              <span>{showReasoning ? 'Hide' : 'Show'} consensus reasoning</span>
            </button>
            {showReasoning && (
              <p
                className="mt-2 text-xs leading-relaxed rounded-lg p-3"
                style={{ color: '#a1a1aa', background: '#09090b', border: '1px solid #27272a' }}
              >
                {report.consensus_reasoning}
              </p>
            )}
          </div>
        )}

        {/* Expandable debate summary */}
        {rec?.debate_summary && (
          <div>
            <button
              onClick={() => setShowDebate((v) => !v)}
              className="text-xs flex items-center gap-1 hover:text-primary transition-colors"
              style={{ color: '#71717a' }}
            >
              <span>{showDebate ? '▾' : '▸'}</span>
              <span>{showDebate ? 'Hide' : 'Show'} debate summary</span>
            </button>
            {showDebate && (
              <p
                className="mt-2 text-xs leading-relaxed rounded-lg p-3"
                style={{ color: '#a1a1aa', background: '#09090b', border: '1px solid #27272a' }}
              >
                {rec.debate_summary}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Metadata footer */}
      <div
        className="px-5 py-3 flex flex-wrap gap-3 text-xs"
        style={{ borderTop: '1px solid #27272a', color: '#52525b' }}
      >
        <span>{report.selected_agents.length} agents</span>
        {durationSec && <span>{durationSec}s</span>}
        {report.model_used && <span>{report.model_used}</span>}
        <span>{new Date(report.created_at).toLocaleString()}</span>
      </div>
    </div>
  );
}
