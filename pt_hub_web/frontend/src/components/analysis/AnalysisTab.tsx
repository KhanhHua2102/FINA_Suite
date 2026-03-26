import { useState, useEffect, useRef } from 'react';
import { useSettingsStore, selectTickers } from '../../store/settingsStore';
import { useAnalysisStore } from '../../store/analysisStore';
import { analysisApi } from '../../services/api';
import { AnalysisReportCard } from './AnalysisReportCard';
import { AnalysisLogStream } from './AnalysisLogStream';
import { AnalysisProgressBar } from './AnalysisProgressBar';
import { PortfolioAnalysisView } from './PortfolioAnalysisView';
import { DraggableTickerBar } from '../common/DraggableTickerBar';
import type { AnalysisReport } from '../../services/types';

type AnalysisViewMode = 'single' | 'portfolio';

export function AnalysisTab() {
  const tickers = useSettingsStore(selectTickers);
  const {
    isRunning,
    runningTicker,
    analysisLogs,
    latestReports,
    setRunning,
    clearAnalysisLogs,
    setLatestReport,
    setReportHistory,
    reportHistory,
    reportHistoryTotal,
  } = useAnalysisStore();

  const [viewMode, setViewMode] = useState<AnalysisViewMode>('single');
  const [selectedTicker, setSelectedTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const analysisStartTime = useRef<number>(0);

  // Select first ticker on load
  useEffect(() => {
    if (tickers.length > 0 && !selectedTicker) {
      setSelectedTicker(tickers[0]);
    }
  }, [tickers, selectedTicker]);

  // Load latest report when ticker changes
  useEffect(() => {
    if (!selectedTicker) return;
    let cancelled = false;

    const fetchLatest = async () => {
      try {
        const result = await analysisApi.getLatest(selectedTicker);
        if (!cancelled && result.report) {
          setLatestReport(selectedTicker, result.report);
        }
      } catch {
        // Ignore — no report yet
      }
    };

    fetchLatest();
    return () => { cancelled = true; };
  }, [selectedTicker, setLatestReport]);

  const handleRunAnalysis = async () => {
    if (isRunning || !selectedTicker) return;

    setError('');
    clearAnalysisLogs();
    setRunning(true, selectedTicker);
    setShowLogs(false);
    analysisStartTime.current = Date.now();

    try {
      await analysisApi.run(selectedTicker);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start analysis');
      setRunning(false, null);
    }
  };

  const handleLoadHistory = async () => {
    if (!selectedTicker) return;
    setLoading(true);
    try {
      const result = await analysisApi.getReports(selectedTicker, 20, 0);
      setReportHistory(result.reports, result.total);
      setShowHistory(true);
    } catch {
      // Ignore
    } finally {
      setLoading(false);
    }
  };

  const report = latestReports[selectedTicker];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* View mode toggle */}
      <div
        className="flex items-center gap-2 p-2 shrink-0"
        style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.15)' }}
      >
        <div className="flex rounded-xl p-1" style={{ background: '#27272a' }}>
          <button
            onClick={() => setViewMode('single')}
            className="px-5 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: viewMode === 'single' ? '#006FEE' : 'transparent',
              color: viewMode === 'single' ? '#ffffff' : '#a1a1aa',
            }}
          >
            Single Ticker
          </button>
          <button
            onClick={() => setViewMode('portfolio')}
            className="px-5 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: viewMode === 'portfolio' ? '#006FEE' : 'transparent',
              color: viewMode === 'portfolio' ? '#ffffff' : '#a1a1aa',
            }}
          >
            My Portfolio
          </button>
        </div>
      </div>

      {viewMode === 'portfolio' ? (
        <PortfolioAnalysisView />
      ) : (
      <>
      <DraggableTickerBar
        selectedTicker={selectedTicker}
        onSelect={(t) => { setSelectedTicker(t); setShowHistory(false); }}
      />

      {/* Main content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleRunAnalysis}
              disabled={isRunning}
              className={`btn text-sm font-medium transition-all ${
                isRunning
                  ? 'btn-secondary cursor-not-allowed'
                  : 'btn-primary'
              }`}
              style={
                isRunning
                  ? { color: '#a1a1aa' }
                  : undefined
              }
            >
              {isRunning && runningTicker === selectedTicker
                ? 'Analyzing...'
                : isRunning
                ? `Busy (${runningTicker})`
                : 'Run Analysis'}
            </button>

            {analysisLogs.length > 0 && (
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="btn btn-secondary text-sm font-medium transition-all"
                style={{ color: '#a1a1aa' }}
              >
                {showLogs ? 'Hide Logs' : 'Show Logs'}
              </button>
            )}

            {report && (
              <button
                onClick={handleLoadHistory}
                className="btn btn-secondary text-sm font-medium transition-all"
                style={{ color: '#a1a1aa' }}
              >
                {showHistory ? 'Hide History' : 'View History'}
              </button>
            )}

            {error && <span className="text-sm" style={{ color: '#f31260' }}>{error}</span>}
          </div>

          {/* Progress bar during analysis */}
          {isRunning && runningTicker === selectedTicker && (
            <AnalysisProgressBar
              ticker={selectedTicker}
              logs={analysisLogs}
              startTime={analysisStartTime.current}
            />
          )}

          {/* Streaming logs */}
          {showLogs && analysisLogs.length > 0 && (
            <AnalysisLogStream logs={analysisLogs} />
          )}

          {/* Latest Report */}
          {!showHistory && report && (
            <>
              <h2
                className="text-lg font-medium"
                style={{ color: '#ECEDEE' }}
              >
                {selectedTicker} — Latest Analysis
              </h2>
              <AnalysisReportCard report={report} />
            </>
          )}

          {/* No report state */}
          {!showHistory && !report && !isRunning && (
            <div
              className="flex items-center justify-center h-48"
              style={{ color: '#a1a1aa' }}
            >
              No analysis yet for {selectedTicker}. Click "Run Analysis" to start.
            </div>
          )}

          {/* History */}
          {showHistory && (
            <div className="space-y-4">
              <h2
                className="text-lg font-medium"
                style={{ color: '#ECEDEE' }}
              >
                {selectedTicker} — History ({reportHistoryTotal} reports)
              </h2>
              {reportHistory.map((r) => (
                <HistoryRow key={r.id} report={r} />
              ))}
              {loading && (
                <div className="text-sm" style={{ color: '#a1a1aa' }}>
                  Loading...
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}

function HistoryRow({ report }: { report: AnalysisReport }) {
  const [expanded, setExpanded] = useState(false);
  const decisionColor = {
    BUY: '#17c964',
    HOLD: '#f5a524',
    SELL: '#f31260',
  }[report.decision] ?? '#a1a1aa';

  return (
    <div
      className="rounded-xl"
      style={{ background: '#18181b', border: '1px solid #27272a' }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors rounded-xl"
        style={{ background: 'transparent' }}
        onMouseEnter={(e) => { e.currentTarget.style.background = '#27272a'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
      >
        <div className="flex items-center gap-4">
          <span className="font-bold" style={{ color: decisionColor }}>{report.decision}</span>
          <span className="text-sm font-mono" style={{ color: '#ECEDEE' }}>
            Score: {report.score}
          </span>
          <span className="text-xs" style={{ color: '#a1a1aa' }}>
            {report.conclusion.slice(0, 80)}...
          </span>
        </div>
        <span className="text-xs font-mono" style={{ color: '#a1a1aa' }}>
          {new Date(report.created_at).toLocaleString()}
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4">
          <AnalysisReportCard report={report} />
        </div>
      )}
    </div>
  );
}
