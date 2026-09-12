import React, { useEffect, useState } from 'react';
import { ArrowLeft, HardDrive, Network, AlertTriangle, Sparkles, Activity } from 'lucide-react';
import { fetchVolumeDetail, fetchVolumeMetrics, formatBytes, formatBps } from '../api';
import IoChart from './IoChart';

export default function VolumeDetail({ volumeId, onBack, onExplainAlert }) {
  const [vol, setVol] = useState(null);
  const [metrics, setMetrics] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [vData, mData] = await Promise.all([
        fetchVolumeDetail(volumeId),
        fetchVolumeMetrics(volumeId, 15),
      ]);
      setVol(vData);
      setMetrics(mData);
    } catch (err) {
      console.error('Failed to load volume details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [volumeId]);

  if (loading && !vol) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading volume telemetry...
      </div>
    );
  }

  if (!vol) {
    return (
      <div className="glass-panel" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: '#f87171' }}>Volume not found</p>
        <button onClick={onBack} className="btn-primary" style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back
        </button>
      </div>
    );
  }

  const isNfs = vol.fs_type.toLowerCase() === 'nfs';
  const fillClass = vol.used_pct >= 90 ? 'fill-red' : vol.used_pct >= 80 ? 'fill-amber' : 'fill-green';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Back Button */}
      <div>
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
          <ArrowLeft size={15} /> Back
        </button>
      </div>

      {/* Volume Header Card */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 14, background: isNfs ? 'rgba(168, 85, 247, 0.15)' : 'rgba(59, 130, 246, 0.15)', borderRadius: 14 }}>
              {isNfs ? <Network size={28} color="#c084fc" /> : <HardDrive size={28} color="#60a5fa" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: '#ffffff' }}>{vol.mount_path}</h2>
                <span className={`badge ${isNfs ? 'badge-nfs' : 'badge-apfs'}`}>
                  {vol.fs_type.toUpperCase()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>Host: <strong style={{ color: '#cbd5e1' }}>{vol.hostname}</strong></span>
                <span>Source: <code className="mono-text">{vol.source}</code></span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current I/O</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#f87171' }}>{formatBps(vol.current_write_bps)} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>write</span></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#60a5fa' }}>{formatBps(vol.current_read_bps)} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>read</span></div>
          </div>
        </div>

        {/* Capacity Bar */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span><strong>{formatBytes(vol.used_bytes)}</strong> used of <strong>{formatBytes(vol.total_bytes)}</strong></span>
            <span style={{ fontWeight: 700, color: vol.used_pct >= 90 ? '#f87171' : vol.used_pct >= 80 ? '#fbbf24' : '#34d399' }}>
              {vol.used_pct}% Full ({formatBytes(vol.free_bytes)} free)
            </span>
          </div>
          <div className="progress-container" style={{ height: 12 }}>
            <div className={`progress-fill ${fillClass}`} style={{ width: `${Math.min(100, vol.used_pct)}%` }}></div>
          </div>
        </div>
      </div>

      {/* NFS Specific Panel */}
      {isNfs && (
        <div className="glass-panel" style={{ padding: 24, border: '1px solid rgba(168, 85, 247, 0.4)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Network size={20} color="#c084fc" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff' }}>NFS Network Storage Protocol Metrics</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Server Export</div>
              <div className="mono-text" style={{ fontSize: 14, color: '#ffffff', marginTop: 4 }}>{vol.source}</div>
            </div>
            <div style={{ padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>RPC Requests / Sec</div>
              <div className="mono-text" style={{ fontSize: 18, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>
                {vol.nfs_stats?.nfs_ops_per_sec ?? 'N/A'}
              </div>
            </div>
            <div style={{ padding: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>RPC Retransmissions</div>
              <div className="mono-text" style={{ fontSize: 18, fontWeight: 700, color: (vol.nfs_stats?.nfs_retrans || 0) > 0 ? '#fbbf24' : '#34d399', marginTop: 4 }}>
                {vol.nfs_stats?.nfs_retrans ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time-series chart */}
      <div className="glass-panel" style={{ padding: 24 }}>
        <IoChart data={metrics} height={200} title={`Volume Throughput: ${vol.mount_path}`} />
      </div>

      {/* Volume Alerts */}
      {vol.alerts.length > 0 && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 14 }}>Alerts Tied to this Volume</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {vol.alerts.map((a) => (
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
                    <span className={`badge ${a.severity === 'critical' ? 'badge-critical' : 'badge-warning'}`}>{a.severity}</span>
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
