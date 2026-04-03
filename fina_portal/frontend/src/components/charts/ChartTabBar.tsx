import { Select, SelectItem } from '@heroui/select';
import { useSettingsStore, selectTimeframes } from '../../store/settingsStore';
import { DraggableTickerBar } from '../common/DraggableTickerBar';

export function ChartTabBar() {
  const { chartTicker, chartTimeframe, setChartTicker, setChartTimeframe } =
    useSettingsStore();

  const timeframes = useSettingsStore(selectTimeframes);

  return (
    <DraggableTickerBar selectedTicker={chartTicker} onSelect={setChartTicker}>
      <Select
        aria-label="Timeframe"
        selectedKeys={new Set([chartTimeframe])}
        onSelectionChange={keys => { const v = Array.from(keys)[0] as string; if (v) setChartTimeframe(v); }}
        variant="bordered"
        size="sm"
        classNames={{ base: 'max-w-28' }}
      >
        {timeframes.map((tf) => (
          <SelectItem key={tf}>{tf}</SelectItem>
        ))}
      </Select>
    </DraggableTickerBar>
  );
}
