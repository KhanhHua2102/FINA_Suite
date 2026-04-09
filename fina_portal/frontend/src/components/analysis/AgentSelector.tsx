import { useState, useEffect, useMemo } from 'react';
import { Button } from '@heroui/button';
import { Checkbox } from '@heroui/checkbox';
import { Input } from '@heroui/input';
import { useMultiAgentStore } from '../../store/multiAgentStore';
import { agentsApi } from '../../services/api';
import type { AgentInfo } from '../../services/types';

interface AgentSelectorProps {
  tickers: string;
  onTickersChange: (val: string) => void;
  enableRiskReasoning: boolean;
  onRiskReasoningChange: (val: boolean) => void;
  onRun: () => void;
  isRunning: boolean;
}

const CATEGORIES = ['all', 'value', 'growth', 'contrarian', 'specialist', 'technical', 'analysis'];

const CATEGORY_COLORS: Record<string, string> = {
  value: 'bg-blue-100 text-blue-800',
  growth: 'bg-green-100 text-green-800',
  contrarian: 'bg-orange-100 text-orange-800',
  specialist: 'bg-purple-100 text-purple-800',
  technical: 'bg-cyan-100 text-cyan-800',
  analysis: 'bg-gray-100 text-gray-800',
};

export function AgentSelector({
  tickers,
  onTickersChange,
  enableRiskReasoning,
  onRiskReasoningChange,
  onRun,
  isRunning,
}: AgentSelectorProps) {
  const { availableAgents, selectedAgentIds, setAvailableAgents, toggleAgent, selectAll, deselectAll } =
    useMultiAgentStore();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    agentsApi
      .list()
      .then(({ agents }) => setAvailableAgents(agents))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [setAvailableAgents]);

  const filteredAgents = useMemo<AgentInfo[]>(() => {
    if (activeCategory === 'all') return availableAgents;
    return availableAgents.filter((a) => a.category === activeCategory);
  }, [availableAgents, activeCategory]);

  const tickerList = tickers
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const estimatedLlmCalls = tickerList.length * selectedAgentIds.length + (enableRiskReasoning ? tickerList.length : 0);

  const canRun = tickerList.length > 0 && selectedAgentIds.length > 0 && !isRunning;

  return (
    <div className="space-y-4">
      {/* Ticker input */}
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <Input
            label="Tickers (comma-separated)"
            placeholder="e.g. AAPL, MSFT, GOOGL"
            value={tickers}
            onValueChange={onTickersChange}
            size="sm"
          />
        </div>
        <div className="flex items-center gap-2 pb-1">
          <Checkbox
            isSelected={enableRiskReasoning}
            onValueChange={onRiskReasoningChange}
            size="sm"
          >
            <span className="text-sm">Risk reasoning</span>
          </Checkbox>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex flex-wrap gap-1">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors ${
              activeCategory === cat
                ? 'bg-primary text-white'
                : 'bg-default-100 text-default-600 hover:bg-default-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Select All / Clear */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button size="sm" variant="flat" onPress={selectAll} isDisabled={isRunning}>
            Select All
          </Button>
          <Button size="sm" variant="flat" color="default" onPress={deselectAll} isDisabled={isRunning}>
            Clear
          </Button>
        </div>
        <span className="text-xs text-default-400">
          {selectedAgentIds.length} / {availableAgents.length} selected
        </span>
      </div>

      {/* Agent grid */}
      {loading ? (
        <div className="text-center text-sm text-default-400 py-8">Loading agents...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
          {filteredAgents.map((agent) => {
            const isSelected = selectedAgentIds.includes(agent.id);
            return (
              <div
                key={agent.id}
                onClick={() => !isRunning && toggleAgent(agent.id)}
                className={`rounded-xl p-3 border cursor-pointer transition-all select-none ${
                  isSelected
                    ? 'border-primary bg-primary/5'
                    : 'border-default-200 bg-default-50 hover:border-default-400'
                } ${isRunning ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-start gap-2">
                  <Checkbox
                    isSelected={isSelected}
                    onValueChange={() => !isRunning && toggleAgent(agent.id)}
                    size="sm"
                    className="mt-0.5 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-lg leading-none">{agent.icon}</span>
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                    </div>
                    <p className="text-xs text-default-400 mt-0.5 line-clamp-2">{agent.description}</p>
                    <span
                      className={`inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium capitalize ${
                        CATEGORY_COLORS[agent.category] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {agent.category}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredAgents.length === 0 && (
            <div className="col-span-full text-center text-sm text-default-400 py-6">
              No agents in this category
            </div>
          )}
        </div>
      )}

      {/* Run button */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-default-400">
          Estimated LLM calls: <strong>{estimatedLlmCalls}</strong>
        </span>
        <Button
          color="primary"
          onPress={onRun}
          isDisabled={!canRun}
          isLoading={isRunning}
          size="sm"
        >
          {isRunning ? 'Running...' : 'Run Analysis'}
        </Button>
      </div>
    </div>
  );
}
