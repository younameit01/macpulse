import React from 'react';
import { Server, ChevronRight, AlertCircle, HardDrive } from 'lucide-react';
import { formatBps, formatBytes } from '../api';

const formatVolumeName = (vol) => {
  if (!vol || vol === '/' || vol.includes('Data')) return 'Macintosh HD';
  if (vol.startsWith('/Volumes/')) return vol.replace('/Volumes/', '');
  const parts = vol.split('/');
  return parts[parts.length - 1] || vol;
};

export default function HostTable({ hosts = [], onSelectHost }) {
  return (
    <div className="card-container" style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h2 className="card-heading">Monitored Mac Hosts</h2>
          <p className="card-subheading">Real-time agent liveness, storage footprint, and active write throughput</p>
        </div>
      </div>

      <div className="data-table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Host</th>
              <th>Status</th>
              <th>Storage</th>
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
                <td colSpan={9} style={{ textAlign: 'center', color: 'var(--text-dim)', padding: 32 }}>
                  Waiting for Mac agents to report telemetry... Run <code>make agent</code> in a terminal.
                </td>
              </tr>
            ) : (
              hosts.map((h) => (
                <tr key={h.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ padding: 8, background: 'var(--bg-subtle)', borderRadius: 8 }}>
                        <Server size={18} color="var(--chart-read)" />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{h.hostname}</div>
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
                  <td style={{ minWidth: 160 }}>
                    {h.storage_total_bytes > 0 ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 12, marginBottom: 4 }}>
                          <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>
                            {formatBytes(h.storage_used_bytes)}
                          </span>
                          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>
                            / {formatBytes(h.storage_total_bytes)}
                          </span>
                          <span style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            marginLeft: 4,
                            backgroundColor: (h.storage_used_pct || 0) >= 90
                              ? 'rgba(239, 68, 68, 0.15)'
                              : (h.storage_used_pct || 0) >= 80
                                ? 'rgba(245, 158, 11, 0.15)'
                                : 'rgba(16, 185, 129, 0.15)',
                            color: (h.storage_used_pct || 0) >= 90
                              ? 'var(--alert-crit-border)'
                              : (h.storage_used_pct || 0) >= 80
                                ? 'var(--alert-warn-text)'
                                : 'var(--alert-green-text)',
                          }}>
                            {h.storage_used_pct || 0}%
                          </span>
                        </div>
                        <div style={{ width: '100%', height: 5, background: 'var(--bg-subtle)', borderRadius: 3, overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.min(100, h.storage_used_pct || 0)}%`,
                              height: '100%',
                              backgroundColor: (h.storage_used_pct || 0) >= 90
                                ? 'var(--alert-crit-border)'
                                : (h.storage_used_pct || 0) >= 80
                                  ? 'var(--alert-warn-border)'
                                  : 'var(--chart-read)',
                              borderRadius: 3,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)' }}>
                      <HardDrive size={14} />
                      <span>{h.volume_count}</span>
                    </div>
                  </td>
                  <td>
                    <div>
                      <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: 13 }}>
                        {formatVolumeName(h.hottest_volume)}
                      </div>
                      {h.hottest_volume && (h.hottest_volume.includes('Data') || h.hottest_volume.startsWith('/Volumes/')) && (
                        <div className="mono-text" style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
                          {h.hottest_volume}
                        </div>
                      )}
                      {h.hottest_volume_metric && (
                        <div style={{
                          fontSize: 11,
                          marginTop: 2,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          color: h.hottest_volume_metric.includes('write')
                            ? 'var(--alert-crit-border)'
                            : (h.hottest_volume_metric.includes('%') && parseFloat(h.hottest_volume_metric) >= 80
                              ? 'var(--alert-warn-text)'
                              : 'var(--text-dim)')
                        }}>
                          <span style={{
                            width: 5,
                            height: 5,
                            borderRadius: '50%',
                            backgroundColor: h.hottest_volume_metric.includes('write')
                              ? 'var(--alert-crit-border)'
                              : (h.hottest_volume_metric.includes('%') && parseFloat(h.hottest_volume_metric) >= 80
                                ? 'var(--alert-warn-text)'
                                : '#10b981')
                          }}></span>
                          {h.hottest_volume_metric}
                        </div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className="mono-text" style={{ color: h.current_write_bps > 10 * 1024 * 1024 ? 'var(--alert-crit-border)' : 'var(--text-main)', fontWeight: 600 }}>
                      {formatBps(h.current_write_bps)}
                    </span>
                  </td>
                  <td>
                    <span className="mono-text" style={{ color: 'var(--chart-read)' }}>
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
