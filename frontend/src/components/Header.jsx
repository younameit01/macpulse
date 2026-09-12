import React from 'react';
import { Activity, Server, Bell, HardDrive, RefreshCw } from 'lucide-react';

export default function Header({ currentView, setView, lastRefresh, isPolling, isSseActive, onManualRefresh }) {
  const formattedTime = lastRefresh ? lastRefresh.toLocaleTimeString() : '--:--:--';

  return (
    <header className="app-header glass-panel">
      <div className="brand-section">
        <div className="logo-badge">
          <Activity size={24} color="#ffffff" />
        </div>
        <div>
          <h1 className="brand-title">MacAI Storage Observatory</h1>
          <div className="brand-subtitle">macOS Multi-Mac Storage & AI Workload Telemetry</div>
        </div>
      </div>

      <nav className="nav-tabs">
        <button
          className={`nav-tab-btn ${currentView === 'overview' ? 'active' : ''}`}
          onClick={() => setView('overview')}
        >
          <Server size={15} />
          Fleet Overview
        </button>
        <button
          className={`nav-tab-btn ${currentView === 'alerts' ? 'active' : ''}`}
          onClick={() => setView('alerts')}
        >
          <Bell size={15} />
          Alerts
        </button>
      </nav>

      <div className="header-meta">
        <div className="pulse-indicator">
          <span className="pulse-dot"></span>
          <span>{isSseActive ? 'SSE STREAMING' : 'POLLING'} • {formattedTime}</span>
        </div>
        <button
          onClick={onManualRefresh}
          className="btn-primary"
          style={{ padding: '6px 12px', fontSize: 12, background: 'rgba(255, 255, 255, 0.08)', boxShadow: 'none' }}
          title="Manual refresh"
        >
          <RefreshCw size={14} className={isPolling ? 'animate-spin' : ''} />
          Sync
        </button>
      </div>
    </header>
  );
}
