import React from 'react';
import { Server, HardDrive, AlertTriangle, ArrowUpRight, ArrowDownLeft } from 'lucide-react';
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
    aggregate_read_bps = 0,
  } = overview;

  return (
    <div className="kpi-grid">
      {/* KPI 1: Monitored Macs */}
      <div className="kpi-card glass-panel">
        <div className="kpi-label">
          <span>Monitored Macs</span>
          <Server size={18} color="var(--accent-blue)" />
        </div>
        <div className="kpi-value">
          {hosts_online}
          <span className="kpi-unit">/ {hosts_total}</span>
        </div>
        <div className="kpi-subtitle">
          {hosts_online === hosts_total ? 'All agents reporting normally' : `${hosts_total - hosts_online} mac offline`}
        </div>
      </div>

      {/* KPI 2: Volumes Monitored */}
      <div className="kpi-card glass-panel">
        <div className="kpi-label">
          <span>Discovered Volumes</span>
          <HardDrive size={18} color="var(--accent-purple)" />
        </div>
        <div className="kpi-value">
          {volumes_monitored}
          <span className="kpi-unit">mounts</span>
        </div>
        <div className="kpi-subtitle">APFS & NFS network storage shares</div>
      </div>

      {/* KPI 3: Storage Alerts */}
      <div className="kpi-card glass-panel">
        <div className="kpi-label">
          <span>Active Incidents</span>
          <AlertTriangle
            size={18}
            color={critical_alerts > 0 ? 'var(--status-red)' : warning_alerts > 0 ? 'var(--status-amber)' : 'var(--status-green)'}
          />
        </div>
        <div className="kpi-value" style={{ color: critical_alerts > 0 ? '#f87171' : warning_alerts > 0 ? '#fbbf24' : '#34d399' }}>
          {critical_alerts + warning_alerts}
          <span className="kpi-unit">
            ({critical_alerts} crit, {warning_alerts} warn)
          </span>
        </div>
        <div className="kpi-subtitle">
          {critical_alerts + warning_alerts === 0 ? 'No open anomalies detected' : 'Action or explanation recommended'}
        </div>
      </div>

      {/* KPI 4: Aggregate Write Activity */}
      <div className="kpi-card glass-panel">
        <div className="kpi-label">
          <span>Fleet Write I/O</span>
          <ArrowUpRight size={18} color="#f87171" />
        </div>
        <div className="kpi-value" style={{ color: '#f87171' }}>
          {formatBps(aggregate_write_bps)}
        </div>
        <div className="kpi-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <ArrowDownLeft size={12} color="#60a5fa" />
          Fleet Read: {formatBps(aggregate_read_bps)}
        </div>
      </div>
    </div>
  );
}
