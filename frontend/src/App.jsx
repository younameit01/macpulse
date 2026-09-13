import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KpiCards from './components/KpiCards';
import FleetIoCard from './components/FleetIoCard';
import RecentAlertsCard from './components/RecentAlertsCard';
import StorageCapacityCard from './components/StorageCapacityCard';
import ActiveVolumesCard from './components/ActiveVolumesCard';
import HostTable from './components/HostTable';
import AlertsPanel from './components/AlertsPanel';
import HostDetail from './components/HostDetail';
import VolumeDetail from './components/VolumeDetail';
import AlertDrawer from './components/AlertDrawer';
import CreateAdminView from './components/CreateAdminView';
import SignInScreen, { AuthLoadingScreen } from './components/SignInScreen';
import AcceptInviteScreen from './components/AcceptInviteScreen';
import { AuthProvider, useAuth } from './auth/AuthProvider';
import { fetchOverview, subscribeOverviewStream } from './api';

function DashboardApp({ theme, toggleTheme }) {
  const { isAuthenticated, isLoading, error, isSuperAdmin, loginWithRedirect } = useAuth();

  const [currentView, setView] = useState('overview'); // 'overview' | 'host' | 'volume' | 'alerts' | 'create-admin'
  const [selectedHostId, setSelectedHostId] = useState(null);
  const [selectedVolumeId, setSelectedVolumeId] = useState(null);
  const [activeAlert, setActiveAlert] = useState(null);

  const [overview, setOverview] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [isPolling, setIsPolling] = useState(false);
  const [isSseActive, setIsSseActive] = useState(false);

  const loadOverview = async () => {
    if (!isAuthenticated) return;
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
    if (!isAuthenticated) return;

    loadOverview();

    // Connect to Server-Sent Events (SSE) stream
    const unsubscribe = subscribeOverviewStream(
      (data) => {
        setOverview(data);
        setLastRefresh(new Date());
        setIsSseActive(true);
      },
      (err) => {
        console.warn('SSE stream fallback to polling:', err);
        setIsSseActive(false);
      }
    );

    // Backup polling timer
    const backupTimer = setInterval(() => {
      if (!isSseActive) {
        loadOverview();
      }
    }, 4000);

    return () => {
      unsubscribe();
      clearInterval(backupTimer);
    };
  }, [isAuthenticated, isSseActive]);

  // Route protection / redirect if Admin tries to stay on create-admin view
  useEffect(() => {
    if (currentView === 'create-admin' && !isSuperAdmin) {
      // CreateAdminView component will display 403 state
    }
  }, [currentView, isSuperAdmin]);

  const handleSelectHost = (hostId) => {
    setSelectedHostId(hostId);
    setView('host');
  };

  const handleSelectVolume = (volumeId) => {
    setSelectedVolumeId(volumeId);
    setView('volume');
  };

  const handleExplainAlert = (alert, autoExplain = false) => {
    setActiveAlert({ ...alert, autoExplain });
  };

  // 1. Loading Authentication State (No flash of unauthenticated UI)
  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  // 2. Invitation Acceptance Route or Unauthenticated Sign In
  const inviteToken = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('invite')
    : null;

  if (!isAuthenticated) {
    if (inviteToken) {
      return (
        <AcceptInviteScreen
          token={inviteToken}
          theme={theme}
          toggleTheme={toggleTheme}
          onCancel={() => {
            if (typeof window !== 'undefined') {
              window.history.replaceState({}, '', window.location.pathname);
              window.location.reload();
            }
          }}
        />
      );
    }
    return <SignInScreen theme={theme} toggleTheme={toggleTheme} />;
  }

  // 4. Authenticated Application State
  const filteredHosts = overview?.hosts || [];
  const openAlertsCount = (overview?.critical_alerts || 0) + (overview?.warning_alerts || 0);

  // Determine contextual back navigation for Header
  let handleBack = null;
  let backLabel = 'Back to Dashboard';

  if (currentView === 'host') {
    handleBack = () => {
      setView('overview');
    };
    backLabel = 'Back to Dashboard';
  } else if (currentView === 'volume') {
    if (selectedHostId) {
      handleBack = () => setView('host');
      backLabel = 'Back to Host';
    } else {
      handleBack = () => {
        setView('overview');
      };
      backLabel = 'Back to Dashboard';
    }
  } else if (currentView === 'alerts') {
    handleBack = () => setView('overview');
    backLabel = 'Back to Dashboard';
  } else if (currentView === 'create-admin') {
    handleBack = () => setView('overview');
    backLabel = 'Back to Dashboard';
  }

  return (
    <div className="dashboard-root" data-theme={theme}>
      <div className="dashboard-container">
        {/* Header with Live Status, Theme Switch, Profile, and Role-Aware Navigation */}
        <Header
          currentView={currentView}
          setView={(v) => {
            setView(v);
            if (v === 'overview') {
              setSelectedHostId(null);
              setSelectedVolumeId(null);
            }
          }}
          onBack={handleBack}
          backLabel={backLabel}
          theme={theme}
          toggleTheme={toggleTheme}
          lastRefresh={lastRefresh}
          isPolling={isPolling}
          onManualRefresh={loadOverview}
          openAlertsCount={openAlertsCount}
        />

        {/* Main View Router */}
        {currentView === 'overview' && (
          <main style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* KPI Cards Row (4 cards) */}
            <KpiCards overview={overview} />

            {/* Operational Row: Recent Alerts & Storage Capacity */}
            <div className="secondary-row-grid">
              <RecentAlertsCard
                alerts={overview?.recent_alerts || []}
                totalOpenAlerts={openAlertsCount}
                onExplainAlert={handleExplainAlert}
                onViewAll={() => setView('alerts')}
              />
              <StorageCapacityCard overview={overview} />
            </div>

            {/* Detailed Monitored Mac Hosts Table (Moved directly after Storage Capacity) */}
            <div id="fleet-hosts-table" style={{ marginTop: 4 }}>
              <HostTable
                hosts={filteredHosts}
                onSelectHost={handleSelectHost}
              />
            </div>

            {/* Fleet Telemetry Row: Fleet I/O Activity & Active Volumes */}
            <div className="primary-row-grid" style={{ marginTop: 4 }}>
              <FleetIoCard overview={overview} selectedHostId={selectedHostId} />
              <ActiveVolumesCard
                overview={overview}
                onSelectVolume={handleSelectVolume}
              />
            </div>
          </main>
        )}

        {currentView === 'alerts' && (
          <main>
            <AlertsPanel
              alerts={overview?.recent_alerts || []}
              onExplainAlert={handleExplainAlert}
              onAlertUpdated={loadOverview}
            />
          </main>
        )}

        {currentView === 'create-admin' && (
          <main>
            <CreateAdminView onBack={() => setView('overview')} />
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
            onBack={() => {
              if (selectedHostId) {
                setView('host');
              } else {
                setView('overview');
                setActiveMachineTab('all');
              }
            }}
            onExplainAlert={handleExplainAlert}
          />
        )}

        {/* Slide-in Alert / Gemini Explain Drawer */}
        {activeAlert && (
          <AlertDrawer
            alert={activeAlert}
            autoExplain={activeAlert?.autoExplain || false}
            onClose={() => setActiveAlert(null)}
            onAlertUpdated={loadOverview}
          />
        )}
      </div>
    </div>
  );
}

export default function App() {
  // Theme Management (Light vs Dark Mode)
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const urlTheme = urlParams.get('theme');
      if (urlTheme === 'dark' || urlTheme === 'light') return urlTheme;

      const saved = localStorage.getItem('macai-theme');
      if (saved === 'light' || saved === 'dark') return saved;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('macai-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <AuthProvider>
      <DashboardApp theme={theme} toggleTheme={toggleTheme} />
    </AuthProvider>
  );
}
