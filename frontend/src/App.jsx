import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import HostTable from './components/HostTable';
import AlertsPanel from './components/AlertsPanel';
import HostDetail from './components/HostDetail';
import VolumeDetail from './components/VolumeDetail';
import AlertDrawer from './components/AlertDrawer';
import { fetchOverview, subscribeOverviewStream } from './api';

export default function App() {
  const [currentView, setView] = useState('overview'); // 'overview' | 'host' | 'volume' | 'alerts'
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);

  const [overview, setOverview] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isPolling, setIsPolling] = useState(false);
  const [isSseActive, setIsSseActive] = useState(false);

  const loadOverview = async () => {
    try {
      setIsPolling(true);
      const data = await fetchOverview();
      setOverview(data);
      setLastRefresh(new Date());
    } catch (err) {
      console.warn('Backend overview fetch warning:', err.message);
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    loadOverview();

    // Connect to Server-Sent Events (SSE) stream
    const unsubscribe = subscribeOverviewStream(
      (data) => {
        setOverview(data);
        setLastRefresh(new Date());
        setIsSseActive(true);
      },
      (err) => {
        console.warn('SSE stream error, falling back to polling:', err);
        setIsSseActive(false);
      }
    );

    // Backup polling timer in case SSE is interrupted
    const backupTimer = setInterval(() => {
      if (!isSseActive) {
        loadOverview();
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(backupTimer);
    };
  }, [isSseActive]);

  const handleSelectHost = (hostId) => {
    setSelectedHostId(hostId);
    setView('host');
  };

  const handleSelectVolume = (volumeId) => {
    setSelectedVolumeId(volumeId);
    setView('volume');
  };

  const handleExplainAlert = (alert) => {
    setActiveAlert(alert);
  };

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <Header
        currentView={currentView}
        setView={(v) => {
          setView(v);
          if (v === 'overview') {
            setSelectedHostId(null);
            setSelectedVolumeId(null);
          }
        }}
        lastRefresh={lastRefresh}
        isPolling={isPolling}
        isSseActive={isSseActive}
        onManualRefresh={loadOverview}
      />

      {/* Main View Router */}
      {currentView === 'overview' && (
        <main style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <KpiCards overview={overview} />
          <HostTable hosts={overview?.hosts || []} onSelectHost={handleSelectHost} />
          <AlertsPanel alerts={overview?.recent_alerts || []} onExplainAlert={handleExplainAlert} />
        </main>
      )}

      {currentView === 'alerts' && (
        <main>
          <AlertsPanel alerts={overview?.recent_alerts || []} onExplainAlert={handleExplainAlert} />
        </main>
      )}

      {currentView === 'host' && selectedHostId && (
        <HostDetail
          hostId={selectedHostId}
          onBack={() => setView('overview')}
          onSelectVolume={handleSelectVolume}
          onExplainAlert={handleExplainAlert}
        />
      )}

      {currentView === 'volume' && selectedVolumeId && (
        <VolumeDetail
          volumeId={selectedVolumeId}
          onBack={() => (selectedHostId ? setView('host') : setView('overview'))}
          onExplainAlert={handleExplainAlert}
        />
      )}

      {/* Slide-in Alert / Explain Drawer */}
      {activeAlert && (
        <AlertDrawer
          alert={activeAlert}
          onClose={() => setActiveAlert(null)}
        />
      )}
    </div>
  );
}
