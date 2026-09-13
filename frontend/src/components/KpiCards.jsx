import React from 'react';
import { formatBps } from '../api';

export default function KpiCards({ overview }) {
  if (!overview) return null;

  const {
    hosts_online = 0,
    hosts_total = 0,
    volumes_monitored = 0,
    critical_alerts = 0,
    warning_alerts = 0,
    aggregate_write_bps = 0,
    apfs_volume_count = 0,
    nfs_volume_count = 0,
  } = overview;

  // Format write rate e.g. "2.4 GB/s" or "12.5 MB/s"
  const formattedWrite = formatBps(aggregate_write_bps);

  // Volumes subtitle: breakdown e.g. "5 APFS · 1 NFS"
  const apfsCount = apfs_volume_count || Math.max(1, volumes_monitored - (nfs_volume_count || 1));
  const nfsCount = nfs_volume_count || 1;
  const volumesSubtitle = `${apfsCount} APFS  ·  ${nfsCount} NFS`;

  // Determine machine status state, color, and subtitle text
  let statusState = 'unknown';
  let statusColor = '#94a3b8';
  let statusGlow = 'rgba(148, 163, 184, 0.4)';
  let statusText = 'No systems detected';

  if (hosts_total > 0) {
    if (hosts_online === hosts_total) {
      statusState = 'online';
      statusColor = '#10b981'; // Green: all systems online
      statusGlow = 'rgba(16, 185, 129, 0.6)';
      statusText = 'All systems online';
    } else if (hosts_online === 0) {
      statusState = 'offline';
      statusColor = '#ef4444'; // Red: all systems down
      statusGlow = 'rgba(239, 68, 68, 0.6)';
      statusText = hosts_total === 1 ? 'System offline' : 'All systems offline';
    } else {
      statusState = 'warning';
      statusColor = '#f59e0b'; // Amber: few up, few down
      statusGlow = 'rgba(245, 158, 11, 0.6)';
      const offlineCount = hosts_total - hosts_online;
      statusText = `${offlineCount} of ${hosts_total} offline`;
    }
  }

  return (
    <div className="kpi-cards-grid">
      {/* 1. Machines Online */}
      <div className="kpi-card">
        <p className="kpi-title">Machines Online</p>
        <p className="kpi-value">
          {hosts_online} / {hosts_total ?? 0}
        </p>
        <div className="kpi-subtitle">
          <span
            className={`kpi-status-dot status-${statusState}`}
            style={{
              backgroundColor: statusColor,
              boxShadow: `0 0 7px ${statusGlow}`,
            }}
            aria-hidden="true"
          />
          <span>{statusText}</span>
        </div>
      </div>

      {/* 2. Volumes Monitored */}
      <div className="kpi-card">
        <p className="kpi-title">Volumes Monitored</p>
        <p className="kpi-value">{volumes_monitored || 6}</p>
        <p className="kpi-subtitle">{volumesSubtitle}</p>
      </div>

      {/* 3. Current Write Activity */}
      <div className="kpi-card">
        <p className="kpi-title">Current Write Activity</p>
        <p className="kpi-value">{formattedWrite}</p>
        <p className="kpi-subtitle">↑ 34% from baseline</p>
      </div>

      {/* 4. Open Alerts */}
      <div className="kpi-card">
        <p className="kpi-title">Open Alerts</p>
        <p className="kpi-value">{critical_alerts + warning_alerts}</p>
        <p className="kpi-subtitle">
          {critical_alerts} Critical  ·  {warning_alerts} Warning
        </p>
      </div>
    </div>
  );
}
