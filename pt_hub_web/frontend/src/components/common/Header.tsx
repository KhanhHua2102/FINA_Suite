interface HeaderProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
}

export function Header({ connectionStatus }: HeaderProps) {
  return (
    <header
      className="flex items-center justify-between px-6 h-16 shrink-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Stock AI Prediction</h1>
      </div>
      <ConnectionIndicator status={connectionStatus} />
    </header>
  );
}

function ConnectionIndicator({ status }: { status: string }) {
  const statusConfig = {
    connected: { color: 'var(--success)', text: 'Connected' },
    connecting: { color: 'var(--warning)', text: 'Connecting...' },
    disconnected: { color: 'var(--danger)', text: 'Disconnected' },
  }[status] ?? { color: 'var(--muted)', text: 'Unknown' };

  return (
    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
      <span className="w-2 h-2 rounded-full" style={{ background: statusConfig.color }} />
      <span>{statusConfig.text}</span>
    </div>
  );
}
