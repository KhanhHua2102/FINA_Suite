import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart, IChartApi, ISeriesApi, LineData, Time, LineStyle } from 'lightweight-charts';
import { usePortfolioStore } from '../../store/portfolioStore';
import { usePortfolioDashboard } from '../../hooks/usePortfolioDashboard';
import { CandleLoader } from '../common/CandleLoader';

const BENCHMARK_OPTIONS: { ticker: string; label: string }[] = [
  { ticker: 'URTH', label: 'URTH -- MSCI World' },
  { ticker: '^GSPC', label: 'S&P 500' },
  { ticker: 'BGBL.AX', label: 'BGBL.AX -- BetaShares Global' },
  { ticker: 'VT', label: 'VT -- Vanguard Total World' },
  { ticker: 'ACWI', label: 'ACWI -- MSCI All Country' },
  { ticker: '^AXJO', label: 'ASX 200' },
  { ticker: 'VGS.AX', label: 'VGS.AX -- Vanguard Intl Shares' },
  { ticker: 'IOZ.AX', label: 'IOZ.AX -- iShares ASX 200' },
];

type Timeframe = '1M' | '3M' | '6M' | 'YTD' | '1Y' | 'ALL';
type ChartView = 'performance' | 'value' | 'drawdown';

const TIMEFRAMES: { key: Timeframe; label: string }[] = [
  { key: '1M', label: '1M' },
  { key: '3M', label: '3M' },
  { key: '6M', label: '6M' },
  { key: 'YTD', label: 'YTD' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All' },
];

const VIEWS: { key: ChartView; label: string }[] = [
  { key: 'performance', label: 'Return %' },
  { key: 'value', label: 'Value' },
  { key: 'drawdown', label: 'Drawdown' },
];

function getCutoffDate(tf: Timeframe): string | null {
  if (tf === 'ALL') return null;
  const now = new Date();
  if (tf === 'YTD') return `${now.getFullYear()}-01-01`;
  const months = { '1M': 1, '3M': 3, '6M': 6, '1Y': 12 }[tf];
  now.setMonth(now.getMonth() - months);
  return now.toISOString().slice(0, 10);
}

function filterByTimeframe<T extends { date: string }>(data: T[], tf: Timeframe): T[] {
  const cutoff = getCutoffDate(tf);
  if (!cutoff) return data;
  return data.filter(d => d.date >= cutoff);
}

// Rebase a return series so the first visible point starts at 0%
function rebaseReturns(data: { date: string; cumulative_return: number }[]): { date: string; cumulative_return: number }[] {
  if (data.length === 0) return data;
  const base = data[0].cumulative_return;
  if (base === 0) return data;
  const baseFactor = 1 + base / 100;
  return data.map(d => ({
    date: d.date,
    cumulative_return: Math.round(((1 + d.cumulative_return / 100) / baseFactor - 1) * 10000) / 100,
  }));
}

const pnlStyle = (v: number): React.CSSProperties =>
  v > 0 ? { color: '#17c964' } : v < 0 ? { color: '#f31260' } : { color: '#a1a1aa' };

export function PerformanceChart() {
  const { selectedId, portfolios, changeBenchmark } = usePortfolioStore();
  const { data: dashData } = usePortfolioDashboard(selectedId);
  const { performance, valueHistory, drawdown } = dashData;
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const portfolioSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const benchmarkSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  const [timeframe, setTimeframe] = useState<Timeframe>('1Y');
  const [view, setView] = useState<ChartView>('performance');
  const [hoverData, setHoverData] = useState<{ date: string; portfolio?: number; benchmark?: number } | null>(null);
  const [showBenchmarkPicker, setShowBenchmarkPicker] = useState(false);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const currentBenchmark = portfolios.find(p => p.id === selectedId)?.benchmark || 'URTH';

  const handleBenchmarkChange = async (ticker: string) => {
    if (!selectedId || ticker === currentBenchmark) {
      setShowBenchmarkPicker(false);
      return;
    }
    setBenchmarkLoading(true);
    setShowBenchmarkPicker(false);
    try {
      await changeBenchmark(selectedId, ticker);
    } finally {
      setBenchmarkLoading(false);
    }
  };

  // Close picker on outside click
  useEffect(() => {
    if (!showBenchmarkPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowBenchmarkPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showBenchmarkPicker]);

  // Compute filtered data for the selected view + timeframe
  const chartData = useMemo(() => {
    if (view === 'performance' && performance) {
      const pf = filterByTimeframe(performance.portfolio, timeframe);
      const bm = filterByTimeframe(performance.benchmark, timeframe);
      return {
        primary: rebaseReturns(pf).map(d => ({ time: d.date as Time, value: d.cumulative_return })),
        secondary: rebaseReturns(bm).map(d => ({ time: d.date as Time, value: d.cumulative_return })),
        suffix: '%',
        primaryLabel: 'Portfolio',
        secondaryLabel: performance.benchmark_ticker,
      };
    }
    if (view === 'value') {
      const filtered = filterByTimeframe(valueHistory, timeframe);
      return {
        primary: filtered.map(d => ({ time: d.date as Time, value: d.value })),
        secondary: filtered.map(d => ({ time: d.date as Time, value: d.deposits })),
        suffix: '',
        primaryLabel: 'Market Value',
        secondaryLabel: 'Deposits',
      };
    }
    if (view === 'drawdown') {
      const filtered = filterByTimeframe(drawdown, timeframe);
      return {
        primary: filtered.map(d => ({ time: d.date as Time, value: d.drawdown })),
        secondary: [] as LineData<Time>[],
        suffix: '%',
        primaryLabel: 'Drawdown',
        secondaryLabel: '',
      };
    }
    return { primary: [], secondary: [], suffix: '', primaryLabel: '', secondaryLabel: '' };
  }, [view, timeframe, performance, valueHistory, drawdown]);

  // Summary stats for the filtered range
  const stats = useMemo(() => {
    if (chartData.primary.length < 2) return null;
    const first = chartData.primary[0].value;
    const last = chartData.primary[chartData.primary.length - 1].value;
    const min = Math.min(...chartData.primary.map(d => d.value));
    const max = Math.max(...chartData.primary.map(d => d.value));

    let benchLast: number | null = null;
    if (chartData.secondary.length > 0) {
      benchLast = chartData.secondary[chartData.secondary.length - 1].value;
    }

    return { first, last, min, max, change: last - first, benchLast };
  }, [chartData]);

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#a1a1aa',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.06)' },
        horzLines: { color: 'rgba(255,255,255,0.06)' },
      },
      timeScale: {
        timeVisible: false,
        borderColor: '#27272a',
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      rightPriceScale: {
        borderColor: '#27272a',
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      crosshair: {
        mode: 0,
        vertLine: { color: '#a1a1aa', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#27272a' },
        horzLine: { color: '#a1a1aa', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#27272a' },
      },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      portfolioSeriesRef.current = null;
      benchmarkSeriesRef.current = null;
    };
  }, []);

  // Update series data when chartData changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove old series
    if (portfolioSeriesRef.current) {
      chart.removeSeries(portfolioSeriesRef.current);
      portfolioSeriesRef.current = null;
    }
    if (benchmarkSeriesRef.current) {
      chart.removeSeries(benchmarkSeriesRef.current);
      benchmarkSeriesRef.current = null;
    }

    if (chartData.primary.length === 0) return;

    const primaryColor = view === 'drawdown' ? '#f31260' : '#006FEE';
    const lastVal = chartData.primary[chartData.primary.length - 1]?.value ?? 0;
    const isPositive = view === 'performance' ? lastVal >= 0 : view === 'value';
    const lineColor = view === 'performance' ? (isPositive ? '#17c964' : '#f31260') : primaryColor;

    const primarySeries = chart.addLineSeries({
      color: lineColor,
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) =>
          view === 'value'
            ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
            : `${price.toFixed(2)}%`,
      },
      crosshairMarkerRadius: 4,
      crosshairMarkerBackgroundColor: lineColor,
      lastValueVisible: true,
      priceLineVisible: false,
    });
    primarySeries.setData(chartData.primary);
    portfolioSeriesRef.current = primarySeries;

    // Add zero line for performance/drawdown
    if (view === 'performance' || view === 'drawdown') {
      primarySeries.createPriceLine({
        price: 0,
        color: '#27272a',
        lineWidth: 1,
        lineStyle: LineStyle.Solid,
        axisLabelVisible: false,
      });
    }

    if (chartData.secondary.length > 0) {
      const secondaryColor = '#F59E0B';
      const benchSeries = chart.addLineSeries({
        color: secondaryColor,
        lineWidth: 2,
        lineStyle: view === 'value' ? LineStyle.Dashed : LineStyle.Solid,
        priceFormat: {
          type: 'custom',
          formatter: (price: number) =>
            view === 'value'
              ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
              : `${price.toFixed(2)}%`,
        },
        crosshairMarkerRadius: 3,
        crosshairMarkerBackgroundColor: secondaryColor,
        lastValueVisible: true,
        priceLineVisible: false,
      });
      benchSeries.setData(chartData.secondary);
      benchmarkSeriesRef.current = benchSeries;
    }

    chart.timeScale().fitContent();
  }, [chartData, view]);

  // Crosshair move handler
  const setupCrosshair = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData) {
        setHoverData(null);
        return;
      }
      const pVal = portfolioSeriesRef.current ? param.seriesData.get(portfolioSeriesRef.current) : undefined;
      let bVal = benchmarkSeriesRef.current ? param.seriesData.get(benchmarkSeriesRef.current) : undefined;

      let benchmarkValue: number | undefined;
      if (bVal && 'value' in bVal) {
        benchmarkValue = (bVal as { value: number }).value;
      } else if (chartData.secondary.length > 0) {
        const hoveredDate = String(param.time);
        for (let i = chartData.secondary.length - 1; i >= 0; i--) {
          if (String(chartData.secondary[i].time) <= hoveredDate) {
            benchmarkValue = chartData.secondary[i].value;
            break;
          }
        }
      }

      setHoverData({
        date: String(param.time),
        portfolio: pVal && 'value' in pVal ? (pVal as { value: number }).value : undefined,
        benchmark: benchmarkValue,
      });
    });
  }, [chartData.secondary]);

  useEffect(() => {
    setupCrosshair();
  }, [setupCrosshair]);

  const formatVal = (v: number) =>
    view === 'value'
      ? `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

  const hasData = chartData.primary.length > 1;

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#18181b', border: '1px solid #27272a' }}>
      {/* Header */}
      <div className="px-6 py-4" style={{ borderBottom: '1px solid #27272a' }}>
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* View Switcher */}
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: '#27272a' }}>
            {VIEWS.map(v => (
              <button
                key={v.key}
                onClick={() => setView(v.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
                style={
                  view === v.key
                    ? { background: '#006FEE', color: '#ffffff' }
                    : { color: '#a1a1aa' }
                }
              >
                {v.label}
              </button>
            ))}
          </div>

          {/* Timeframe Buttons */}
          <div className="flex items-center gap-1 rounded-lg p-0.5" style={{ background: '#27272a' }}>
            {TIMEFRAMES.map(tf => (
              <button
                key={tf.key}
                onClick={() => setTimeframe(tf.key)}
                className="px-3 py-1.5 text-xs font-medium rounded-full transition-colors"
                style={
                  timeframe === tf.key
                    ? { background: '#006FEE', color: '#ffffff' }
                    : { color: '#a1a1aa' }
                }
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row */}
        {stats && (
          <div className="flex items-center gap-6 mt-3 text-sm">
            {hoverData ? (
              <>
                <span className="font-mono text-xs" style={{ color: '#a1a1aa' }}>{hoverData.date}</span>
                {hoverData.portfolio !== undefined && (
                  <span className="font-mono font-bold" style={pnlStyle(hoverData.portfolio)}>
                    {chartData.primaryLabel}: {formatVal(hoverData.portfolio)}
                  </span>
                )}
                {hoverData.benchmark !== undefined && (
                  <span className="font-mono text-amber-400">
                    {chartData.secondaryLabel}: {formatVal(hoverData.benchmark)}
                  </span>
                )}
              </>
            ) : (
              <>
                <div>
                  <span className="text-xs" style={{ color: '#a1a1aa' }}>{chartData.primaryLabel}: </span>
                  <span className="font-mono font-bold" style={view === 'drawdown' ? { color: '#f31260' } : pnlStyle(stats.last)}>
                    {formatVal(stats.last)}
                  </span>
                </div>
                {stats.benchLast !== null && (
                  <div>
                    <span className="text-xs" style={{ color: '#a1a1aa' }}>{chartData.secondaryLabel}: </span>
                    <span className="font-mono" style={view === 'value' ? { color: '#F59E0B' } : pnlStyle(stats.benchLast)}>
                      {formatVal(stats.benchLast)}
                    </span>
                  </div>
                )}
                {view === 'performance' && stats.benchLast !== null && (
                  <div>
                    <span className="text-xs" style={{ color: '#a1a1aa' }}>Alpha: </span>
                    <span className="font-mono font-bold" style={pnlStyle(stats.last - stats.benchLast)}>
                      {(stats.last - stats.benchLast) >= 0 ? '+' : ''}{(stats.last - stats.benchLast).toFixed(2)}%
                    </span>
                  </div>
                )}
                {(view === 'performance' || view === 'drawdown') && (
                  <>
                    <div>
                      <span className="text-xs" style={{ color: '#a1a1aa' }}>High: </span>
                      <span className="font-mono" style={{ color: '#ECEDEE' }}>{formatVal(stats.max)}</span>
                    </div>
                    <div>
                      <span className="text-xs" style={{ color: '#a1a1aa' }}>Low: </span>
                      <span className="font-mono" style={{ color: '#ECEDEE' }}>{formatVal(stats.min)}</span>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Chart */}
      <div className="relative" style={{ height: 360 }}>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: '#18181b' }}>
            <CandleLoader label="Not enough data for this timeframe" />
          </div>
        )}
        <div ref={containerRef} className="w-full" style={{ height: 360 }} />
      </div>

      {/* Legend */}
      <div className="px-6 py-3 flex items-center gap-6 text-xs" style={{ borderTop: '1px solid #27272a', color: '#a1a1aa' }}>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-4 h-0.5 rounded"
            style={{ backgroundColor: view === 'drawdown' ? '#f31260' : view === 'performance' ? (stats && stats.last >= 0 ? '#17c964' : '#f31260') : '#006FEE' }}
          />
          {chartData.primaryLabel}
        </span>
        {view === 'performance' && (
          <div className="relative" ref={pickerRef}>
            <button
              onClick={() => setShowBenchmarkPicker(!showBenchmarkPicker)}
              className="flex items-center gap-1.5 px-2 py-1 -my-1 rounded-lg transition-colors cursor-pointer"
              style={{ background: 'transparent' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#27272a'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              title="Click to change benchmark"
            >
              <span
                className="inline-block w-4 h-0.5 rounded"
                style={{ backgroundColor: '#F59E0B' }}
              />
              {benchmarkLoading ? (
                <span className="animate-pulse">Loading...</span>
              ) : (
                <>
                  {currentBenchmark}
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </>
              )}
            </button>
            {showBenchmarkPicker && (
              <div className="absolute bottom-full left-0 mb-1 rounded-xl shadow-lg z-50 py-1 min-w-[220px]" style={{ background: '#18181b', border: '1px solid #27272a' }}>
                {BENCHMARK_OPTIONS.map(opt => (
                  <button
                    key={opt.ticker}
                    onClick={() => handleBenchmarkChange(opt.ticker)}
                    className="w-full text-left px-3 py-2 text-xs transition-colors"
                    style={{ color: opt.ticker === currentBenchmark ? '#006FEE' : '#ECEDEE', fontWeight: opt.ticker === currentBenchmark ? 600 : 400 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#27272a'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {opt.label}
                    {opt.ticker === currentBenchmark && (
                      <span className="ml-2" style={{ color: '#006FEE' }}>&#10003;</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {view === 'value' && chartData.secondaryLabel && (
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4 h-0.5 rounded"
              style={{ backgroundColor: '#F59E0B', opacity: 0.7 }}
            />
            {chartData.secondaryLabel}
            <span className="text-[10px]">(dashed)</span>
          </span>
        )}
        <span className="ml-auto text-[10px]">scroll to zoom, drag to pan</span>
      </div>
    </div>
  );
}
