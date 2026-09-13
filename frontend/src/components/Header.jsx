import React, { useState, useRef, useEffect } from 'react';
import { Sun, Moon, ArrowLeft, RefreshCw, UserPlus, ChevronDown, LogOut, Shield, ShieldCheck } from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';

export default function Header({
  currentView,
  setView,
  onBack,
  backLabel,
  theme,
  toggleTheme,
  lastRefresh,
  isPolling,
  onManualRefresh,
}) {
  const { user, isSuperAdmin, logout, isMockAuth, switchDevRole } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const secondsAgo = lastRefresh
    ? Math.max(1, Math.floor((new Date().getTime() - lastRefresh.getTime()) / 1000))
    : 3;

  return (
    <header className="dashboard-header">
      <div className="header-title-block">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {currentView !== 'overview' && (
            <button
              onClick={onBack || (() => setView('overview'))}
              className="back-nav-btn"
              aria-label={backLabel || 'Back to Dashboard'}
              title={backLabel || 'Back to Dashboard'}
            >
              <ArrowLeft size={15} />
              <span>{backLabel || 'Back to Dashboard'}</span>
            </button>
          )}
          <h1 className="header-title">
            {currentView === 'overview' && 'Dashboard'}
            {currentView === 'host' && 'Host Telemetry'}
            {currentView === 'volume' && 'Volume Telemetry'}
            {currentView === 'alerts' && 'Storage Incidents & Alerts'}
            {currentView === 'create-admin' && 'Create Admin'}
          </h1>
        </div>
        <p className="header-subtitle">
          {currentView === 'create-admin'
            ? 'Provision new administrator access for monitoring and storage incident mitigation.'
            : 'Monitor storage health, capacity, and I/O activity across your Mac fleet.'}
        </p>
      </div>

      <div className="header-actions">
        {/* ROLE-AWARE NAVIGATION: Super Admin ONLY action */}
        {isSuperAdmin && currentView !== 'create-admin' && (
          <button
            onClick={() => setView('create-admin')}
            className="btn-primary"
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 8,
            }}
            title="Create a new Admin account"
          >
            <UserPlus size={14} />
            <span>Create Admin</span>
          </button>
        )}

        {/* Live Status Badge */}
        <div className="live-status-badge" title="Live background telemetry ingest stream">
          <span className="live-dot" />
          <span>Live Monitoring · Updated {secondsAgo}s ago</span>
          <button
            onClick={onManualRefresh}
            style={{
              background: 'none',
              border: 'none',
              color: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              marginLeft: 4,
              opacity: 0.7,
            }}
            title="Refresh now"
          >
            <RefreshCw size={12} className={isPolling ? 'animate-spin' : ''} />
          </button>
        </div>

        {/* Theme Switcher Toggle */}
        <button
          onClick={toggleTheme}
          className="theme-switch-btn"
          aria-label={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} mode`}
        >
          <div className="theme-switch-thumb">
            {theme === 'dark' ? (
              <Moon className="switch-icon-moon" size={14} color="#0f172a" fill="#0f172a" />
            ) : (
              <Sun className="switch-icon-sun" size={15} color="#eab308" fill="#eab308" />
            )}
          </div>
        </button>

        {/* AUTHENTICATED USER PROFILE & ROLE BADGE */}
        {user && (
          <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((prev) => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '4px 10px 4px 6px',
                borderRadius: 20,
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-card)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              aria-expanded={dropdownOpen}
              aria-label="User profile menu"
            >
              {/* Avatar or Initials */}
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'var(--kpi-primary-bg)',
                    color: '#ffffff',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    letterSpacing: '0.02em',
                  }}
                >
                  {user.initials || 'AD'}
                </div>
              )}

              {/* Name & Subtle Role Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-main)',
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.name}
                </span>

                {/* Role badge: subtle, non-competing */}
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 9999,
                    background: isSuperAdmin ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-subtle)',
                    color: isSuperAdmin ? 'var(--chart-read)' : 'var(--text-muted)',
                    border: '1px solid var(--border-subtle)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {user.role}
                </span>
              </div>

              <ChevronDown size={14} color="var(--text-dim)" />
            </button>

            {/* Profile Dropdown Menu */}
            {dropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 8px)',
                  right: 0,
                  width: 240,
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 14,
                  boxShadow: 'var(--shadow-card)',
                  padding: 14,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  zIndex: 1000,
                  animation: 'fadeIn 0.15s ease',
                }}
              >
                {/* User info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-main)' }}>
                    {user.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.email || 'administrator@local'}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-dim)' }}>
                  {isSuperAdmin ? (
                    <ShieldCheck size={13} color="var(--chart-read)" />
                  ) : (
                    <Shield size={13} color="var(--text-dim)" />
                  )}
                  <span>Role: <strong>{user.role}</strong></span>
                </div>

                {/* Dev Mode Role Switcher (convenient for testing both Super Admin & Admin) */}
                {isMockAuth && (
                  <div
                    style={{
                      borderTop: '1px solid var(--border-subtle)',
                      paddingTop: 8,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      Switch Role (Demo Mode)
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => {
                          switchDevRole('Super Admin');
                          setDropdownOpen(false);
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: isSuperAdmin ? '1px solid var(--chart-read)' : '1px solid var(--border-subtle)',
                          background: isSuperAdmin ? 'var(--bg-subtle)' : 'var(--bg-card)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        Super Admin
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          switchDevRole('Admin');
                          setDropdownOpen(false);
                          if (currentView === 'create-admin') {
                            setView('overview');
                          }
                        }}
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: 10,
                          fontWeight: 600,
                          borderRadius: 6,
                          border: !isSuperAdmin ? '1px solid var(--chart-read)' : '1px solid var(--border-subtle)',
                          background: !isSuperAdmin ? 'var(--bg-subtle)' : 'var(--bg-card)',
                          color: 'var(--text-main)',
                          cursor: 'pointer',
                        }}
                      >
                        Admin
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      logout();
                    }}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      background: 'none',
                      border: 'none',
                      borderRadius: 8,
                      color: 'var(--alert-crit-border)',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <LogOut size={14} />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
