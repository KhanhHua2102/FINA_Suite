import { useEffect, useState } from 'react';
import { useWebSocket } from './hooks/useWebSocket';
import { useSettingsStore } from './store/settingsStore';
import { settingsApi } from './services/api';
import { TrainingTab } from './components/training/TrainingTab';
import { ChartsTab } from './components/charts/ChartsTab';
import { PredictionsTab } from './components/predictions/PredictionsTab';
import { AnalysisTab } from './components/analysis/AnalysisTab';
import { PortfolioTab } from './components/portfolio/PortfolioTab';
import { Sidebar } from './components/common/Sidebar';
import { SettingsModal } from './components/common/SettingsModal';

const TAB_LABELS: Record<string, string> = {
  training: 'Training',
  predictions: 'Predictions',
  charts: 'Charts',
  analysis: 'Analysis',
  portfolio: 'Portfolio',
};

const TAB_COMPONENTS: Record<string, React.FC> = {
  training: TrainingTab,
  predictions: PredictionsTab,
  charts: ChartsTab,
  analysis: AnalysisTab,
  portfolio: PortfolioTab,
};

function App() {
  const { status } = useWebSocket();
  const { activeTab, setActiveTab, setSettings } = useSettingsStore();
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    settingsApi.get().then(setSettings).catch(console.error);
  }, [setSettings]);

  const ActiveComponent = TAB_COMPONENTS[activeTab];

  return (
    <div className="flex h-screen" style={{ background: 'var(--background)' }}>
      {/* Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'training' | 'predictions' | 'charts' | 'analysis' | 'portfolio')}
        connectionStatus={status}
        onSettingsClick={() => setShowSettings(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Navbar */}
        <header
          className="flex items-center justify-between px-6 h-16 shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            {TAB_LABELS[activeTab]}
          </h1>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-[90rem] mx-auto w-full">
            {ActiveComponent && <ActiveComponent />}
          </div>
        </main>
      </div>

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  );
}


export default App;
