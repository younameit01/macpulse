import React, { useEffect, useState } from 'react';
import { ArrowLeft, HardDrive, Network } from 'lucide-react';
import { fetchVolumeDetail, fetchVolumeMetrics, formatBytes, formatBps } from '../api';
import IoChart from './IoChart';
import AlertsPanel from './AlertsPanel';

export default function VolumeDetail({ volumeId, onBack, onExplainAlert }) {
  const [vol, setVol] = useState(null);
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
      const [vData, mData] = await Promise.all([
        fetchVolumeDetail(volumeId),
        fetchVolumeMetrics(volumeId, currentMinutes),
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
  }, [volumeId, currentMinutes]);

  if (loading && !vol) {
    return (
      <div className="card-container" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading volume telemetry...
      </div>
    );
  }

  if (!vol) {
    return (
      <div className="card-container" style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: 'var(--alert-crit-border)' }}>Volume not found</p>
        <button onClick={onBack} className="btn-primary" style={{ marginTop: 12 }}>
          <ArrowLeft size={14} /> Back to Dashboard
        </button>
      </div>
    );
  }

  const isNfs = vol.fs_type.toLowerCase() === 'nfs';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Volume Header Card */}
      <div className="card-container" style={{ padding: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 14, border: '1px solid var(--border-subtle)' }}>
              {isNfs ? <Network size={28} color="#c084fc" /> : <HardDrive size={28} color="var(--chart-read)" />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)' }}>
                  {vol.mount_path === '/System/Volumes/Data'
                    ? 'Macintosh HD (Data)'
                    : vol.mount_path === '/'
                      ? 'Macintosh HD (System)'
                      : vol.mount_path.startsWith('/Volumes/')
                        ? vol.mount_path.replace('/Volumes/', '')
                        : vol.mount_path}
                </h2>
                <span className="badge" style={{ background: 'var(--bg-subtle)', color: 'var(--text-main)' }}>
                  {vol.fs_type.toUpperCase()}
                </span>
                {(vol.mount_path === '/System/Volumes/Data' || vol.mount_path === '/') && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 4,
                      background: 'rgba(56, 189, 248, 0.12)',
                      color: '#38bdf8',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    Shared APFS Pool
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                <span>Mount: <code className="mono-text">{vol.mount_path}</code></span>
                <span>Host: <strong style={{ color: 'var(--text-main)' }}>{vol.hostname}</strong></span>
                <span>Source: <code className="mono-text">{vol.source}</code></span>
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Current I/O</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--alert-crit-border)' }}>
              {formatBps(vol.current_write_bps)} <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>write</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--chart-read)' }}>
              {formatBps(vol.current_read_bps)} <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>read</span>
            </div>
          </div>
        </div>

        {/* Capacity Bar */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 6 }}>
            <span><strong>{formatBytes(vol.used_bytes)}</strong> used of <strong>{formatBytes(vol.total_bytes)}</strong></span>
            <span style={{ fontWeight: 700, color: vol.used_pct >= 90 ? 'var(--alert-crit-border)' : vol.used_pct >= 80 ? 'var(--alert-warn-text)' : 'var(--alert-green-text)' }}>
              {vol.used_pct}% Full ({formatBytes(vol.free_bytes)} free)
            </span>
          </div>
          <div style={{ width: '100%', height: 10, background: 'var(--bg-subtle)', borderRadius: 5, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.min(100, vol.used_pct)}%`,
                height: '100%',
                backgroundColor: vol.used_pct >= 90 ? 'var(--alert-crit-border)' : vol.used_pct >= 80 ? 'var(--alert-warn-border)' : 'var(--chart-read)',
                borderRadius: 5,
              }}
            />
          </div>
        </div>
      </div>

      {/* NFS Specific Panel */}
      {isNfs && (
        <div className="card-container" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Network size={20} color="#c084fc" />
            <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-main)' }}>NFS Network Storage Protocol Metrics</h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>Server Export</div>
              <div className="mono-text" style={{ fontSize: 14, color: 'var(--text-main)', marginTop: 4 }}>{vol.source}</div>
            </div>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>RPC Requests / Sec</div>
              <div className="mono-text" style={{ fontSize: 18, fontWeight: 700, color: 'var(--chart-read)', marginTop: 4 }}>
                {vol.nfs_stats?.nfs_ops_per_sec ?? 'N/A'}
              </div>
            </div>
            <div style={{ padding: 14, background: 'var(--bg-subtle)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-dim)', textTransform: 'uppercase' }}>RPC Retransmissions</div>
              <div className="mono-text" style={{ fontSize: 18, fontWeight: 700, color: (vol.nfs_stats?.nfs_retrans || 0) > 0 ? 'var(--alert-warn-text)' : 'var(--alert-green-text)', marginTop: 4 }}>
                {vol.nfs_stats?.nfs_retrans ?? 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time-series chart */}
      <div className="card-container" style={{ padding: 24, minHeight: 336 }}>
        <IoChart
          data={metrics}
          height={210}
          title={`Volume Throughput: ${vol.mount_path}`}
          subtitle={`Read and write throughput over the last ${timeRange}`}
          timeRange={timeRange}
          onTimeRangeChange={setTimeRange}
        />
      </div>

      {/* Volume Alerts */}
      <AlertsPanel
        alerts={vol.alerts || []}
        title="Alerts Tied to this Volume"
        subtitle="Active incidents, threshold breaches, and audit history on this mount"
        onExplainAlert={onExplainAlert}
        onAlertUpdated={loadData}
        scrollable={Boolean(vol.alerts && vol.alerts.length > 6)}
        maxHeight={vol.alerts && vol.alerts.length > 6 ? 480 : undefined}
      />
    </div>
  );
}
