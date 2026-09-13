import React from 'react';
import { formatBps } from '../api';

export default function MachineOverviewCard({
  hosts = [],
  onSelectHost,
  onViewAll,
}) {
  const displayHosts = hosts.slice(0, 2);
  const hasMore = hosts.length > displayHosts.length;

  return (
    <div className="card-container" style={{ minHeight: 342, display: 'flex', flexDirection: 'column' }}>
      {/* Header with symmetric top-right 'View all →' action */}
      <div className="card-header-row">
        <div>
          <h2 className="card-heading">Machine Overview</h2>
          <p className="card-subheading">Live health across monitored Macs</p>
        </div>
        <button
          type="button"
          className="card-action-link"
          onClick={onViewAll}
          disabled={!hasMore}
          title={hasMore ? `View all (${hosts.length}) machines in fleet table` : 'All machines currently shown'}
        >
          View all →
        </button>
      </div>

      {/* Machine rows */}
      <div className="machine-list-compact" style={{ flex: 1 }}>
        {displayHosts.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
            Waiting for Mac agents to report...
          </div>
        ) : (
          displayHosts.map((h) => {
            const displayName = h.hostname || 'Mac';
            const isOffline = h.status !== 'online';
            const isWarning = Boolean(h.capacity_warning);
            const rate = formatBps(h.current_write_bps || h.current_read_bps || 0);

            let dotColor = '#10b981';
            if (isOffline) {
              dotColor = '#ef4444';
            } else if (isWarning) {
              dotColor = '#f59e0b';
            }

            const statusClass = isOffline ? 'status-offline' : isWarning ? 'status-warning' : 'status-healthy';
            const statusLabel = isOffline ? 'Offline' : isWarning ? 'Warning' : 'Healthy';

            return (
              <div
                key={h.id}
                className="machine-item-row"
                onClick={() => onSelectHost(h.id)}
                title={`Inspect telemetry for ${displayName}`}
              >
                <div className="machine-row-left">
                  <div className="machine-row-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        backgroundColor: dotColor,
                        boxShadow: `0 0 6px ${dotColor}`,
                        flexShrink: 0,
                      }}
                      aria-hidden="true"
                    />
                    <span className="machine-name-text" title={displayName}>
                      {displayName}
                    </span>
                  </div>
                  <div className="machine-row-sub">
                    {h.status === 'online' ? 'Online' : 'Offline'}  ·  {h.hottest_volume_metric || 'Macintosh HD normal'}
                  </div>
                </div>

                <div className="machine-row-right">
                  <div className="machine-row-metric">{rate}</div>
                  <div className={`machine-row-status ${statusClass}`}>
                    {statusLabel}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
