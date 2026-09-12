import React, { useEffect, useState } from 'react';
import { ArrowLeft, Server, HardDrive, Cpu, User, AlertTriangle, Sparkles, Clock, CheckCircle } from 'lucide-react';
import { fetchHostDetail, fetchHostMetrics, formatBytes, formatBps } from '../api';
import IoChart from './IoChart';

export default function HostDetail({ hostId, onBack, onSelectVolume, onExplainAlert }) {
  const [host, setHost] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [hData, mData] = await Promise.all([
        fetchHostDetail(hostId),
        fetchHostMetrics(hostId, 15),
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
  }, [hostId]);

  if (loading && !host) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading host telemetry...
      </div>
    );
  }

  if (!host) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#f87171' }}>Host not found</p>
        <button onClick={onBack} className="btn-primary" style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to Fleet
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Bar with Back Button */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-main)',
            padding: '8px 16px',
            borderRadius: 8,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <ArrowLeft size={15} /> Back to Fleet Overview
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`badge ${host.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
            {host.status}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
            Last seen: {new Date(host.last_seen).toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* Host Meta Card */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ padding: 14, background: 'rgba(59, 130, 246, 0.15)', borderRadius: 14, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
            <Server size={28} color="var(--accent-blue)" />
          </div>
          <div>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{host.hostname}</h2>
            <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
              <span>ID: <code className="mono-text">{host.id}</code></span>
              <span>OS: <strong style={{ color: '#cbd5e1' }}>{host.os_version}</strong></span>
              <span>Agent: v{host.agent_version}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Throughput Chart */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <IoChart data={metrics} height={200} title="Historical Throughput (Last 15 Minutes)" />
      </div>

      {/* Volumes Table */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 14 }}>Mounted Filesystems</h3>
        <div className="data-table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Mount Point</th>
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
                const fillClass = v.used_pct >= 90 ? 'fill-red' : v.used_pct >= 80 ? 'fill-amber' : 'fill-green';
                return (
                  <tr key={v.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <HardDrive size={16} color={isNfs ? '#c084fc' : '#60a5fa'} />
                        <span className="mono-text" style={{ fontWeight: 600, color: '#ffffff' }}>{v.mount_path}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${isNfs ? 'badge-nfs' : 'badge-apfs'}`}>
                        {v.fs_type.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="mono-text" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {v.source}
                      </span>
                    </td>
                    <td style={{ minWidth: 180 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
                        <span>{formatBytes(v.used_bytes)} / {formatBytes(v.total_bytes)}</span>
                        <strong>{v.used_pct}%</strong>
                      </div>
                      <div className="progress-container">
                        <div className={`progress-fill ${fillClass}`} style={{ width: `${Math.min(100, v.used_pct)}%` }}></div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12 }}>
                        <span style={{ color: '#f87171' }}>W: {formatBps(v.current_write_bps)}</span>
                        <span style={{ color: 'var(--text-dim)', margin: '0 6px' }}>|</span>
                        <span style={{ color: '#60a5fa' }}>R: {formatBps(v.current_read_bps)}</span>
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

      {/* Attribution & Process Activity Panel */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <Cpu size={20} color="var(--accent-purple)" />
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Process Attribution Evidence</h3>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Filesystem write activity sampled from elevated/process collectors</p>
          </div>
        </div>

        {host.recent_events.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-dim)', fontSize: 13, background: 'rgba(0,0,0,0.15)', borderRadius: 8 }}>
            No process attribution events captured. Run agent with <code>MACAI_ENABLE_ELEVATED_COLLECTOR=true</code> to capture elevated syscall traces.
          </div>
        ) : (
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Process Name</th>
                  <th>PID</th>
                  <th>User</th>
                  <th>Operation</th>
                  <th>Cumulative I/O</th>
                </tr>
              </thead>
              <tbody>
                {host.recent_events.map((ev) => (
                  <tr key={ev.id}>
                    <td>
                      <span className="mono-text" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                        {new Date(ev.timestamp).toLocaleTimeString()}
                      </span>
                    </td>
                    <td>
                      <strong style={{ color: '#ffffff' }}>{ev.process}</strong>
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
                      <span className="badge badge-apfs" style={{ fontSize: 11 }}>
                        {ev.operation || 'write'}
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

      {/* Host Alerts */}
      {host.recent_alerts.length > 0 && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 14 }}>Active & Recent Host Alerts</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {host.recent_alerts.map((a) => (
              <div
                key={a.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 16px',
                  borderRadius: 10,
                  background: a.severity === 'critical' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                  border: `1px solid ${a.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${a.severity === 'critical' ? 'badge-critical' : 'badge-warning'}`}>
                      {a.severity}
                    </span>
                    <strong style={{ color: '#ffffff' }}>{a.message}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                    Opened: {new Date(a.opened_at).toLocaleTimeString()}
                  </div>
                </div>
                <button
                  onClick={() => onExplainAlert(a)}
                  className="btn-explain"
                >
                  <Sparkles size={14} /> Explain
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
