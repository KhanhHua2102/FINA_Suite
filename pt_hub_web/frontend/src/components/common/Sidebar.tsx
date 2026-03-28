import { useState } from 'react';

const NAV_ITEMS = [
  { id: 'portfolio', label: 'Portfolio', icon: PortfolioIcon },
  { id: 'property', label: 'Property', icon: PropertyIcon },
  { id: 'analysis', label: 'Analysis', icon: AnalysisIcon },
  { id: 'training', label: 'Training', icon: TrainingIcon },
  { id: 'predictions', label: 'Predictions', icon: PredictionsIcon },
  { id: 'charts', label: 'Charts', icon: ChartsIcon },
];

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  onSettingsClick: () => void;
}

export function Sidebar({ activeTab, onTabChange, connectionStatus, onSettingsClick }: SidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (id: string) => {
    onTabChange(id);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-50 md:hidden p-2 rounded-xl"
        style={{ background: 'var(--surface)', color: 'var(--foreground)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:static z-50 md:z-auto h-screen w-64 flex flex-col transition-transform duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
        style={{
          background: 'var(--background)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo / App Title */}
        <div className="flex items-center gap-3 px-6 h-16 shrink-0" style={{ borderBottom: '1px solid var(--separator)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--accent)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 20V10M18 20V4M6 20v-4" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Stock AI Prediction</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`sidebar-item w-full ${activeTab === item.id ? 'active' : ''}`}
            >
              <item.icon active={activeTab === item.id} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-4 space-y-3 shrink-0" style={{ borderTop: '1px solid var(--separator)' }}>
          {/* Connection Status */}
          <div className="flex items-center gap-2 px-2 text-xs" style={{ color: 'var(--muted)' }}>
            <StatusDot status={connectionStatus} />
            <span>{connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}</span>
          </div>

          {/* Settings */}
          <button
            onClick={onSettingsClick}
            className="sidebar-item w-full"
          >
            <SettingsIcon />
            Settings
          </button>
        </div>
      </aside>
    </>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'connected' ? 'var(--success)' : status === 'connecting' ? 'var(--warning)' : 'var(--danger)';
  return (
    <span
      className="w-2 h-2 rounded-full inline-block"
      style={{ background: color, boxShadow: status === 'connected' ? `0 0 6px ${color}` : undefined }}
    />
  );
}

// Icons
function TrainingIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function PredictionsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}

function ChartsIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 20V10M12 20V4M6 20v-6" />
    </svg>
  );
}

function AnalysisIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function PropertyIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18M4 21V10l8-6 8 6v11M9 21v-6h6v6" />
    </svg>
  );
}

function PortfolioIcon({ active }: { active: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? 'var(--accent-500)' : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a4 4 0 00-8 0v2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
