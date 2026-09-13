import React, { useEffect, useState } from 'react';
import { ArrowLeft, Server, HardDrive, Cpu, User } from 'lucide-react';
import { fetchHostDetail, fetchHostMetrics, formatBytes, formatBps } from '../api';
import { formatLocalTime } from '../alertUtils';
import IoChart from './IoChart';
import HardwareHealthCard from './HardwareHealthCard';
import SystemResourcesCard from './SystemResourcesCard';
import AlertsPanel from './AlertsPanel';

export default function HostDetail({ hostId, onBack, onSelectVolume, onExplainAlert }) {
  const [host, setHost] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('15 min');

  const rangeMinutesMap = {
    '5 min': 5,
    '15 min': 15,
    '30 min': 30,
    '1 hr': 60,
  };
  const currentMinutes = rangeMinutesMap[timeRange] || 15;

  const loadData = async () => {
    try {
      const [hData, mData] = await Promise.all([
        fetchHostDetail(hostId),
        fetchHostMetrics(hostId, currentMinutes),
      ]);
      setHost(hData);
      setMetrics(mData);
    } catch (err) {
      console.error('Failed to load host details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [hostId, currentMinutes]);

  if (loading && !host) {
    return (
      <div className="card-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading host telemetry...
      </div>
    );
  }

  if (!host) {
    return (
      <div className="card-container" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--alert-crit-border)' }}>Host not found</p>
        <button onClick={onBack} className="btn-primary" style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Host Meta Card (Compact height & local time) */}
      <div className="card-container" style={{ padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                padding: '8px 10px',
                background: 'var(--bg-subtle)',
                borderRadius: 10,
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Server size={20} color="var(--chart-read)" />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                {host.hostname}
              </h2>
              <div style={{ display: 'flex', gap: 14, fontSize: 12, color: 'var(--text-muted)', marginTop: 3, flexWrap: 'wrap' }}>
                <span>ID: <code className="mono-text" style={{ fontSize: 11 }}>{host.id}</code></span>
                <span>OS: <strong style={{ color: 'var(--text-main)' }}>{host.os_version}</strong></span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {host.storage_total_bytes > 0 && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'var(--bg-subtle)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                }}
              >
                <HardDrive size={13} color="var(--chart-read)" />
                <span>
                  Storage: <strong style={{ color: 'var(--text-main)' }}>{formatBytes(host.storage_used_bytes)}</strong> / {formatBytes(host.storage_total_bytes)} ({host.storage_used_pct}%)
                </span>
              </span>
            )}
            <span className={`badge ${host.status === 'online' ? 'badge-online' : 'badge-offline'}`} style={{ padding: '4px 10px', fontSize: 11 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: host.status === 'online' ? '#10b981' : '#ef4444' }}></span>
              {host.status}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
              Last seen: <strong style={{ color: 'var(--text-main)', fontWeight: 500 }}>{formatLocalTime(host.last_seen)}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Hardware & S.M.A.R.T. Health Card */}
      <HardwareHealthCard diskHealth={host.disk_health} />

      {/* Analytics Row: Host I/O Activity (Left 50%) + System Compute & Memory Telemetry (Right 50%) */}
      <div className="host-analytics-row-grid">
        <div className="card-container" style={{ padding: 24, minHeight: 336, display: 'flex', flexDirection: 'column' }}>
          <IoChart
            data={metrics}
            height={210}
            title="Host I/O Activity"
            subtitle={`Read and write throughput over the last ${timeRange}`}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>
        <SystemResourcesCard
          systemResources={host.system_resources}
        />
      </div>

      {/* Volumes Table */}
      <div className="card-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Mounted Filesystems</h3>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>Primary physical storage and network mounts</span>
        </div>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Volume & Role</th>
                <th>Type</th>
                <th>Source Device</th>
                <th>Capacity / Used</th>
                <th>Throughput</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {host.volumes.map((v) => {
                const isNfs = v.fs_type.toLowerCase() === 'nfs';
                const isInternal = v.mount_path === '/System/Volumes/Data' || v.mount_path === '/';

                let title = v.mount_path;
                let role = null;
                if (isInternal) {
                  title = 'Macintosh HD';
                  role = 'Internal APFS SSD · Applications & User Data';
                } else if (v.mount_path.startsWith('/Volumes/')) {
                  title = v.mount_path.replace('/Volumes/', '');
                  role = isNfs ? 'NFS Cluster Export' : 'External / Network Volume';
                }

                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <HardDrive size={18} color={isNfs ? '#c084fc' : 'var(--chart-read)'} />
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: 13 }}>
                              {title}
                            </span>
                            {isInternal && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'rgba(56, 189, 248, 0.12)',
                                  color: '#38bdf8',
                                  border: '1px solid rgba(56, 189, 248, 0.25)',
                                }}
                              >
                                Internal SSD
                              </span>
                            )}
                            {isNfs && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: 'rgba(192, 132, 252, 0.15)',
                                  color: '#c084fc',
                                  border: '1px solid rgba(192, 132, 252, 0.3)',
                                }}
                              >
                                NFS
                              </span>
                            )}
                          </div>
                          <div className="mono-text" style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
                            {v.mount_path} {role ? `· ${role}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)' }}>
                        {v.fs_type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {v.source}
                      </span>
                    </td>
                    <td style={{ minWidth: 210 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                        <span>
                          <strong style={{ color: 'var(--text-main)' }}>{formatBytes(v.used_bytes)}</strong> / {formatBytes(v.total_bytes)}
                        </span>
                        <strong style={{ color: v.used_pct >= 90 ? 'var(--alert-crit-border)' : v.used_pct >= 80 ? 'var(--alert-warn-text)' : 'var(--text-main)' }}>
                          {v.used_pct}% ({formatBytes(v.free_bytes)} free)
                        </strong>
                      </div>
                      <div style={{ width: '100%', height: 6, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${Math.min(100, v.used_pct)}%`,
                            height: '100%',
                            backgroundColor: v.used_pct >= 90 ? 'var(--alert-crit-border)' : v.used_pct >= 80 ? 'var(--alert-warn-border)' : 'var(--chart-read)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      {v.breakdown && (
                        <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, lineHeight: 1.4 }}>
                          Includes {formatBytes(v.breakdown.data_bytes)} Data · {formatBytes(v.breakdown.system_bytes)} System{v.breakdown.other_volumes_bytes > 0 ? ` · ${formatBytes(v.breakdown.other_volumes_bytes)} VM & System` : ''}
                        </div>
                      )}
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: 'var(--alert-crit-border)' }}>W: {formatBps(v.current_write_bps)}</span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>|</span>
                        <span style={{ color: 'var(--chart-read)' }}>R: {formatBps(v.current_read_bps)}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        onClick={() => onSelectVolume(v.id)}
                        className="btn-primary"
                        style={{ padding: '4px 10px', fontSize: 11 }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Active & Recent Host Alerts */}
      <AlertsPanel
        alerts={host.recent_alerts || []}
        title="Active & Recent Host Alerts"
        subtitle="Deterministic threshold, rolling baseline, and administrator alert lifecycle for this host"
        onExplainAlert={onExplainAlert}
        onAlertUpdated={loadData}
        scrollable={Boolean(host.recent_alerts && host.recent_alerts.length > 6)}
        maxHeight={host.recent_alerts && host.recent_alerts.length > 6 ? 480 : undefined}
      />

      {/* Attribution & Process Activity Panel */}
      <div className="card-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={20} color="var(--chart-read)" />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>Process Attribution Evidence</h3>
                {host.recent_events.length > 0 && (
                  <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', fontSize: 11 }}>
                    {host.recent_events.length} event{host.recent_events.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time host process activity and filesystem attribution sampled by agent</p>
            </div>
          </div>
          {host.recent_events.length > 6 && (
            <span style={{ fontSize: 11, color: 'var(--text-dim)', background: 'var(--bg-subtle)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border-subtle)' }}>
              Showing 6 rows · Scroll to view all {host.recent_events.length}
            </span>
          )}
        </div>

        {host.recent_events.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, background: 'var(--bg-subtle)', borderRadius: 8 }}>
            No process attribution events captured yet. The agent samples active processes periodically and on disk write spikes.
          </div>
        ) : (
          <div className="data-table-container table-scroll-6">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Process Name</th>
                  <th>PID</th>
                  <th>User</th>
                  <th>Operation</th>
                  <th>Target Mount</th>
                  <th>Footprint / I/O</th>
                </tr>
              </thead>
              <tbody>
                {host.recent_events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className="mono-text" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {formatLocalTime(ev.timestamp)}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--text-main)' }}>{ev.process}</strong>
                    </td>
                    <td>
                      <span className="mono-text">{ev.pid || 'N/A'}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <User size={12} color="var(--text-dim)" />
                        <span>{ev.user || 'system'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)', fontSize: 11 }}>
                        {ev.operation || 'active'}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: 12, color: 'var(--chart-read)' }}>
                        {ev.volume_mount || '—'}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text">{ev.bytes ? formatBytes(ev.bytes) : 'Active'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
