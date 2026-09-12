import React from 'react';
import { Server, ChevronRight, AlertCircle, HardDrive } from 'lucide-react';
import { formatBps } from '../api';

export default function HostTable({ hosts = [], onSelectHost }) {
  return (
    <div className="glass-panel" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>Monitored Mac Hosts</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Real-time agent liveness, storage footprint, and active write throughput</p>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Host</th>
              <th>Status</th>
              <th>Mounts</th>
              <th>Hottest Volume</th>
              <th>Current Write</th>
              <th>Current Read</th>
              <th>Capacity Health</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {hosts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                  Waiting for Mac agents to report telemetry... Run <code>make agent</code> in a terminal.
                </td>
              </tr>
            ) : (
              hosts.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ padding: 8, background: 'rgba(255, 255, 255, 0.05)', borderRadius: 8 }}>
                        <Server size={18} color="var(--accent-blue)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#ffffff' }}>{h.hostname}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{h.os_version}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${h.status === 'online' ? 'badge-online' : 'badge-offline'}`}>
                      <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: h.status === 'online' ? '#10b981' : '#ef4444' }}></span>
                      {h.status}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <HardDrive size={14} />
                      <span>{h.volume_count}</span>
                    </div>
                  </td>
                  <td>
                    <span className="mono-text" style={{ color: '#cbd5e1' }}>
                      {h.hottest_volume || '/'}
                    </span>
                  </td>
                  <td>
                    <span className="mono-text" style={{ color: h.current_write_bps > 10 * 1024 * 1024 ? '#f87171' : 'var(--text-main)', fontWeight: 600 }}>
                      {formatBps(h.current_write_bps)}
                    </span>
                  </td>
                  <td>
                    <span className="mono-text" style={{ color: '#60a5fa' }}>
                      {formatBps(h.current_read_bps)}
                    </span>
                  </td>
                  <td>
                    {h.capacity_warning ? (
                      <span className="badge badge-critical">
                        <AlertCircle size={12} />
                        Threshold Exceeded
                      </span>
                    ) : (
                      <span className="badge badge-online">Normal</span>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => onSelectHost(h.id)}
                      className="btn-primary"
                      style={{ padding: '6px 14px', fontSize: 12 }}
                    >
                      Inspect
                      <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
