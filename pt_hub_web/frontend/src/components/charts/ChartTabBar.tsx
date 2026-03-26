import { useSettingsStore, selectTimeframes } from '../../store/settingsStore';
import { DraggableTickerBar } from '../common/DraggableTickerBar';

export function ChartTabBar() {
  const { chartTicker, chartTimeframe, setChartTicker, setChartTimeframe } =
    useSettingsStore();

  const timeframes = useSettingsStore(selectTimeframes);

  return (
    <DraggableTickerBar selectedTicker={chartTicker} onSelect={setChartTicker}>
      <select
        value={chartTimeframe}
        onChange={(e) => setChartTimeframe(e.target.value)}
        className="glass-input text-xs py-1.5 px-3"
        style={{ borderRadius: '8px' }}
      >
        {timeframes.map((tf) => (
          <option key={tf} value={tf}>
            {tf}
          </option>
        ))}
      </select>
    </DraggableTickerBar>
  );
}
